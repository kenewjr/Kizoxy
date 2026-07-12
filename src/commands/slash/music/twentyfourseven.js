const Embeds = require("../../../lib/embeds");

module.exports = {
  name: ["music", "twentyfourseven"],
  description: "Keep the bot in the voice channel permanently, even if empty.",
  category: "Music",
  run: async (client, interaction) => {
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply(`No playing in this guild!`);
    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    )
      return interaction.reply(`I'm not in the same voice channel as you!`);

    if (player.data.get("stay")) {
      await player.data.set("stay", false);

      const embed = Embeds.brand(client, {
        description: "`🌙` | *Mode 24/7 has been:* `Deactivated`",
      });

      return interaction.reply({ embeds: [embed] });
    } else {
      await player.data.set("stay", true);

      const embed = Embeds.brand(client, {
        description: "`🌕` | *Mode 24/7 has been:* `Activated`",
      });

      return interaction.reply({ embeds: [embed] });
    }
  },
};
