const fs = require("fs");
const path = require("path");
const Logger = require("../lib/logger");

const logger = new Logger("FIXEMBED_STORAGE");

const DATA_PATH = path.join(__dirname, "../../data/fixembed.json");

const KNOWN_PLATFORMS = [
  "twitter",
  "instagram",
  "tiktok",
  "reddit",
  "threads",
  "bluesky",
  "facebook",
  "tumblr",
  "mastodon",
  "youtube",
  "twitch",
  "bilibili",
  "spotify",
  "pixiv",
  "deviantart",
  "newgrounds",
  "furaffinity",
  "snapchat",
  "pinterest",
  "imgur",
  "ifunny",
  "booru",
  "danbooru",
  "weibo",
];

const DEFAULT_SETTINGS = {
  enabled: true,
  deleteBehavior: "suppress",
  spoilerPassthrough: true,
  ignoredChannels: [],
  ignoredDomains: [],
  platforms: {},
  disabledChannels: [],
  ignoredUsers: [],
  ignoredRoles: [],
  ignoredKeywords: [],
  baseMessageAction: "remove_embed",
  viewMode: "normal",
};

function applyPlatformDefaults(platforms) {
  const result = { ...platforms };
  for (const key of KNOWN_PLATFORMS) {
    if (!result[key]) {
      result[key] = { enabled: true, viewMode: "normal" };
    } else {
      result[key] = {
        enabled: result[key].enabled ?? true,
        viewMode: result[key].viewMode ?? "normal",
      };
    }
  }
  return result;
}

function applyDefaults(stored) {
  const deleteBehavior =
    stored.deleteBehavior ??
    (stored.baseMessageAction === "delete_message"
      ? "delete"
      : stored.baseMessageAction === "nothing"
        ? "none"
        : "suppress");
  const baseMessageAction =
    stored.baseMessageAction ??
    (deleteBehavior === "delete"
      ? "delete_message"
      : deleteBehavior === "none"
        ? "nothing"
        : "remove_embed");
  const ignoredChannels =
    stored.ignoredChannels ?? stored.disabledChannels ?? [];
  const disabledChannels = stored.disabledChannels ?? ignoredChannels;

  const s = {
    ...DEFAULT_SETTINGS,
    ...stored,
    deleteBehavior,
    baseMessageAction,
    ignoredChannels,
    disabledChannels,
  };

  s.platforms = applyPlatformDefaults(s.platforms);
  return s;
}

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
      logger.error(`Error initializing storage: ${err.message}`);
      this.cache = {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(this.cache, null, 2), "utf8");
    } catch (err) {
      logger.error(`Error saving storage: ${err.message}`);
    }
  }

  getSettings(guildId) {
    const raw = this.cache[guildId] || {};
    return applyDefaults(raw);
  }

  saveSettings(guildId, settings) {
    const current = this.cache[guildId] || {};
    const merged = { ...current, ...settings };

    // Sync deleteBehavior <-> baseMessageAction
    if (settings.deleteBehavior !== undefined) {
      const mapping = {
        suppress: "remove_embed",
        delete: "delete_message",
        none: "nothing",
      };
      merged.baseMessageAction =
        mapping[settings.deleteBehavior] || "remove_embed";
    } else if (settings.baseMessageAction !== undefined) {
      const mapping = {
        remove_embed: "suppress",
        delete_message: "delete",
        nothing: "none",
      };
      merged.deleteBehavior = mapping[settings.baseMessageAction] || "suppress";
    }

    // Sync ignoredChannels <-> disabledChannels
    if (settings.ignoredChannels !== undefined) {
      merged.disabledChannels = settings.ignoredChannels;
    } else if (settings.disabledChannels !== undefined) {
      merged.ignoredChannels = settings.disabledChannels;
    }

    this.cache[guildId] = merged;
    this._save();
    return this.getSettings(guildId);
  }

  isEnabled(guildId, channelId, member) {
    const s = this.getSettings(guildId);
    if (!s.enabled) return false;
    if (s.ignoredChannels.includes(channelId)) return false;
    if (member) {
      if (s.ignoredUsers?.includes(member.id)) return false;
      const memberRoles = member.roles?.cache?.map((r) => r.id) ?? [];
      if (memberRoles.some((rid) => s.ignoredRoles?.includes(rid)))
        return false;
    }
    return true;
  }

  hasIgnoredKeyword(guildId, content) {
    const s = this.getSettings(guildId);
    const lower = content.toLowerCase();
    return (
      s.ignoredKeywords?.some((kw) => lower.includes(kw.toLowerCase())) ?? false
    );
  }

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
    return this._toggle(guildId, "ignoredChannels", channelId);
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
