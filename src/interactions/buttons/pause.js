const Logger = require("../../lib/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
  buildMusicControlRow,
  swapNowPlayingComponents,
} = require("../../features/music/musicHelper");

const logger = new Logger("MUSIC-PAUSE");

module.exports = {
  customId: "music-pause",
  execute: async (interaction, client) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const ctx = validateMusicContext(client, interaction);
      if (ctx.error) {
        await interaction.editReply({ content: ctx.error });
        return scheduleAutoDelete(interaction);
      }

      const { player } = ctx;

      const wasPaused = player.paused;
      player.pause(!wasPaused);
      const isPausedNow = !wasPaused;

      await swapNowPlayingComponents(interaction, [
        buildMusicControlRow({
          paused: isPausedNow,
          queueLength: player.queue?.size ?? 0,
          lyricsEnabled: !!player.lyricsEnabled,
        }),
      ]);

      await interaction.editReply({
        content: isPausedNow
          ? "⏸️ Song has been paused."
          : "▶️ Song has been resumed.",
      });

      scheduleAutoDelete(interaction);
    } catch (error) {
      logger.error(`Pause Button Error: ${error.message}`);
      try {
        await interaction.editReply({ content: "❌ Failed to toggle pause." });
      } catch (_) {}
    }
  },
};
