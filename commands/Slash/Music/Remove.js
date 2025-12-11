const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { convertTime } = require("../../../structures/ConvertTime.js");

module.exports = {
  name: ["music", "remove"],
  description: "Remove or clear songs from queue!",
  category: "Music",
  options: [
    {
      name: "action",
      description: "What action do you want to perform?",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: "Remove Song 🗑️",
          value: "remove",
        },
        {
          name: "Clear All 📛",
          value: "clear",
        },
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
    // Check if player exists
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply(`No playing in this guild!`);

    // Check if user is in same voice channel
    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.reply(`I'm not in the same voice channel as you!`);

    const action = interaction.options.getString("action");

    if (action === "remove") {
      // Remove specific song from queue
      const position = interaction.options.getInteger("position");

      if (!position) {
        return interaction.reply(
          `Please specify the position of the song you want to remove!`,
        );
      }

      if (position > player.queue.size) {
        return interaction.reply(
          `Song not found. The queue only has ${player.queue.size} song(s).`,
        );
      }

      const song = player.queue[position - 1];
      await player.queue.splice(position - 1, 1);

      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription(
          `**Removed • [${song.title}](${song.uri})** \`${convertTime(song.length, true)}\` • ${song.requester}`,
        );

      return interaction.reply({ embeds: [embed] });
    } else if (action === "clear") {
      // Clear entire queue
      if (player.queue.size === 0) {
        return interaction.reply(`The queue is already empty!`);
      }

      await player.queue.clear();

      const embed = new EmbedBuilder()
        .setDescription("`📛` | *Queue has been:* `Cleared`")
        .setColor(client.color);

      return interaction.reply({ embeds: [embed] });
    }
  },
};
