const { readdirSync } = require("fs");
const path = require("path");
const Logger = require("../utils/logger");
const logger = new Logger("EVENT");

module.exports = async (client) => {
  let totalLoaded = 0;
  let failedLoads = [];
  const loadFromDir = (dir) => {
    const folder = path.join(__dirname, "..", "events", dir);
    let events = [];
    try {
      events = readdirSync(folder).filter((f) => f.endsWith(".js"));
    } catch (err) {
      logger.warning(`[LOAD EVENT] folder not found: ${folder}`);
      return;
    }

    for (const file of events) {
      const filePath = path.join(folder, file);
      try {
        const evt = require(filePath);
        const eName = file.split(".")[0];
        client.on(eName, evt.bind(null, client));
      } catch (err) {
        logger.error(`[LOAD EVENT] Failed to load ${dir}/${file}:`, err);
      }
    }
  };

  ["client", "guild"].forEach(loadFromDir);
  logger.info(`Total events loaded: ${totalLoaded}`);
};
