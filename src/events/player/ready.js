const Logger = require("../../lib/logger");
const logger = new Logger("LAVALINK");

const WARMUP_SPOTIFY_QUERY = "spsearch:test warmup query";

module.exports = async (client, name, lavalinkResume, libraryResume) => {
  const resumed = !!(lavalinkResume || libraryResume);
  logger.success(
    `Node ${name}: Connected and ready!${resumed ? " (Session resumed)" : ""}`,
  );

  if (!resumed) {
    try {
      await client.manager.search(WARMUP_SPOTIFY_QUERY, {
        requester: { id: client.user?.id || "0" },
      });
      logger.debug(`Spotify plugin warm-up search completed for node ${name}.`);
    } catch (err) {
      logger.debug(
        `Spotify plugin warm-up search failed (non-critical): ${err.message}`,
      );
    }
  }
};
