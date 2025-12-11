const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const Logger = require("../utils/logger");
const logger = new Logger("BUTTON");

module.exports = (client) => {
  // Pastikan client.buttons ada
  client.buttons = client.buttons || new Collection();

  const buttonsDir = path.join(__dirname, "..", "buttons");
  let totalLoaded = 0;
  let failedLoads = [];

  try {
    const files = fs.readdirSync(buttonsDir).filter((f) => f.endsWith(".js"));

    // Filter out buttons that are handled by specific commands
    const excludedButtons = ["refreshAlarms.js", "closeAlarms.js"];
    const filteredFiles = files.filter(
      (file) => !excludedButtons.includes(file),
    );

    logger.info(`Loading ${filteredFiles.length} buttons...`);

    for (const file of filteredFiles) {
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
