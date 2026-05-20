const Logger = require("../utils/logger");
const {
  searchLyrics,
  validatePlayerForLyrics,
} = require("../services/lyrics/lyricsService");
const {
  scheduleAutoDelete,
  EPHEMERAL_ERROR_TTL_MS,
  addLyricsToNowPlaying,
  removeLyricsFromNowPlaying,
} = require("../utils/helpers/musicHelper");

const logger = new Logger("MUSIC-LYRICS");

module.exports = {
  customId: "music-lyrics",
  execute: async (interaction, client) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch((err) => {
        logger.warning(`deferReply failed: ${err?.message ?? err}`);
      });
      if (!interaction.deferred && !interaction.replied) return;
    }

    try {
      const validation = validatePlayerForLyrics(client, interaction);
      if (validation.error) {
        await interaction.editReply({ content: validation.error });
        return scheduleAutoDelete(interaction);
      }

      const { player, track } = validation;

      // Toggle lyrics state
      player.lyricsEnabled = !player.lyricsEnabled;

      if (player.lyricsEnabled) {
        // Toggle ON: fetch lyrics and append to Now Playing
        await interaction.editReply({ content: "🔍 Searching lyrics..." });

        const result = await searchLyrics(player, track, client.color);

        if (result.error) {
          // Lyrics not found — revert toggle and notify clearly
          player.lyricsEnabled = false;
          await interaction.editReply({
            content: `⚠️ Lyrics not found for **${track.title}**.\n${result.error}`,
          });
          return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
        }

        const updated = await addLyricsToNowPlaying(client, player, result.embed);
        if (!updated) {
          logger.warning("addLyricsToNowPlaying returned false");
        }

        await interaction.editReply({ content: "✅ Lyrics shown." });
        return scheduleAutoDelete(interaction);
      }

      // Toggle OFF: strip lyrics embed
      await removeLyricsFromNowPlaying(client, player);
      await interaction.editReply({ content: "✅ Lyrics hidden." });
      return scheduleAutoDelete(interaction);
    } catch (error) {
      logger.error(`Unexpected lyrics button error: ${error.message}`);
      const msg =
        error.type === "request" || error.request
          ? "❌ Could not connect to lyrics service."
          : error.response
            ? "❌ Failed to fetch lyrics. Please try again later."
            : "❌ An error occurred while fetching lyrics.";
      try {
        await interaction.editReply({ content: msg });
        return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
      } catch (_) {}
    }
  },
};
