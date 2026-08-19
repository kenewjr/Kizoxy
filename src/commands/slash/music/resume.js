const Embeds = require("../../../lib/embeds");

module.exports = {
  name: ["music", "resume"],
  description: "Resume paused music playback.",
  category: "Music",
  run: async (client, interaction) => {
    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      await interaction.reply({
        content: "No playing in this guild!",
        ephemeral: true,
      });
      return;
    }

    const { channel } = interaction.member.voice;
    if (
      !channel ||
      interaction.member.voice.channel !==
        interaction.guild.members.me.voice.channel
    ) {
      await interaction.reply({
        content: "I'm not in the same voice channel as you!",
        ephemeral: true,
      });
      return;
    }

    if (!player.paused) {
      await interaction.reply({
        content: "❌ Playback is already playing.",
        ephemeral: true,
      });
      return;
    }

    try {
      await player.pause(false);

      const embed = Embeds.brand(client, {
        description: "`⏯` | *Song has been:* `Resumed`",
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });

      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (_err) {
          // Ignore error if already deleted
        }
      }, 5000).unref?.();
    } catch (_err) {
      await interaction.reply({
        content: "❌ Failed to resume playback.",
        ephemeral: true,
      });
    }
  },
};
