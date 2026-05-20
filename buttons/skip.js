const Logger = require("../utils/logger");
const {
  validateMusicContext,
  scheduleAutoDelete,
} = require("../utils/helpers/musicHelper");

const logger = new Logger("MUSIC-SKIP");

module.exports = {
  customId: "music-skip",
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

      await ctx.player.skip();

      await interaction.editReply({
        content: "⏭️ Song has been skipped.",
      });
      scheduleAutoDelete(interaction);
    } catch (error) {
      logger.error(`Skip Button Error: ${error.message}`);
      try {
        await interaction.editReply({ content: "❌ Failed to skip track." });
      } catch (_) {}
    }
  },
};
