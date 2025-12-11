const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

module.exports = {
  name: ["skip"],
  description: "Skips the current song or skip to a specific position.",
  category: "Music",
  options: [
    {
      name: "position",
      description:
        "The position in queue to skip to (leave empty to skip current song)",
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

    const position = interaction.options.getInteger("position");

    // If no position provided, skip to next song
    if (!position) {
      await player.skip();

      const embed = new EmbedBuilder()
        .setDescription(`\`⏭\` | *Song has been:* \`Skipped\``)
        .setColor(client.color);

      return interaction.reply({ embeds: [embed] });
    }

    // If position provided, skip to that position
    if (
      position > player.queue.size ||
      (position && !player.queue[position - 1])
    ) {
      return interaction.reply(
        `You can't skip to a song that doesn't exist! The queue only has ${player.queue.size} song(s).`,
      );
    }

    // If position is 1, just skip current song
    if (position === 1) {
      await player.skip();
    } else {
      // Remove all songs before the target position and skip
      await player.queue.splice(0, position - 1);
      await player.skip();
    }

    const embed = new EmbedBuilder()
      .setDescription(`\`⏭\` | *Skipped to position:* \`${position}\``)
      .setColor(client.color);

    return interaction.reply({ embeds: [embed] });
  },
};
