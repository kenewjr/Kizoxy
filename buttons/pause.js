const Logger = require("../utils/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
  buildMusicControlRow,
  swapNowPlayingComponents,
} = require("../utils/helpers/musicHelper");

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

      // Toggle pause
      const wasPaused = player.paused;
      player.pause(!wasPaused);
      const isPausedNow = !wasPaused;

      // Swap only the components on the original Now Playing message;
      // do NOT regenerate the embed (avoids channel spam on repeat clicks).
      await swapNowPlayingComponents(interaction, [
        buildMusicControlRow(isPausedNow),
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
