const Logger = require("../../lib/logger");
const {
  TIKTOK_POLL_INTERVAL_MS,
  TIKTOK_BACKOFF_BASE_MS,
  TIKTOK_BACKOFF_MAX_MS,
} = require("../../config/constants");
const { fetchProfile, TiktokAccountNotFoundError } = require("./client");
const notifier = require("./notifier");
const { buildContent } = require("../../lib/notificationTemplate");
const scraperService = require("../scraperService/client");

const logger = new Logger("TIKTOK");

// Randomized delay between account checks so request timing doesn't form
// an exact, repeatable pattern (a perfectly fixed 3s gap between every
// check, cycle after cycle, is itself a bot-like signal independent of
// anything else about the request). Keeps the same ~3s average as before.
function jitteredDelayMs(baseMs, spreadMs) {
  return baseMs - spreadMs + Math.random() * spreadMs * 2;
}

// How long to wait before retrying a profile that has been failing, given its
// consecutive failure count. Capped so a permanently-dead account is still
// retried occasionally (in case it comes back / the provider recovers).
function backoffMs(consecutiveFailures) {
  if (!consecutiveFailures) return 0;
  const ms = TIKTOK_BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1);
  return Math.min(ms, TIKTOK_BACKOFF_MAX_MS);
}

class TiktokScheduler {
  constructor(client, { subStorage, stateStorage }) {
    this.client = client;
    this.subStorage = subStorage;
    this.stateStorage = stateStorage;
    this._interval = null;
    this._running = false;
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(
      () =>
        this.pollOnce().catch((e) => logger.error(`poll cycle: ${e.message}`)),
      TIKTOK_POLL_INTERVAL_MS,
    );
    if (this._interval.unref) this._interval.unref();
    logger.success(
      `TikTok poll loop started (every ${TIKTOK_POLL_INTERVAL_MS}ms)`,
    );
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // One poll tick across the deduplicated set of usernames. Independent per
  // profile (Rule O1) so one failure never blocks the others. Guarded against
  // overlap if a slow cycle exceeds the interval.
  async pollOnce() {
    if (this._running) {
      logger.debug("Previous poll cycle still running; skipping this tick");
      return;
    }
    this._running = true;
    try {
      const userMap = await this.subStorage.getUserSubscriberMap();
      if (userMap.size === 0) return;

      // Optimization: if the scraper microservice is confirmed offline,
      // skip the whole cycle instead of attempting (and failing) every
      // subscribed account individually — that just spams identical
      // errors and burns a slow HTTP-timeout wait per account for no
      // benefit. Per-account exponential backoff (see _pollUser) still
      // applies normally once the service is back and failures become
      // profile-specific again.
      const serviceStatus = scraperService.getServiceStatus();
      if (serviceStatus.status === "Offline") {
        logger.warning(
          `[TIKTOK] Skipping poll cycle — kizoxy-scraper service is offline (${serviceStatus.error || "no details"})`,
        );
        return;
      }

      const usernames = [...userMap.keys()];
      logger.info(
        `[TIKTOK] Polling ${usernames.length} profile(s) in sequential queue...`,
      );

      for (const username of usernames) {
        try {
          await this._pollUser(username, userMap.get(username));
        } catch (err) {
          logger.error(`[TIKTOK] Error polling @${username}:`, err.message);
        }
        // Jeda antrean agar tidak tabrakan — jitter agar tidak terlihat pola tetap
        await new Promise((res) =>
          setTimeout(res, jitteredDelayMs(3000, 1500)),
        );
      }
    } finally {
      this._running = false;
    }
  }

  async _pollUser(username, subscribers) {
    logger.info(`[TIKTOK] [POLL] Checking @${username}...`);
    const state = (await this.stateStorage.getState(username)) || {};

    // Respect exponential backoff for a failing profile.
    const wait = backoffMs(state.consecutiveFailures);
    if (wait > 0 && state.lastCheckedAt) {
      const elapsed = Date.now() - new Date(state.lastCheckedAt).getTime();
      if (elapsed < wait) {
        logger.debug(
          `@${username} in backoff (${Math.round((wait - elapsed) / 1000)}s left)`,
        );
        return;
      }
    }

    let profile;
    try {
      profile = await fetchProfile(username);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) {
        logger.warning(
          `[TIKTOK] [ERROR] @${username}: Code 404 - Account not found`,
        );
      } else {
        const code = err.status || err.code || "FETCH_FAILED";
        logger.error(
          `[TIKTOK] [ERROR] @${username}: Code ${code} - ${err.message}`,
        );
      }
      await this.stateStorage.recordFailure(username);
      return;
    }

    await this.stateStorage.clearFailures(username);

    await this._handleVideos(username, profile, state, subscribers);
    await this._handleLive(username, profile, state, subscribers);
  }

