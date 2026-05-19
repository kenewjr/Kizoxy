const fs = require("fs");
const path = require("path");

class LogStorage {
  constructor() {
    this.dataPath = path.join(__dirname, "..", "data", "logs.json");
    this.cache = new Map();
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.writeFileSync(this.dataPath, JSON.stringify({}, null, 2), "utf8");
      }
      const data = JSON.parse(fs.readFileSync(this.dataPath, "utf8"));
      for (const [guildId, channelId] of Object.entries(data)) {
        this.cache.set(guildId, channelId);
      }
    } catch (error) {
      console.error("Error initializing log storage:", error);
    }
  }

  save() {
    try {
      const data = {};
      for (const [guildId, channelId] of this.cache.entries()) {
        data[guildId] = channelId;
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      console.error("Error saving log storage:", error);
    }
  }

  getChannel(guildId) {
    return this.cache.get(guildId);
  }

  setChannel(guildId, channelId) {
    this.cache.set(guildId, channelId);
    this.save();
    return true;
  }

  removeChannel(guildId) {
    if (this.cache.has(guildId)) {
      this.cache.delete(guildId);
      this.save();
      return true;
    }
    return false;
  }
}

module.exports = LogStorage;
