const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../data/fixembed.json");

const DEFAULT_SETTINGS = {
  enabled: false,
  disabledChannels: [],
  ignoredUsers: [],
  ignoredRoles: [],
  ignoredKeywords: [],
  baseMessageAction: "remove_embed", // 'nothing' | 'remove_embed' | 'delete_message'
  viewMode: "normal", // 'normal' | 'direct' | 'gallery' | 'text'
};

class FixEmbedStorage {
  constructor() {
    this.cache = {};
    this._init();
  }

  _init() {
    try {
      if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), "utf8");
      }
      this.cache = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    } catch (err) {
      console.error("[FixEmbed] Error initializing storage:", err);
      this.cache = {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(this.cache, null, 2), "utf8");
    } catch (err) {
      console.error("[FixEmbed] Error saving storage:", err);
    }
  }

  getSettings(guildId) {
    if (!this.cache[guildId]) {
      this.cache[guildId] = { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...this.cache[guildId] };
  }

  saveSettings(guildId, settings) {
    this.cache[guildId] = { ...this.getSettings(guildId), ...settings };
    this._save();
    return this.cache[guildId];
  }

  /**
   * Check whether the bot should process a message in this context.
   * Returns false if the feature is disabled or the context is ignored.
   */
  isEnabled(guildId, channelId, member) {
    const s = this.getSettings(guildId);
    if (!s.enabled) return false;
    if (s.disabledChannels.includes(channelId)) return false;
    if (member) {
      if (s.ignoredUsers.includes(member.id)) return false;
      const memberRoles = member.roles?.cache?.map((r) => r.id) ?? [];
      if (memberRoles.some((rid) => s.ignoredRoles.includes(rid))) return false;
    }
    return true;
  }

  /**
   * Returns true if any ignored keyword is present in the message content.
   */
  hasIgnoredKeyword(guildId, content) {
    const s = this.getSettings(guildId);
    const lower = content.toLowerCase();
    return s.ignoredKeywords.some((kw) => lower.includes(kw.toLowerCase()));
  }

  // ---- Helper toggle methods ----

  _toggle(guildId, field, value) {
    const s = this.getSettings(guildId);
    const list = s[field] || [];
    const idx = list.indexOf(value);
    const added = idx === -1;
    if (added) list.push(value);
    else list.splice(idx, 1);
    this.saveSettings(guildId, { [field]: list });
    return added; // true = added, false = removed
  }

  toggleChannel(guildId, channelId) {
    return this._toggle(guildId, "disabledChannels", channelId);
  }

  toggleUser(guildId, userId) {
    return this._toggle(guildId, "ignoredUsers", userId);
  }

  toggleRole(guildId, roleId) {
    return this._toggle(guildId, "ignoredRoles", roleId);
  }

  toggleKeyword(guildId, keyword) {
    return this._toggle(guildId, "ignoredKeywords", keyword.toLowerCase());
  }

  setEnabled(guildId, value) {
    this.saveSettings(guildId, { enabled: value });
  }

  setBaseMessageAction(guildId, action) {
    const valid = ["nothing", "remove_embed", "delete_message"];
    if (!valid.includes(action)) throw new Error(`Invalid action: ${action}`);
    this.saveSettings(guildId, { baseMessageAction: action });
  }

  setViewMode(guildId, mode) {
    const valid = ["normal", "direct", "gallery", "text"];
    if (!valid.includes(mode)) throw new Error(`Invalid view mode: ${mode}`);
    this.saveSettings(guildId, { viewMode: mode });
  }
}

module.exports = new FixEmbedStorage();
