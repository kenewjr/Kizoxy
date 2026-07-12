const formatDuration = require("../../../lib/FormatDuration");
const { convertQueue } = require("../../../lib/ConvertTime");
const Embeds = require("../../../lib/embeds");
const { replyError, safeReply } = require("../../../lib/interactions");

module.exports = {
  name: ["nowplaying"],
  description: "Show progress bar and info for the current song.",
  category: "Music",
  run: async (client, interaction) => {
    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue?.current) {
      return replyError(
        interaction,
        "No music is currently playing in this server.",
      );
    }

    const song = player.queue.current;
    const currentDuration = formatDuration(player.position);
    const totalDuration = formatDuration(song.length);
    const part = Math.floor((player.position / song.length) * 30);
    const stateEmoji = player.playing ? "🔴 |" : "⏸ |";
    const progressBar = `\`\`\`${stateEmoji} ${"─".repeat(part) + "🎶" + "─".repeat(30 - part)}\`\`\``;

    const embed = Embeds.music(client, {
      author: {
        name: player.playing ? "Now Playing" : "Track Paused",
        iconURL: "https://cdn.discordapp.com/emojis/741605543046807626.gif",
      },
      description: `**[${song.title}](${song.uri})**`,
      thumbnail: song.thumbnail || client.user.displayAvatarURL(),
      fields: [
        {
          name: "Author",
          value: song.author || "Unknown",
          inline: true,
        },
        { name: "Requester", value: `${song.requester}`, inline: true },
        { name: "Volume", value: `${player.options.volume}%`, inline: true },
        { name: "Queue", value: `${player.queue.length}`, inline: true },
        {
          name: "Total Duration",
          value: `${convertQueue(player, true)}`,
          inline: true,
        },
        {
          name: "Download",
          value: `**[Click here](https://www.mp3fromlink.com/watch?v=${song.identifier})**`,
          inline: true,
        },
        {
          name: `Duration: \`[${currentDuration} / ${totalDuration}]\``,
          value: progressBar,
          inline: false,
        },
      ],
    });

    return safeReply(interaction, { embeds: [embed] });
  },
};
