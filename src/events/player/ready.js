const Logger = require("../../lib/logger");
const logger = new Logger("LAVALINK");

module.exports = async (client, name, lavalinkResume, libraryResume) => {
  const resumed = !!(lavalinkResume || libraryResume);
  logger.success(
    `Node ${name}: Connected and ready!${resumed ? " (Session resumed)" : ""}`,
  );
};
