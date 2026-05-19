const { readdirSync } = require("fs");
const Logger = require("../utils/logger");
const logger = new Logger("TRACK");

module.exports = async (client) => {
  let totalLoaded = 0;
  let failedLoads = [];

  try {
    const files = readdirSync("./events/track/").filter((file) =>
      file.endsWith(".js"),
    );
    logger.info(`Loading ${files.length} track events...`);

    files.forEach((file) => {
      try {
        const event = require(`../events/track/${file}`);
        let eventName = file.split(".")[0];
        client.manager.on(eventName, event.bind(null, client));
        logger.success(`Loaded event: ${eventName}`);
        totalLoaded++;
      } catch (error) {
        logger.error(`Failed to load ${file}: ${error.message}`);
        failedLoads.push({ file, error: error.message });
      }
    });

    logger.info(`Total track events loaded: ${totalLoaded}`);

    if (failedLoads.length > 0) {
      logger.warning(`${failedLoads.length} track events failed to load:`);
      failedLoads.forEach(({ file, error }) => {
        logger.warning(`- ${file}: ${error}`);
      });
    }
  } catch (e) {
    logger.error(`Error loading track events: ${e.message}`);
  }
};
