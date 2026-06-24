const Logger = require("../lib/logger");
const logger = new Logger("YOUTUBE_STATE_STORAGE");
const JSONStorage = require("./jsonStorage");

// DEVIATION (intentional): this storage is NOT guild-indexed. Poll state is
// global per YouTube channel and shared across every guild subscribed to it,
// so the shape is { [youtubeChannelId]: { lastVideoId, lastCheckedAt } }. This
// is durable dedup state (survives restarts) — losing it would re-announce the
// last-seen video to everyone on next boot. Not the Rule K external-response
// cache; same durability category as alarm/TempVC storage.
class YoutubeStateStorage extends JSONStorage {
  constructor(filename = "youtubeState.json") {
    super(filename);
  }

  async getState(youtubeChannelId) {
    await this._ensureLoaded();
    return this.data[youtubeChannelId] || null;
  }

  async setState(youtubeChannelId, { lastVideoId }) {
    await this._ensureLoaded();
    this.data[youtubeChannelId] = {
      lastVideoId,
      lastCheckedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    logger.debug(`State updated for ${youtubeChannelId}: ${lastVideoId}`);
    return this.data[youtubeChannelId];
  }

  async touch(youtubeChannelId) {
    await this._ensureLoaded();
    const existing = this.data[youtubeChannelId] || { lastVideoId: null };
    this.data[youtubeChannelId] = {
      lastVideoId: existing.lastVideoId,
      lastCheckedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.data[youtubeChannelId];
  }
}

module.exports = new YoutubeStateStorage();
module.exports.YoutubeStateStorage = YoutubeStateStorage;
