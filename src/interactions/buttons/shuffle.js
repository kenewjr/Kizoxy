const Logger = require("../../lib/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
} = require("../../features/music/musicHelper");

const logger = new Logger("MUSIC-SHUFFLE");

module.exports = {
  customId: "music-shuffle",
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
      if (!player.queue || player.queue.length <= 1) {
        await interaction.editReply({
          content: "⚠️ Not enough tracks in the queue to shuffle.",
        });
        return scheduleAutoDelete(interaction);
      }

      player.queue.shuffle();
      await interaction.editReply({
        content: "🔀 Queue shuffled successfully.",
      });
      scheduleAutoDelete(interaction);
    } catch (error) {
      logger.error(`Shuffle Button Error: ${error.message}`);
      try {
        await interaction.editReply({
          content: "❌ Failed to shuffle the queue.",
        });
      } catch (_) {}
    }
  },
};
