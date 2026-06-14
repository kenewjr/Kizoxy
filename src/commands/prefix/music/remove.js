const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const { convertTime } = require("../../../lib/ConvertTime");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-REMOVE");

module.exports = {
  name: "remove",
  aliases: ["rm"],
  description:
    "Remove a song by position, or clear the queue. Usage: kremove <position|clear>",
  category: "music",
  run: async (client, message, args) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      const arg = (args[0] || "").toLowerCase();

      if (arg === "clear" || arg === "all") {
        if (player.queue.size === 0)
          return message.channel.send("❌ The queue is already empty.");
        await player.queue.clear();
        const embed = Embeds.brand(client, {
          description: "`📛` | *Queue has been:* `Cleared`",
        });
        return message.channel.send({ embeds: [embed] });
      }

      const position = parseInt(arg, 10);
      if (!Number.isInteger(position) || position < 1)
        return message.reply(
          "❌ Please specify the position of the song to remove, or `clear`.",
        );

      if (position > player.queue.size)
        return message.channel.send(
          `❌ Song not found. The queue only has ${player.queue.size} song(s).`,
        );

      const song = player.queue[position - 1];
      await player.queue.splice(position - 1, 1);

      const embed = Embeds.brand(client, {
        description: `**Removed • [${song.title}](${song.uri})** \`${convertTime(song.length, true)}\` • ${song.requester}`,
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`kremove failed: ${err.message}`);
      return message.reply("❌ Failed to remove song.");
    }
  },
};
