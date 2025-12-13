const fs = require("fs").promises;
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("LEVEL_STORAGE");
const JSONStorage = require("./storage");

class LevelStorage extends JSONStorage {
  constructor(filename = "levels.json") {
    super(filename);
  }

  async addXp(userId, guildId, amount) {
    if (!this.data) await this.load();

    let user = await this.getUser(userId, guildId);
    if (!user) {
      user = {
        userId,
        guildId,
        xp: 0,
        level: 0,
        lastUpdated: new Date().toISOString(),
      };
      this.data.push(user);
    }

    user.xp += amount;
    user.lastUpdated = new Date().toISOString();

    const xpToNextLevel = 5 * Math.pow(user.level, 2) + 50 * user.level + 100;
    let leveledUp = false;

    if (user.xp >= xpToNextLevel) {
      user.level++;
      user.xp -= xpToNextLevel; // Reset XP or keep accumulated? Standard usually keeps accumulated, but formula implies "XP required for NEXT level".
      // Correction: Standard formula usually calculates TOTAL XP needed.
      // If we want "XP required for next level" to be the threshold, we usually keep total XP.
      // However, usually detailed implementations store 'totalXP' and calculate level from that, OR store 'currentXP' and reset on level up.
      // Let's stick to "current XP resets on level up" model for simplicity with the provided formula as "XP needed for NEXT level".
      leveledUp = true;
    }

    await this.save();
    return { user, leveledUp, level: user.level };
  }

  async getUser(userId, guildId) {
    if (!this.data) await this.load();
    return this.data.find(
      (u) => u.userId === userId && u.guildId === guildId,
    );
  }

  async getLeaderboard(guildId) {
    if (!this.data) await this.load();
    return this.data
      .filter((u) => u.guildId === guildId)
      .sort((a, b) => b.level - a.level || b.xp - a.xp); // Sort by level desc, then XP desc
  }

  async getRank(userId, guildId) {
    const leaderboard = await this.getLeaderboard(guildId);
    const position = leaderboard.findIndex((u) => u.userId === userId) + 1;
    return position > 0 ? position : null;
  }
}

module.exports = LevelStorage;
