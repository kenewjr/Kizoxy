const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: ["music", "shuffle"],
  description: "Shuffle song in queue!",
  category: "Music",
  run: async (client, interaction) => {
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      await interaction.reply({ content: "No playing in this guild!", ephemeral: true });
      return;
    }

    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    ) {
      await interaction.reply({ content: "I'm not in the same voice channel as you!", ephemeral: true });
      return;
    }

    await player.queue.shuffle();

    const embed = new EmbedBuilder()
      .setDescription(`\`🔀\` | *Song has been:* \`Shuffle\``)
      .setColor(client.color);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Delete ephemeral reply after 5 seconds
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (err) {
        // Ignore error if already deleted
      }
    }, 5000);
  },
};
