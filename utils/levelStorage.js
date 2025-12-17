const fs = require("fs").promises;
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("LEVEL_STORAGE");
const JSONStorage = require("./storage");

class LevelStorage extends JSONStorage {
  constructor(filename = "levels.json") {
    super(filename);
    this.data = {}; // Initialize as object instead of array
  }

  // Override load to handle object structure
  async load() {
    try {
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      const content = await fs.readFile(this.filepath, "utf8");
      this.data = JSON.parse(content);
      // Ensure data is object, if not (migration from array), reset or migrate
      if (Array.isArray(this.data)) {
        logger.warning(
          "Converting old array structure to guild-indexed object",
        );
        const oldData = this.data;
        this.data = {};
        for (const user of oldData) {
          if (!this.data[user.guildId]) this.data[user.guildId] = { users: {} };
          this.data[user.guildId].users[user.userId] = user;
        }
        await this.save();
      }
      logger.info(
        `Loaded level data for ${Object.keys(this.data).length} guilds`,
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        this.data = {};
        await this.save();
        logger.info(`Created new storage file: ${this.filepath}`);
      } else {
        logger.error(`Error loading level data: ${error.message}`);
        this.data = {}; // Fallback
      }
    }
    return this.data;
  }

  async addXp(userId, guildId, amount) {
    if (
      !this.data ||
      (Object.keys(this.data).length === 0 && !this.initialized)
    ) {
      // Simple check to ensure we loaded at least once or empty
      await this.load();
      this.initialized = true;
    }

    if (!this.data[guildId]) {
      this.data[guildId] = { users: {} };
    }

    let user = this.data[guildId].users[userId];
    if (!user) {
      user = {
        userId,
        guildId,
        xp: 0,
        level: 0,
        lastUpdated: new Date().toISOString(),
      };
      this.data[guildId].users[userId] = user;
    }

    user.xp += amount;
    user.lastUpdated = new Date().toISOString();

    const xpToNextLevel = 5 * Math.pow(user.level, 2) + 50 * user.level + 100;
    let leveledUp = false;

    if (user.xp >= xpToNextLevel) {
      user.level++;
      user.xp -= xpToNextLevel; // Reset XP approach
      leveledUp = true;
    }

    await this.save();
    return { user, leveledUp, level: user.level };
  }

  async getUser(userId, guildId) {
    if (
      !this.data ||
      (Object.keys(this.data).length === 0 && !this.initialized)
    ) {
      await this.load();
      this.initialized = true;
    }
    return this.data[guildId]?.users[userId] || null;
  }

  async getLeaderboard(guildId) {
    if (
      !this.data ||
      (Object.keys(this.data).length === 0 && !this.initialized)
    ) {
      await this.load();
      this.initialized = true;
    }
    const guildData = this.data[guildId];
    if (!guildData || !guildData.users) return [];

    return Object.values(guildData.users).sort(
      (a, b) => b.level - a.level || b.xp - a.xp,
    );
  }

  async getRank(userId, guildId) {
    const leaderboard = await this.getLeaderboard(guildId);
    const position = leaderboard.findIndex((u) => u.userId === userId) + 1;
    return position > 0 ? position : null;
  }
}

module.exports = LevelStorage;
