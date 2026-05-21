const Logger = require("../../lib/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name, error) => {
  logger.error(`Node ${name}: Error occurred - ${error.message || error}`);

  if (error.stack) {
    logger.debug(`Stack trace: ${error.stack}`);
  }
};
