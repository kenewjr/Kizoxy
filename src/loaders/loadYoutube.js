const { Events } = require("discord.js");
const Logger = require("../lib/logger");
const youtubeStorage = require("../persistence/youtubeStorage");
const youtubeStateStorage = require("../persistence/youtubeStateStorage");
const YoutubeScheduler = require("../integrations/youtube/scheduler");

const logger = new Logger("YOUTUBE");

module.exports = (client) => {
  try {
    client.youtubeStorage = youtubeStorage;
    client.youtubeStateStorage = youtubeStateStorage;

    const { YOUTUBE_API_KEY } = client.config;
    if (!YOUTUBE_API_KEY) {
      // Optional subsystem: the rest of the bot must still boot normally.
      logger.warning(
        "YOUTUBE_API_KEY not set — YouTube notifications disabled (scheduler not started).",
      );
      return;
    }

    const scheduler = new YoutubeScheduler(client, {
      subStorage: youtubeStorage,
      stateStorage: youtubeStateStorage,
    });
    client.youtubeScheduler = scheduler;

    client.once(Events.ClientReady, async () => {
      try {
        await youtubeStorage.load();
        await youtubeStateStorage.load();
        scheduler.start();
      } catch (error) {
        logger.error(`Error starting YouTube scheduler: ${error.message}`);
      }
    });

    logger.success("YouTube notification system initialized");
  } catch (error) {
    logger.error(`Error initializing YouTube system: ${error.message}`);
  }
};
