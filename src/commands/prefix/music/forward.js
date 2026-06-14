const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const formatDuration = require("../../../lib/FormatDuration");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-FORWARD");

const DEFAULT_FORWARD_SECONDS = 10;

module.exports = {
  name: "forward",
  aliases: ["fw", "seek"],
  description: "Fast-forward the current song. Usage: kforward [seconds]",
  category: "music",
  run: async (client, message, args) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      const song = player.queue.current;
      if (!song) return message.channel.send("❌ Nothing is playing.");

      let seconds = DEFAULT_FORWARD_SECONDS;
      if (args[0]) {
        const parsed = parseInt(args[0], 10);
        if (!Number.isInteger(parsed) || parsed < 1)
          return message.reply("❌ Please enter a positive number of seconds.");
        seconds = parsed;
      }

      const target = player.position + seconds * 1000;
      if (target >= song.length)
        return message.channel.send(
          "❌ You can't forward past the end of the song.",
        );

      await player.seek(target);
      const embed = Embeds.brand(client, {
        description: `\`⏭\` | *Forward to:* \`${formatDuration(target)}\``,
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kforward failed: ${err.message}`);
      return message.reply("❌ Failed to forward the track.");
    }
  },
};
