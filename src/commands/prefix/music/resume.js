const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-RESUME");

module.exports = {
  name: "resume",
  aliases: ["unpause"],
  description: "Resume the current song.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      if (!player.paused) return message.channel.send("▶ Already playing.");
      await player.pause(false);
      return message.channel.send("▶ Resumed.");
    } catch (err) {
      logger.error(`kresume failed: ${err.message}`);
      return message.reply("❌ Failed to resume.");
    }
  },
};
