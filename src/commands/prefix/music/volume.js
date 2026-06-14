const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-VOLUME");

const MIN_VOLUME = 1;
const MAX_VOLUME = 100;

module.exports = {
  name: "volume",
  aliases: ["vol"],
  description: "Show or set playback volume. Usage: kvolume [1-100]",
  category: "music",
  run: async (client, message, args) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      if (!args[0])
        return message.channel.send(`*Current volume:* ${player.volume}%`);

      const value = parseInt(args[0], 10);
      if (!Number.isInteger(value) || value < MIN_VOLUME || value > MAX_VOLUME)
        return message.reply(
          `❌ Please enter a number between ${MIN_VOLUME} and ${MAX_VOLUME}.`,
        );

      await player.setVolume(value);
      const embed = Embeds.brand(client, {
        description: `\`🔈\` | *Volume set to:* \`${value}%\``,
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kvolume failed: ${err.message}`);
      return message.reply("❌ Failed to set volume.");
    }
  },
};
