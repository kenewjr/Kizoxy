const Logger = require("../../lib/logger");
const {
  TIKTOK_POLL_INTERVAL_MS,
  TIKTOK_BACKOFF_BASE_MS,
  TIKTOK_BACKOFF_MAX_MS,
} = require("../../config/constants");
const { fetchProfile, TiktokAccountNotFoundError } = require("./client");
const notifier = require("./notifier");

const logger = new Logger("TIKTOK");

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

      const usernames = [...userMap.keys()];
      logger.debug(`Polling ${usernames.length} unique TikTok profile(s)`);

      await Promise.allSettled(
        usernames.map((username) =>
          this._pollUser(username, userMap.get(username)),
        ),
      );
    } finally {
      this._running = false;
    }
  }

  async _pollUser(username, subscribers) {
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
        // Deleted or renamed: back off hard but keep the subscription so an
        // admin can see/clean it up via /tiktok status or /tiktok remove.
        logger.warning(`@${username} not found; recording failure`);
      }
      await this.stateStorage.recordFailure(username);
      return;
    }

    await this.stateStorage.clearFailures(username);

    await this._handleVideos(username, profile, state, subscribers);
    await this._handleLive(username, profile, state, subscribers);
  }

  async _handleVideos(username, profile, state, subscribers) {
    const latest = profile.videos.find((v) => !v.isLive) || profile.videos[0];
    if (!latest) return;

    // First time we ever see this profile: record latest without announcing,
    // so adding a subscription never floods the backlog.
    if (!state.lastVideoId) {
      await this.stateStorage.setState(username, {
        lastVideoId: latest.id,
        // Preserve any live fields already set in this cycle.
        isLive: state.isLive || false,
      });
      return;
    }

    if (state.lastVideoId === latest.id) return;

    await this._fanOutVideo(username, profile, latest, subscribers);
    await this.stateStorage.setState(username, { lastVideoId: latest.id });
  }

  async _handleLive(username, profile, state, subscribers) {
    const live = profile.user.live;
    const liveId = profile.user.liveId || (live ? "live" : null);

    if (live) {
      // Only announce on the rising edge of a live session, and only once per
      // distinct liveId (anti-spam across restarts).
      const alreadyAnnounced = state.isLive && state.lastLiveId === liveId;
      if (!alreadyAnnounced) {
        await this._fanOutLive(username, profile, subscribers);
      }
      await this.stateStorage.setState(username, {
        isLive: true,
        lastLiveId: liveId,
      });
    } else if (state.isLive) {
      // Live ended: clear the flag so the next session announces again.
      await this.stateStorage.setState(username, { isLive: false });
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
      await notifier.send(this.client, subscription, {
        embed,
        row,
        content: notifier.mentionContent(subscription),
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
      await notifier.send(this.client, subscription, {
        embed,
        row,
        content: notifier.mentionContent(
          subscription,
          `🔴 @${username} is now LIVE!`,
        ),
      });
    }
  }
}

module.exports = TiktokScheduler;
module.exports.backoffMs = backoffMs;
