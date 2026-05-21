const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: ["filter", "karaoke"],
  description: "Turning on karaoke filter",
  category: "Filter",
  run: async (client, interaction) => {
    await interaction.reply(`Loading please wait....`);

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.editReply(`No playing in this guild!`);
    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.editReply(`I'm not in the same voice channel as you!`);

    const data = {
      karaoke: {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220.0,
        filterWidth: 100.0,
      },
    };

    await player.shoukaku.setKaraoke(data);

    const karaoked = new EmbedBuilder()
      .setDescription(`\`💠\` | *Turned on:* \`karaoke\``)
      .setColor(client.color);

    await delay(5000);
    interaction.editReply({ content: " ", embeds: [karaoked] });
  },
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
