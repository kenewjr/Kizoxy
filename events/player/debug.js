const Logger = require("../../utils/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name, info) => {
  // Only log debug info if it's meaningful
  if (typeof info === "string" && info.trim() !== "") {
    logger.debug(`Node ${name}: ${info}`);
  }
};
