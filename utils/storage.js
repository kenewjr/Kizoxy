const fs = require("fs").promises;
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("STORAGE");

class JSONStorage {
  constructor(filename) {
    this.filepath = path.join(__dirname, "../data", filename);
    this.data = {}; // Initialize as object
    logger.info(`Initialized storage for: ${filename}`);
  }

  async load() {
    try {
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      const content = await fs.readFile(this.filepath, "utf8");
      this.data = JSON.parse(content);
      
      // Migration: If data is Array, convert to { guildId: [items] }
      if (Array.isArray(this.data)) {
        logger.warning(`Converting ${path.basename(this.filepath)} array structure to guild-indexed object`);
        const oldData = this.data;
        this.data = {};
        for (const item of oldData) {
          // Assume item has guildId, otherwise put in 'unknown' default
          const gid = item.guildId || "global";
          if (!this.data[gid]) this.data[gid] = [];
          this.data[gid].push(item);
        }
        await this.save();
      }

      const totalItems = Object.values(this.data).reduce((acc, arr) => acc + arr.length, 0);
      logger.info(
        `Loaded data from: ${this.filepath} (${totalItems} items across ${Object.keys(this.data).length} guilds)`,
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        this.data = {};
        await this.save();
        logger.info(`Created new storage file: ${this.filepath}`);
      } else {
        logger.error(
          `Error loading data from ${this.filepath}: ${error.message}`,
        );
        throw error;
      }
    }
    return this.data;
  }

  async save() {
    try {
      await fs.writeFile(this.filepath, JSON.stringify(this.data, null, 2));
      const totalItems = this.data ? Object.values(this.data).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0) : 0;
      logger.debug(
        `Data saved to: ${this.filepath} (${totalItems} items)`,
      );
    } catch (error) {
      logger.error(`Error saving data to ${this.filepath}: ${error.message}`);
      throw error;
    }
  }

  async getAll() {
    if (this.data === null) await this.load();
    // Return all items as a flat array to maintain compatibility with some consumers if needed,
    // BUT internally we work with object. 
    // Wait, if other code expects getAll() to return array, this keeps compat.
    return Object.values(this.data).flat();
  }

  async findByGuild(guildId) {
    if (this.data === null) await this.load();
    try {
      const guildItems = this.data[guildId] || [];
      logger.debug(`Found ${guildItems.length} items for guild: ${guildId}`);
      return guildItems;
    } catch (error) {
      logger.error(
        `Error finding items for guild ${guildId}: ${error.message}`,
      );
      return [];
    }
  }

  async get(id) {
    if (this.data === null) await this.load();
    try {
      // iterate all guilds
      for (const guildId in this.data) {
        const item = this.data[guildId].find(i => i.id === id);
        if (item) {
             logger.debug(`Item retrieved: ${id}`);
             return item;
        }
      }
      logger.debug(`Item not found: ${id}`);
      return null;
    } catch (error) {
      logger.error(`Error getting item ${id}: ${error.message}`);
      return null;
    }
  }

  async create(item) {
    if (this.data === null) await this.load();
    try {
      const gid = item.guildId;
      if (!gid) throw new Error("Item missing guildId, cannot store in guild-indexed storage");
      
      if (!this.data[gid]) this.data[gid] = [];
      this.data[gid].push(item);
      
      await this.save();
      logger.info(`Item created: ${item.id}`);
      return item;
    } catch (error) {
      logger.error(`Error creating item: ${error.message}`);
      throw error;
    }
  }

  async update(id, updates) {
    if (this.data === null) await this.load();
    try {
      for (const guildId in this.data) {
        const index = this.data[guildId].findIndex(i => i.id === id);
        if (index !== -1) {
             this.data[guildId][index] = { ...this.data[guildId][index], ...updates };
             await this.save();
             logger.info(`Item updated: ${id}`);
             return this.data[guildId][index];
        }
      }
      
      logger.warning(`Item not found for update: ${id}`);
      return null;
    } catch (error) {
      logger.error(`Error updating item ${id}: ${error.message}`);
      throw error;
    }
  }

  async delete(id) {
    if (this.data === null) await this.load();
    try {
      for (const guildId in this.data) {
        const index = this.data[guildId].findIndex(i => i.id === id);
        if (index !== -1) {
             this.data[guildId].splice(index, 1);
             // If guild empty, maybe delete key? prefer keeping it for now.
             await this.save();
             logger.info(`Item deleted: ${id}`);
             return true;
        }
      }
      return false; // Not found
    } catch (error) {
      logger.error(`Error deleting item ${id}: ${error.message}`);
      throw error;
    }
  }

  async findByUser(userId) {
    if (this.data === null) await this.load();
    try {
      const allItems = Object.values(this.data).flat();
      const userItems = allItems.filter((item) => item.userId === userId);
      logger.debug(`Found ${userItems.length} items for user: ${userId}`);
      return userItems;
    } catch (error) {
      logger.error(`Error finding items for user ${userId}: ${error.message}`);
      return [];
    }
  }
  
  // Method untuk sync data dengan message embed
  async syncWithMessage(alarmId, messageId, channelId) {
    return this.update(alarmId, { messageId, embedChannelId: channelId });
  }
}

module.exports = JSONStorage;
