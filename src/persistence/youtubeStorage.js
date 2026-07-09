const { randomUUID } = require("crypto");
const Logger = require("../lib/logger");
const logger = new Logger("YOUTUBE_STORAGE");
const JSONStorage = require("./jsonStorage");

// Guild-indexed: { [guildId]: { subscriptions: [...] } } per the standard
// CONTEXT.md storage contract.
function defaultGuildData() {
  return { subscriptions: [] };
}

class YoutubeStorage extends JSONStorage {
  constructor(filename = "youtube.json") {
    super(filename);
  }

  async _guild(guildId) {
    await this._ensureLoaded();
    if (!guildId) throw new Error("guildId is required");
    let g = this.data[guildId];
    if (!g) {
      g = defaultGuildData();
      this.data[guildId] = g;
      return g;
    }
    if (!Array.isArray(g.subscriptions)) g.subscriptions = [];
    return g;
  }

  async listSubscriptions(guildId) {
    const g = await this._guild(guildId);
    return g.subscriptions;
  }

  async getSubscription(guildId, subscriptionId) {
    const g = await this._guild(guildId);
    return g.subscriptions.find((s) => s.id === subscriptionId) || null;
  }

  async findByYoutubeChannel(guildId, youtubeChannelId) {
    const g = await this._guild(guildId);
    return (
      g.subscriptions.find((s) => s.youtubeChannelId === youtubeChannelId) ||
      null
    );
  }

  async addSubscription(guildId, sub) {
    const g = await this._guild(guildId);
    const record = {
      id: randomUUID(),
      youtubeChannelId: sub.youtubeChannelId,
      youtubeChannelTitle: sub.youtubeChannelTitle,
      youtubeChannelUrl: sub.youtubeChannelUrl,
      announceChannelId: sub.announceChannelId,
      mentionRoleId: sub.mentionRoleId ?? null,
      customMessage: sub.customMessage ?? null,
      notifyVideos: sub.notifyVideos !== false,
      notifyShorts: sub.notifyShorts !== false,
      notifyLive: sub.notifyLive !== false,
      notifyUpcoming: sub.notifyUpcoming !== false,
      createdAt: new Date().toISOString(),
    };
    g.subscriptions.push(record);
    this.scheduleSave();
    logger.info(
      `Added subscription ${record.id} (${record.youtubeChannelId}) for guild ${guildId}`,
    );
    return record;
  }

  async removeSubscription(guildId, subscriptionId) {
    const g = await this._guild(guildId);
    const idx = g.subscriptions.findIndex((s) => s.id === subscriptionId);
    if (idx === -1) return null;
    const [removed] = g.subscriptions.splice(idx, 1);
    this.scheduleSave();
    logger.info(`Removed subscription ${subscriptionId} for guild ${guildId}`);
    return removed;
  }

  async updateSubscription(guildId, subscriptionId, updates) {
    const g = await this._guild(guildId);
    const sub = g.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return null;
    Object.assign(sub, updates);
    this.scheduleSave();
    return sub;
  }

  // Deduplicated set of YouTube channel IDs across every guild, each mapped to
  // the list of { guildId, subscription } that follow it. The scheduler polls
  // each channel once and fans out to all subscribers.
  async getChannelSubscriberMap() {
    await this._ensureLoaded();
    const map = new Map();
    for (const guildId of Object.keys(this.data)) {
      const subs = this.data[guildId]?.subscriptions;
      if (!Array.isArray(subs)) continue;
      for (const subscription of subs) {
        if (!map.has(subscription.youtubeChannelId)) {
          map.set(subscription.youtubeChannelId, []);
        }
        map.get(subscription.youtubeChannelId).push({ guildId, subscription });
      }
    }
    return map;
  }
}

module.exports = new YoutubeStorage();
module.exports.YoutubeStorage = YoutubeStorage;
