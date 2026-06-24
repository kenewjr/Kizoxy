const { ApplicationCommandOptionType } = require("discord.js");
const Embeds = require("../../../lib/embeds");
const { convertTime } = require("../../../lib/ConvertTime");

const EPHEMERAL_TTL_MS = 3000;

function scheduleAutoDelete(interaction) {
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, EPHEMERAL_TTL_MS);
}

module.exports = {
  name: ["music", "remove"],
  description: "Remove a song at a specific index from the queue.",
  category: "Music",
  options: [
    {
      name: "action",
      description: "What action do you want to perform?",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Remove Song 🗑️", value: "remove" },
        { name: "Clear All 📛", value: "clear" },
      ],
    },
    {
      name: "position",
      description:
        "The position in queue to remove (only for Remove Song action)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: 1,
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      await interaction.editReply({
        content: "❌ No music is currently playing.",
      });
      return scheduleAutoDelete(interaction);
    }

    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    ) {
      await interaction.editReply({
        content: "❌ You must be in the same voice channel as the bot.",
      });
      return scheduleAutoDelete(interaction);
    }

    const action = interaction.options.getString("action");

    if (action === "remove") {
      const position = interaction.options.getInteger("position");

      if (!position) {
        await interaction.editReply({
          content: "❌ Please specify the position of the song to remove.",
        });
        return scheduleAutoDelete(interaction);
      }

      if (position > player.queue.size) {
        await interaction.editReply({
          content: `❌ Song not found. The queue only has ${player.queue.size} song(s).`,
        });
        return scheduleAutoDelete(interaction);
      }

      const song = player.queue[position - 1];
      await player.queue.splice(position - 1, 1);

      const embed = Embeds.brand(client, {
        description: `**Removed • [${song.title}](${song.uri})** \`${convertTime(song.length, true)}\` • ${song.requester}`,
      });

      await interaction.editReply({ embeds: [embed] });
      return scheduleAutoDelete(interaction);
    }

    if (action === "clear") {
      if (player.queue.size === 0) {
        await interaction.editReply({
          content: "❌ The queue is already empty.",
        });
        return scheduleAutoDelete(interaction);
      }

      await player.queue.clear();

      const embed = Embeds.brand(client, {
        description: "`📛` | *Queue has been:* `Cleared`",
      });

      await interaction.editReply({ embeds: [embed] });
      return scheduleAutoDelete(interaction);
    }
  },
};