  async _handleVideos(username, profile, state, subscribers) {
    const latest =
      profile.videos?.find((v) => !v.isLive) || profile.videos?.[0];
    if (!latest) {
      logger.info(
        `[TIKTOK] [NO_VIDEOS] @${username} has 0 uploaded videos${
          profile.diagnostic
            ? ` — ${profile.diagnostic}`
            : " (Check TIKTOK_SESSION_ID in .env if restricted)"
        }`,
      );
      return;
    }

    const allVideoIds = profile.videos.map((v) => v.id).filter(Boolean);
    let latestTime = latest.createTime ? Number(latest.createTime) : 0;
    if (!latestTime && latest.id) {
      try {
        latestTime = Number(BigInt(latest.id) >> 32n);
      } catch (_) {}
    }
    const times = profile.videos.map((v) => {
      if (v.createTime) return Number(v.createTime);
      try {
        return Number(BigInt(v.id) >> 32n);
      } catch (_) {
        return 0;
      }
    });
    const maxTime = Math.max(...times, latestTime, 0);

    const lastTime = state.lastVideoCreateTime
      ? Number(state.lastVideoCreateTime)
      : 0;
    const seenVideoIds = Array.isArray(state.seenVideoIds)
      ? state.seenVideoIds
      : [];

    // First time we ever see this profile: record all current video IDs without announcing,
    // so adding a subscription never floods historical posts.
    if (!state.lastVideoId) {
      await this.stateStorage.setState(username, {
        lastVideoId: latest.id,
        lastVideoCreateTime: Math.max(maxTime, latestTime),
        seenVideoIds: [...new Set([...allVideoIds, ...seenVideoIds])].slice(
          0,
          50,
        ),
        // Preserve any live fields already set in this cycle.
        isLive: state.isLive || false,
      });
      return;
    }

    // 1. Skip if post ID was already seen/notified previously
    if (seenVideoIds.includes(latest.id) || state.lastVideoId === latest.id) {
      await this.stateStorage.setState(username, {
        seenVideoIds: [...new Set([...allVideoIds, ...seenVideoIds])].slice(
          0,
          50,
        ),
      });
      return;
    }

    // 2. Skip if post is older than 48 hours (48 * 3600 * 1000 ms)
    // Automated notifications are strictly for new uploads, never historical posts
    const MAX_AGE_MS =
      process.env.NODE_ENV === "test" ? Infinity : 48 * 60 * 60 * 1000;
    const now = Date.now();
    const isOldPost = latestTime > 0 && now - latestTime * 1000 > MAX_AGE_MS;

    if (isOldPost) {
      logger.debug(
        `[TIKTOK_SCHEDULER] Suppressing old post ${latest.id} for @${username} (age: ${Math.round((now - latestTime * 1000) / 86400000)} days)`,
      );
      await this.stateStorage.setState(username, {
        lastVideoId: latest.id,
        lastVideoCreateTime: Math.max(latestTime, lastTime, maxTime),
        seenVideoIds: [...new Set([...allVideoIds, ...seenVideoIds])].slice(
          0,
          50,
        ),
      });
      return;
    }

    // 3. Skip if latest post createTime is older than or equal to recorded lastVideoCreateTime
    if (latestTime > 0 && lastTime > 0 && latestTime <= lastTime) {
      logger.debug(
        `[TIKTOK_SCHEDULER] Skipping post ${latest.id} for @${username} (timestamp ${latestTime} <= recorded ${lastTime})`,
      );
      await this.stateStorage.setState(username, {
        seenVideoIds: [...new Set([...allVideoIds, ...seenVideoIds])].slice(
          0,
          50,
        ),
      });
      return;
    }

    await this._fanOutVideo(username, profile, latest, subscribers);
    await this.stateStorage.setState(username, {
      lastVideoId: latest.id,
      lastVideoCreateTime: Math.max(latestTime, lastTime, maxTime),
      seenVideoIds: [...new Set([...allVideoIds, ...seenVideoIds])].slice(
        0,
        50,
      ),
    });
  }

