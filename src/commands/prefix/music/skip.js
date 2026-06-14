const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-SKIP");

module.exports = {
  name: "skip",
  aliases: ["s", "next"],
  description: "Skip the current song.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      await ctx.player.skip();
      const embed = Embeds.brand(client, {
        description: "`⏭` | *Song has been:* `Skipped`",
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kskip failed: ${err.message}`);
      return message.reply("❌ Failed to skip the track.");
    }
  },
};
