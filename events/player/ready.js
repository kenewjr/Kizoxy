const Logger = require("../../utils/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name) => {
  logger.success(`Node ${name}: Connected and ready!`);
};
