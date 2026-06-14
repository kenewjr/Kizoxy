const formatDuration = require("../../../lib/FormatDuration");
const { convertQueue } = require("../../../lib/ConvertTime");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");

const logger = new Logger("PREFIX-NP");

const PROGRESS_SEGMENTS = 30;

module.exports = {
  name: "nowplaying",
  aliases: ["np"],
  description: "Show the currently playing track.",
  category: "music",
  run: async (client, message) => {
    try {
      const player = client.manager?.players?.get(message.guild.id);
      if (!player || !player.queue?.current)
        return message.reply(
          "❌ No music is currently playing in this server.",
        );

      const song = player.queue.current;
      const currentDuration = formatDuration(player.position);
      const totalDuration = formatDuration(song.length);
      const part = Math.floor(
        (player.position / song.length) * PROGRESS_SEGMENTS,
      );
      const stateEmoji = player.playing ? "🔴 |" : "⏸ |";
      const progressBar = `\`\`\`${stateEmoji} ${"─".repeat(part) + "🎶" + "─".repeat(PROGRESS_SEGMENTS - part)}\`\`\``;

      const embed = Embeds.music(client, {
        author: {
          name: player.playing ? "Now Playing" : "Track Paused",
          iconURL: "https://cdn.discordapp.com/emojis/741605543046807626.gif",
        },
        description: `**[${song.title}](${song.uri})**`,
        thumbnail: song.thumbnail || client.user.displayAvatarURL(),
        fields: [
          { name: "Author", value: song.author || "Unknown", inline: true },
          { name: "Requester", value: `${song.requester}`, inline: true },
          { name: "Volume", value: `${player.volume}%`, inline: true },
          { name: "Queue", value: `${player.queue.length}`, inline: true },
          {
            name: "Total Duration",
            value: `${convertQueue(player, true)}`,
            inline: true,
          },
          {
            name: `Duration: \`[${currentDuration} / ${totalDuration}]\``,
            value: progressBar,
            inline: false,
          },
        ],
      });

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`knp failed: ${err.message}`);
      return message.reply("❌ Failed to fetch now playing.");
    }
  },
};
