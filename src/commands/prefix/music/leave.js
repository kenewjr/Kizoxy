const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-LEAVE");

module.exports = {
  name: "leave",
  aliases: ["fuckoff"],
  description: "Disconnect the bot from the voice channel.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const channelName = ctx.voiceChannel?.name ?? "the voice channel";
      await ctx.player.destroy();
      const embed = Embeds.brand(client, {
        description: `\`🚫\` | *Left:* | \`${channelName}\``,
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kleave failed: ${err.message}`);
      return message.reply("❌ Failed to leave the voice channel.");
    }
  },
};