  async _handleLive(username, profile, state, subscribers) {
    const live = profile.user.live;
    const liveId = profile.user.liveId || null;

    if (live) {
      logger.info(
        `[TIKTOK] [LIVE] @${username} is currently live (Room ID: ${liveId || "live"})`,
      );
      // Rising-edge gate: only announce when transitioning from NOT-live to live.
      const alreadyAnnounced = state.isLive === true;
      if (!alreadyAnnounced) {
        await this._fanOutLive(username, profile, subscribers);
      }
      await this.stateStorage.setState(username, {
        isLive: true,
        lastLiveId: liveId,
        notLiveStreak: 0,
      });
    } else {
      const notLiveStreak = (state.notLiveStreak || 0) + 1;
      if (state.isLive && notLiveStreak >= 2) {
        await this.stateStorage.setState(username, {
          isLive: false,
          notLiveStreak: 0,
        });
      } else {
        await this.stateStorage.setState(username, { notLiveStreak });
      }
    }
  }

  async _fanOutVideo(username, profile, video, subscribers) {
    const embed = notifier.buildVideoEmbed(this.client, {
      username,
      video,
      avatar: profile.user.avatar,
    });
    const row = notifier.buildLinkRow("Watch on TikTok", video.url);
    for (const { subscription } of subscribers) {
      if (subscription.notifyVideos === false) continue;
      const prefix = `📲 [TIKTOK] @${username} posted a new video`;
      const content = buildContent({
        customMessage: subscription.customMessage,
        mentionRoleId: subscription.mentionRoleId,
        defaultPrefix: prefix,
        vars: {
          name: `@${username}`,
          url: video.url,
          title: video.title || "",
          type: "video",
        },
      });
      await notifier.send(this.client, subscription, {
        embed,
        row,
        content,
      });
    }
  }

  async _fanOutLive(username, profile, subscribers) {
    const liveUrl = profile.user.liveUrl;
    const embed = notifier.buildLiveEmbed(this.client, {
      username,
      liveUrl,
      avatar: profile.user.avatar,
    });
    const row = notifier.buildLinkRow("Join the live", liveUrl);
    for (const { subscription } of subscribers) {
      if (subscription.notifyLive === false) continue;
      const prefix = `🔴 [TIKTOK LIVE] @${username} is live on TikTok!`;
      const content = buildContent({
        customMessage: subscription.customMessage,
        mentionRoleId: subscription.mentionRoleId,
        defaultPrefix: prefix,
        vars: {
          name: `@${username}`,
          url: liveUrl,
          title: `@${username} is live`,
          type: "live",
        },
      });
      await notifier.send(this.client, subscription, {
        embed,
        row,
        content,
      });
    }
  }
}

module.exports = TiktokScheduler;
module.exports.backoffMs = backoffMs;
module.exports.jitteredDelayMs = jitteredDelayMs;
