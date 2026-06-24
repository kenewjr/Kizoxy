const { Events } = require("discord.js");
const Logger = require("../lib/logger");
const tiktokStorage = require("../persistence/tiktokStorage");
const tiktokStateStorage = require("../persistence/tiktokStateStorage");
const TiktokScheduler = require("../integrations/tiktok/scheduler");

const logger = new Logger("TIKTOK");

module.exports = (client) => {
  try {
    client.tiktokStorage = tiktokStorage;
    client.tiktokStateStorage = tiktokStateStorage;

    const scheduler = new TiktokScheduler(client, {
      subStorage: tiktokStorage,
      stateStorage: tiktokStateStorage,
    });
    client.tiktokScheduler = scheduler;

    client.once(Events.ClientReady, async () => {
      try {
        await tiktokStorage.load();
        await tiktokStateStorage.load();
        scheduler.start();
      } catch (error) {
        logger.error(`Error starting TikTok scheduler: ${error.message}`);
      }
    });

    logger.success("TikTok notification system initialized");
  } catch (error) {
    logger.error(`Error initializing TikTok system: ${error.message}`);
  }
};
