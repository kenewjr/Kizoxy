const Logger = require("../../lib/logger");
const { YOUTUBE_POLL_INTERVAL_MS } = require("../../config/constants");
const { fetchLatestFeedEntry, fetchVideoDetails } = require("./client");
const { classify } = require("./classifier");
const { buildAnnouncementEmbed, buildWatchRow } = require("./formatter");
const { buildContent } = require("../../lib/notificationTemplate");

const logger = new Logger("YOUTUBE");

// Maps a classification type to the subscription toggle that gates it.
const TYPE_TOGGLE = {
  live: "notifyLive",
  upcoming: "notifyUpcoming",
  short: "notifyShorts",
  video: "notifyVideos",
};

// Content text prefix per classification type (Rule I1).
const TYPE_CONTENT = {
  live: (name) => `🔴 [LIVE] ${name} is now streaming live!`,
  upcoming: (name) => `🗓️ [UPCOMING] ${name} has a stream coming up`,
  short: (name) => `📱 [SHORT] ${name} posted a new Short`,
  video: (name) => `📺 [VIDEO] ${name} uploaded a new video`,
};

class YoutubeScheduler {
  constructor(client, { subStorage, stateStorage }) {
    this.client = client;
    this.subStorage = subStorage;
    this.stateStorage = stateStorage;
    this._interval = null;
    // channelId -> consecutive feed-failure count. Used to warn once on a
    // permanent failure (404/403/400) then go quiet, avoiding 60s log spam.
    this._feedFailures = new Map();
  }

  // Permanent HTTP statuses mean the channel is gone/blocked; retrying is
  // pointless so warn only on the first hit. Everything else (5xx, network,
  // timeout) is transient and logged at debug to keep the log clean.
  _logFeedFailure(channelId, err) {
    const status = err.response?.status;
    const permanent = status === 404 || status === 403 || status === 400;
    const count = (this._feedFailures.get(channelId) || 0) + 1;
    this._feedFailures.set(channelId, count);
    if (permanent) {
      if (count === 1) {
        logger.warning(
          `Feed fetch failed for ${channelId}: ${err.message} (status ${status}, permanent — suppressing further warnings)`,
        );
      }
      return;
    }
    logger.debug(`Feed fetch failed for ${channelId}: ${err.message}`);
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(
      () =>
        this.pollOnce().catch((e) => logger.error(`poll cycle: ${e.message}`)),
      YOUTUBE_POLL_INTERVAL_MS,
    );
    if (this._interval.unref) this._interval.unref();
    logger.success(
      `YouTube poll loop started (every ${YOUTUBE_POLL_INTERVAL_MS}ms)`,
    );
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // One poll tick across the deduplicated set of channel IDs. Each channel's
  // fetch is independent (Rule O1) so one failure never blocks the others.
  async pollOnce() {
    const channelMap = await this.subStorage.getChannelSubscriberMap();
    if (channelMap.size === 0) return;

    const channelIds = [...channelMap.keys()];
    logger.debug(`Polling ${channelIds.length} unique YouTube channel(s)`);

    await Promise.allSettled(
      channelIds.map((channelId) =>
        this._pollChannel(channelId, channelMap.get(channelId)),
      ),
    );
  }

  async _pollChannel(channelId, subscribers) {
    let entry;
    try {
      entry = await fetchLatestFeedEntry(channelId);
      this._feedFailures.delete(channelId); // recovered
    } catch (err) {
      this._logFeedFailure(channelId, err);
      return;
    }
    if (!entry?.videoId) return;

    const state = await this.stateStorage.getState(channelId);

    // First time we ever see this channel: record the latest without
    // announcing, so a restart/first-add never floods the old backlog.
    if (!state) {
      await this.stateStorage.setState(channelId, {
        lastVideoId: entry.videoId,
      });
      return;
    }

    if (state.lastVideoId === entry.videoId) {
      await this.stateStorage.touch(channelId);
      return;
    }

    // Genuinely new video — the only place the 1-unit videos.list fires.
    let videoItem;
    try {
      videoItem = await fetchVideoDetails(entry.videoId);
    } catch (err) {
      logger.warning(`videos.list failed for ${entry.videoId}: ${err.message}`);
      return;
    }
    if (!videoItem) return;

    const type = await classify(videoItem);
    await this._fanOut(videoItem, type, subscribers);

    // TODO Phase 2: a scheduled premiere/live already appears in the feed while
    // liveBroadcastContent is "upcoming"; its videoId won't change when it flips
    // to "live", so this diff won't re-fire. Catching that transition would need
    // a small re-check queue for pending "upcoming" video IDs.
    await this.stateStorage.setState(channelId, { lastVideoId: entry.videoId });
  }

  async _fanOut(videoItem, type, subscribers) {
    const toggle = TYPE_TOGGLE[type];
    for (const { guildId, subscription } of subscribers) {
      // Backward-compat: missing field defaults to true via ?? true check.
      if (toggle && (subscription[toggle] ?? true) === false) continue;

      try {
        const channel = await this.client.channels
          .fetch(subscription.announceChannelId)
          .catch(() => null);
        if (!channel) {
          // Channel deleted: skip this guild, do not throw, do not auto-delete
          // the subscription (admin might re-create the channel).
          logger.warning(
            `Announce channel ${subscription.announceChannelId} not found (guild ${guildId}); skipping`,
          );
          continue;
        }

        const embed = buildAnnouncementEmbed(this.client, {
          videoItem,
          type,
          channelTitle: subscription.youtubeChannelTitle,
        });
        const components = [buildWatchRow(videoItem.id)];
        const channelName = subscription.youtubeChannelTitle || "YouTube";
        const typePrefix = (TYPE_CONTENT[type] || TYPE_CONTENT.video)(
          channelName,
        );
        const content = buildContent({
          customMessage: subscription.customMessage,
          mentionRoleId: subscription.mentionRoleId,
          defaultPrefix: typePrefix,
          vars: {
            name: channelName,
            url: `https://www.youtube.com/watch?v=${videoItem.id}`,
            title: videoItem.snippet?.title || "",
            type,
          },
        });

        await channel
          .send({ content, embeds: [embed], components })
          .catch((e) =>
            logger.error(
              `Failed to send announcement to ${subscription.announceChannelId}: ${e.message}`,
            ),
          );
      } catch (err) {
        logger.error(`fan-out error for guild ${guildId}: ${err.message}`);
      }
    }
  }
}

module.exports = YoutubeScheduler;
