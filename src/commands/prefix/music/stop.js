const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-STOP");

module.exports = {
  name: "stop",
  aliases: ["dc", "disconnect"],
  description: "Stop playback and clear the queue.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      await ctx.player.destroy();
      const embed = Embeds.brand(client, {
        description: "`⏹` | *Playback has been:* `Stopped`",
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kstop failed: ${err.message}`);
      return message.reply("❌ Failed to stop playback.");
    }
  },
};
