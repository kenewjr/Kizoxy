const fs = require("fs").promises;
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("STORAGE");

class JSONStorage {
  constructor(filename) {
    this.filepath = path.join(__dirname, "../data", filename);
    this.data = null;
    logger.info(`Initialized storage for: ${filename}`);
  }

  async load() {
    try {
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });
      const content = await fs.readFile(this.filepath, "utf8");
      this.data = JSON.parse(content);
      logger.info(
        `Loaded data from: ${this.filepath} (${this.data.length} items)`,
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, create empty array
        this.data = [];
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
      logger.debug(
        `Data saved to: ${this.filepath} (${this.data.length} items)`,
      );
    } catch (error) {
      logger.error(`Error saving data to ${this.filepath}: ${error.message}`);
      throw error;
    }
  }

  async getAll() {
    if (this.data === null) await this.load();
    return this.data;
  }

  async findByGuild(guildId) {
    try {
      const items = await this.getAll();
      const guildItems = items.filter((item) => item.guildId === guildId);
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
    try {
      const items = await this.getAll();
      const item = items.find((item) => item.id === id);
      if (item) {
        logger.debug(`Item retrieved: ${id}`);
      } else {
        logger.debug(`Item not found: ${id}`);
      }
      return item;
    } catch (error) {
      logger.error(`Error getting item ${id}: ${error.message}`);
      return null;
    }
  }

  async create(item) {
    try {
      const items = await this.getAll();
      items.push(item);
      this.data = items;
      await this.save();
      logger.info(`Item created: ${item.id}`);
      return item;
    } catch (error) {
      logger.error(`Error creating item: ${error.message}`);
      throw error;
    }
  }

  async update(id, updates) {
    try {
      const items = await this.getAll();
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        this.data = items;
        await this.save();
        logger.info(`Item updated: ${id}`);
        return items[index];
      }
      logger.warning(`Item not found for update: ${id}`);
      return null;
    } catch (error) {
      logger.error(`Error updating item ${id}: ${error.message}`);
      throw error;
    }
  }

  async delete(id) {
    try {
      const items = await this.getAll();
      const filtered = items.filter((item) => item.id !== id);
      this.data = filtered;
      await this.save();
      logger.info(`Item deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting item ${id}: ${error.message}`);
      throw error;
    }
  }

  async findByUser(userId) {
    try {
      const items = await this.getAll();
      const userItems = items.filter((item) => item.userId === userId);
      logger.debug(`Found ${userItems.length} items for user: ${userId}`);
      return userItems;
    } catch (error) {
      logger.error(`Error finding items for user ${userId}: ${error.message}`);
      return [];
    }
  }

  async findByGuild(guildId) {
    try {
      const items = await this.getAll();
      const guildItems = items.filter((item) => item.guildId === guildId);
      logger.debug(`Found ${guildItems.length} items for guild: ${guildId}`);
      return guildItems;
    } catch (error) {
      logger.error(
        `Error finding items for guild ${guildId}: ${error.message}`,
      );
      return [];
    }
  }

  // Method untuk sync data dengan message embed
  async syncWithMessage(alarmId, messageId, channelId) {
    try {
      const alarm = await this.get(alarmId);
      if (alarm) {
        const updatedAlarm = {
          ...alarm,
          messageId,
          embedChannelId: channelId,
        };

        await this.update(alarmId, updatedAlarm);
        logger.info(`Alarm ${alarmId} synced with message ${messageId}`);
        return updatedAlarm;
      }
      logger.warning(`Alarm not found for sync: ${alarmId}`);
      return null;
    } catch (error) {
      logger.error(`Error syncing alarm ${alarmId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = JSONStorage;
