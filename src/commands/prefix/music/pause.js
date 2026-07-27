const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-PAUSE");

module.exports = {
  name: "pause",
  aliases: ["resume"],
  description: "Toggle pause/resume for the current song.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      if (player.paused) {
        return message.reply("❌ Playback is already paused.");
      }
      await player.pause(true);
      return message.channel.send("⏸ Paused.");
    } catch (err) {
      logger.error(`kpause failed: ${err.message}`);
      return message.reply("❌ Failed to pause.");
    }
  },
};
