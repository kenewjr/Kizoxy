const fs = require("fs").promises;
const path = require("path");
const Logger = require("../lib/logger");
const logger = new Logger("STORAGE");

const SAVE_DELAY_MS = 500;
const ASYNC_STRINGIFY_GUILD_THRESHOLD = 256;

class JSONStorage {
  constructor(filename) {
    this.filepath = path.join(__dirname, "../../data", filename);
    this.backupPath = `${this.filepath}.bak`;
    this.tmpPath = `${this.filepath}.tmp`;
    this.data = {};
    this._isLoaded = false;
    this._loadPromise = null;
    this._saveTimer = null;
    this._savePending = false;
    this._saveDelayMs = SAVE_DELAY_MS;
    this._saveInFlight = null;

    logger.info(`Initialized storage for: ${filename}`);
  }

  async _ensureLoaded() {
    if (this._isLoaded) return;
    if (!this._loadPromise) this._loadPromise = this.load();
    await this._loadPromise;
  }

  scheduleSave() {
    this._savePending = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      if (this._savePending) {
        this._savePending = false;
        this.save().catch((err) => {
          logger.error(`Scheduled save failed: ${err.message}`);
        });
      }
    }, this._saveDelayMs);
    if (this._saveTimer.unref) this._saveTimer.unref();
  }

  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._savePending) {
      this._savePending = false;
      await this.save();
    }
    if (this._saveInFlight) {
      try {
        await this._saveInFlight;
      } catch {
        // Already logged inside _writeAtomic.
      }
    }
  }

  async load() {
    try {
      await fs.mkdir(path.dirname(this.filepath), { recursive: true });

      try {
        const content = await fs.readFile(this.filepath, "utf8");
        this.data = JSON.parse(content);
      } catch (err) {
        if (err.code === "ENOENT") throw err; // bootstrap path below
        logger.warning(
          `Primary read/parse failed for ${this.filepath} (${err.message}); attempting .bak recovery`,
        );
        try {
          const bakContent = await fs.readFile(this.backupPath, "utf8");
          this.data = JSON.parse(bakContent);
          await fs.writeFile(this.filepath, bakContent);
          logger.warning(`Recovered ${this.filepath} from .bak`);
        } catch (bakErr) {
          logger.error(
            `Backup recovery failed for ${this.filepath}: ${bakErr.message}`,
          );
          throw err; // surface the original load error
        }
      }

      const totalItems = Object.values(this.data).reduce(
        (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
      logger.info(
        `Loaded data from: ${this.filepath} (${totalItems} items across ${Object.keys(this.data).length} guilds)`,
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        this.data = {};
        await this._writeAtomic(this.data);
        logger.info(`Created new storage file: ${this.filepath}`);
      } else {
        logger.error(
          `Error loading data from ${this.filepath}: ${error.message}`,
        );
        throw error;
      }
    }
    this._isLoaded = true;
    return this.data;
  }

  async save() {
    const next = (this._saveInFlight || Promise.resolve()).then(() =>
      this._writeAtomic(this.data),
    );
    this._saveInFlight = next.catch(() => {});
    return next;
  }

  async _writeAtomic(data) {
    let json;
    try {
      json = await this._stringify(data);
    } catch (error) {
      logger.error(
        `Error serializing data for ${this.filepath}: ${error.message}`,
      );
      throw error;
    }

    try {
      await fs.copyFile(this.filepath, this.backupPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        logger.warning(
          `Backup rotation failed for ${this.filepath}: ${err.message}`,
        );
      }
    }

    try {
      await fs.writeFile(this.tmpPath, json);
      await fs.rename(this.tmpPath, this.filepath);

      const totalItems =
        data && typeof data === "object"
          ? Object.values(data).reduce(
              (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
              0,
            )
          : 0;
      logger.debug(`Data saved to: ${this.filepath} (${totalItems} items)`);
    } catch (error) {
      logger.error(`Error saving data to ${this.filepath}: ${error.message}`);
      fs.unlink(this.tmpPath).catch(() => {});
      throw error;
    }
  }

  async _stringify(data) {
    const guildCount =
      data && typeof data === "object" ? Object.keys(data).length : 0;
    if (guildCount >= ASYNC_STRINGIFY_GUILD_THRESHOLD) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return JSON.stringify(data, null, 2);
  }

  // ── Reads ───────────────────────────────────────────────────────

  async getAll() {
    await this._ensureLoaded();
    return Object.values(this.data).flat();
  }

  async findByGuild(guildId) {
    await this._ensureLoaded();
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
    await this._ensureLoaded();
    try {
      for (const guildId in this.data) {
        const arr = this.data[guildId];
        if (!Array.isArray(arr)) continue;
        const item = arr.find((i) => i.id === id);
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

  async findByUser(userId) {
    await this._ensureLoaded();
    try {
      const userItems = [];
      for (const guildId in this.data) {
        const arr = this.data[guildId];
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (item.userId === userId) userItems.push(item);
        }
      }
      logger.debug(`Found ${userItems.length} items for user: ${userId}`);
      return userItems;
    } catch (error) {
      logger.error(`Error finding items for user ${userId}: ${error.message}`);
      return [];
    }
  }

  // ── Writes ──────────────────────────────────────────────────────

  async create(item) {
    await this._ensureLoaded();
    try {
      const gid = item.guildId;
      if (!gid)
        throw new Error(
          "Item missing guildId, cannot store in guild-indexed storage",
        );

      if (!this.data[gid]) this.data[gid] = [];
      this.data[gid].push(item);

      this.scheduleSave();
      logger.info(`Item created: ${item.id}`);
      return item;
    } catch (error) {
      logger.error(`Error creating item: ${error.message}`);
      throw error;
    }
  }

  async update(id, updates) {
    await this._ensureLoaded();
    try {
      for (const guildId in this.data) {
        const arr = this.data[guildId];
        if (!Array.isArray(arr)) continue;
        const index = arr.findIndex((i) => i.id === id);
        if (index !== -1) {
          arr[index] = { ...arr[index], ...updates };
          this.scheduleSave();
          logger.info(`Item updated: ${id}`);
          return arr[index];
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
    await this._ensureLoaded();
    try {
      for (const guildId in this.data) {
        const arr = this.data[guildId];
        if (!Array.isArray(arr)) continue;
        const index = arr.findIndex((i) => i.id === id);
        if (index !== -1) {
          arr.splice(index, 1);
          this.scheduleSave();
          logger.info(`Item deleted: ${id}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting item ${id}: ${error.message}`);
      throw error;
    }
  }

  async syncWithMessage(alarmId, messageId, channelId) {
    return this.update(alarmId, { messageId, embedChannelId: channelId });
  }
}

module.exports = JSONStorage;
