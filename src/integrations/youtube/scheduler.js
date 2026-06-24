const Logger = require("../../lib/logger");
const { YOUTUBE_POLL_INTERVAL_MS } = require("../../config/constants");
const { fetchLatestFeedEntry, fetchVideoDetails } = require("./client");
const { classify } = require("./classifier");
const { buildAnnouncementEmbed, buildWatchRow } = require("./formatter");

const logger = new Logger("YOUTUBE");

// Maps a classification type to the subscription toggle that gates it.
const TYPE_TOGGLE = {
  live: "notifyLive",
  upcoming: "notifyLive",
  short: "notifyShorts",
  video: "notifyVideos",
};

class YoutubeScheduler {
  constructor(client, { subStorage, stateStorage }) {
    this.client = client;
    this.subStorage = subStorage;
    this.stateStorage = stateStorage;
    this._interval = null;
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
    } catch (err) {
      logger.warning(`Feed fetch failed for ${channelId}: ${err.message}`);
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
      if (toggle && subscription[toggle] === false) continue;

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
        const content = subscription.mentionRoleId
          ? `<@&${subscription.mentionRoleId}>`
          : undefined;

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
