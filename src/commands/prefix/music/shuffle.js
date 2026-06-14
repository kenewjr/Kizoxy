const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-SHUFFLE");

module.exports = {
  name: "shuffle",
  aliases: ["sh"],
  description: "Shuffle the queue.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      await ctx.player.queue.shuffle();
      const embed = Embeds.brand(client, {
        description: "`🔀` | *Song has been:* `Shuffle`",
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kshuffle failed: ${err.message}`);
      return message.reply("❌ Failed to shuffle the queue.");
    }
  },
};
