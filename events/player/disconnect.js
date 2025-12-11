const Logger = require("../../utils/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name, players, moved) => {
  if (moved) {
    logger.debug(`Node ${name}: Moved to different server`);
    return;
  }

  players.map((player) => player.connection.disconnect());
  logger.warning(`Node ${name}: Disconnected from Lavalink server`);
};
