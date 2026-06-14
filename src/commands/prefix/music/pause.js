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
      await player.pause(player.playing);
      return message.channel.send(player.paused ? "⏸ Paused." : "▶ Resumed.");
    } catch (err) {
      logger.error(`kpause failed: ${err.message}`);
      return message.reply("❌ Failed to toggle pause.");
    }
  },
};
