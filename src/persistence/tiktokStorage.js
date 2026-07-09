const { randomUUID } = require("crypto");
const Logger = require("../lib/logger");
const logger = new Logger("TIKTOK_STORAGE");
const JSONStorage = require("./jsonStorage");

// Guild-indexed: { [guildId]: { subscriptions: [...] } } per the standard
// CONTEXT.md storage contract.
function defaultGuildData() {
  return { subscriptions: [] };
}

function normalizeUsername(username) {
  if (!username) return username;
  return String(username).replace(/^@/, "").toLowerCase();
}

class TiktokStorage extends JSONStorage {
  constructor(filename = "tiktok.json") {
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

  // Username is the stable handle users type; tiktokUserId may be null until the
  // resolver fills it in. Match on either.
  async findByUsername(guildId, username) {
    const g = await this._guild(guildId);
    const norm = normalizeUsername(username);
    return g.subscriptions.find((s) => s.username === norm) || null;
  }

  async addSubscription(guildId, sub) {
    const g = await this._guild(guildId);
    const record = {
      id: randomUUID(),
      tiktokUserId: sub.tiktokUserId ?? null,
      username: normalizeUsername(sub.username),
      profileUrl: sub.profileUrl,
      discordChannelId: sub.discordChannelId,
      mentionRoleId: sub.mentionRoleId ?? null,
      customMessage: sub.customMessage ?? null,
      notifyVideos: sub.notifyVideos !== false,
      notifyLive: sub.notifyLive !== false,
      createdAt: new Date().toISOString(),
    };
    g.subscriptions.push(record);
    this.scheduleSave();
    logger.info(
      `Added subscription ${record.id} (@${record.username}) for guild ${guildId}`,
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

  // Persist resolver-discovered fields (id, canonical username after a rename).
  async updateSubscription(guildId, subscriptionId, updates) {
    const g = await this._guild(guildId);
    const sub = g.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return null;
    if (updates.username !== undefined) {
      updates.username = normalizeUsername(updates.username);
    }
    Object.assign(sub, updates);
    this.scheduleSave();
    return sub;
  }

  // Deduplicated set of TikTok usernames across every guild, each mapped to the
  // list of { guildId, subscription } that follow it. The scheduler polls each
  // profile once and fans out to all subscribers.
  async getUserSubscriberMap() {
    await this._ensureLoaded();
    const map = new Map();
    for (const guildId of Object.keys(this.data)) {
      const subs = this.data[guildId]?.subscriptions;
      if (!Array.isArray(subs)) continue;
      for (const subscription of subs) {
        const key = subscription.username;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ guildId, subscription });
      }
    }
    return map;
  }
}

module.exports = new TiktokStorage();
module.exports.TiktokStorage = TiktokStorage;
module.exports.normalizeUsername = normalizeUsername;
