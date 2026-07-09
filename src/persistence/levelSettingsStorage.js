const fs = require("fs");
const path = require("path");
const Logger = require("../lib/logger");

const logger = new Logger("LEVEL_SETTINGS_STORAGE");

const DATA_PATH = path.join(__dirname, "../../data/levelSettings.json");

const DEFAULT_SETTINGS = {
  xp_enabled: true,
  level_up_channel_id: null, // null = announce in the message's channel
  xp_min: 10,
  xp_max: 20,
  cooldown_seconds: 15,
};

class LevelSettingsStorage {
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
    return { ...DEFAULT_SETTINGS, ...(this.cache[guildId] || {}) };
  }

  saveSettings(guildId, settings) {
    this.cache[guildId] = { ...this.getSettings(guildId), ...settings };
    this._save();
    return this.cache[guildId];
  }
}

module.exports = new LevelSettingsStorage();
