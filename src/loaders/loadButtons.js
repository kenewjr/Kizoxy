const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const Logger = require("../lib/logger");
const logger = new Logger("BUTTON");

module.exports = (client) => {
  client.buttons = client.buttons || new Collection();

  const buttonsDir = path.join(__dirname, "..", "interactions", "buttons");
  let totalLoaded = 0;
  let failedLoads = [];

  try {
    const entries = fs.readdirSync(buttonsDir);
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(buttonsDir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const indexFile = path.join(fullPath, "index.js");
        if (fs.existsSync(indexFile)) {
          files.push(path.join(entry, "index.js"));
        }
      } else if (entry.endsWith(".js")) {
        files.push(entry);
      }
    }

    logger.info(`Loading ${files.length} buttons...`);

    for (const file of files) {
      try {
        const filePath = path.join(buttonsDir, file);
        delete require.cache[require.resolve(filePath)];
        const btn = require(filePath);

        if (!btn) {
          throw new Error("Module exports is empty");
        }

        const key = btn.customId || btn.name;
        if (!key) {
          throw new Error("Missing 'customId' or 'name' export");
        }

        if (typeof btn.execute !== "function") {
          throw new Error("Missing 'execute' function");
        }

        client.buttons.set(key, btn);
        logger.success(`Button loaded: ${key}`);
        totalLoaded++;
      } catch (error) {
        logger.error(`Failed to load ${file}: ${error.message}`);
        failedLoads.push({ file, error: error.message });
      }
    }

    logger.info(`Total buttons loaded: ${totalLoaded}`);

    if (failedLoads.length > 0) {
      logger.warning(`${failedLoads.length} buttons failed to load:`);
      failedLoads.forEach(({ file, error }) => {
        logger.warning(`- ${file}: ${error}`);
      });
    }
  } catch (err) {
    logger.error(`Failed to read folder ${buttonsDir}: ${err.message}`);
  }
};
