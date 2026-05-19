module.exports = {
  customId: "music-pause",
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
          content: "❌ You must be in the same voice channel",
        });
      }

      // toggle pause status
      const wasPaused = player.paused;
      player.pause(!wasPaused);

      await interaction.editReply({
        content: wasPaused ? "▶️ Playback resumed" : "⏸️ Playback paused",
      });

      const nowPlayingCmd = client.commands.get("nowplaying");
      if (nowPlayingCmd) {
        await nowPlayingCmd.run(client, interaction);
      }

      // Delete ephemeral reply after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (_err) {
          // Ignore error if already deleted
        }
      }, 5000);
    } catch (error) {
      console.error("Pause Button Error:", error);
      await interaction.editReply({ content: "❌ Failed to toggle pause." });
    }
  },
};
