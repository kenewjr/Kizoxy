module.exports = {
  customId: "music-shuffle",
  execute: async (interaction, client) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const player = client.manager.players.get(interaction.guild.id);
      if (!player) {
        return interaction.editReply({
          content: "❌ No music is currently playing",
        });
      }

      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel || voiceChannel.id !== player.voiceId) {
        return interaction.editReply({
          content: "❌ You must be in the same voice channel as the bot",
        });
      }

      if (!player.queue || player.queue.length <= 1) {
        return interaction.editReply({
          content: "⚠️ Not enough tracks in the queue to shuffle.",
        });
      }

      player.queue.shuffle();

      await interaction.editReply({
        content: "🔀 Queue shuffled successfully.",
      });

      // Delete ephemeral reply after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (_err) {
          // Ignore error if already deleted
        }
      }, 5000);
    } catch (error) {
      console.error("Shuffle Button Error:", error);
      try {
        await interaction.editReply({
          content: "❌ Failed to shuffle the queue.",
        });
      } catch (err) {
        console.error("Shuffle Reply Error:", err);
      }
    }
  },
};
