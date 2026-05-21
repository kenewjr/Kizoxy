const Logger = require("../../lib/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name) => {
  logger.success(`Node ${name}: Connected and ready!`);
};
