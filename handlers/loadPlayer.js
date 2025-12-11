const { readdirSync } = require("fs");
const Logger = require("../utils/logger");
const logger = new Logger("PLAYER");

module.exports = async (client) => {
  let totalLoaded = 0;
  let failedLoads = [];

  try {
    const files = readdirSync("./events/player/").filter((file) =>
      file.endsWith(".js"),
    );
    logger.info(`Loading ${files.length} player events...`);

    files.forEach((file) => {
      try {
        const event = require(`../events/player/${file}`);
        let eventName = file.split(".")[0];
        client.manager.shoukaku.on(eventName, event.bind(null, client));
        logger.success(`Loaded event: ${eventName}`);
        totalLoaded++;
      } catch (error) {
        logger.error(`Failed to load ${file}: ${error.message}`);
        failedLoads.push({ file, error: error.message });
      }
    });

    logger.info(`Total player events loaded: ${totalLoaded}`);

    if (failedLoads.length > 0) {
      logger.warning(`${failedLoads.length} player events failed to load:`);
      failedLoads.forEach(({ file, error }) => {
        logger.warning(`- ${file}: ${error}`);
      });
    }
  } catch (e) {
    logger.error(`Error loading player events: ${e.message}`);
  }
};
