const Logger = require("../lib/logger");
const logger = new Logger("TIKTOK_STATE_STORAGE");
const JSONStorage = require("./jsonStorage");

// DEVIATION (intentional): this storage is NOT guild-indexed. Poll state is
// global per TikTok username and shared across every guild subscribed to it,
// so the shape is:
//   { [username]: { lastVideoId, lastLiveId, isLive, lastCheckedAt,
//                   consecutiveFailures } }
// This is durable dedup state (survives restarts) — losing it would re-announce
// the last-seen video / live to everyone on next boot. Same durability category
// as the YouTube state storage, not a Rule K external-response cache.
class TiktokStateStorage extends JSONStorage {
  constructor(filename = "tiktokState.json") {
    super(filename);
  }

  async getState(username) {
    await this._ensureLoaded();
    return this.data[username] || null;
  }

  async setState(username, patch) {
    await this._ensureLoaded();
    const existing = this.data[username] || {
      lastVideoId: null,
      lastLiveId: null,
      isLive: false,
      consecutiveFailures: 0,
    };
    this.data[username] = {
      ...existing,
      ...patch,
      lastCheckedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    logger.debug(`State updated for @${username}`);
    return this.data[username];
  }

  async recordFailure(username) {
    await this._ensureLoaded();
    const existing = this.data[username] || {
      lastVideoId: null,
      lastLiveId: null,
      isLive: false,
      consecutiveFailures: 0,
    };
    this.data[username] = {
      ...existing,
      consecutiveFailures: (existing.consecutiveFailures || 0) + 1,
      lastCheckedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.data[username];
  }

  async clearFailures(username) {
    await this._ensureLoaded();
    if (this.data[username]) {
      this.data[username].consecutiveFailures = 0;
      this.scheduleSave();
    }
  }

  async deleteState(username) {
    await this._ensureLoaded();
    if (this.data[username]) {
      delete this.data[username];
      this.scheduleSave();
    }
  }
}

module.exports = new TiktokStateStorage();
module.exports.TiktokStateStorage = TiktokStateStorage;
