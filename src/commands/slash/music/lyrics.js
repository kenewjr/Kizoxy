const Logger = require("../../../lib/logger");
const {
  searchLyricsForCommand,
  validatePlayerForLyrics,
} = require("../../../features/lyrics/lyricsService");
const {
  buildLyricsModeRow,
} = require("../../../features/lyrics/lyricsModeControls");
const {
  scheduleAutoDelete,
  EPHEMERAL_ERROR_TTL_MS,
} = require("../../../features/music/musicHelper");

const logger = new Logger("MUSIC-LYRICS");

module.exports = {
  name: ["music", "lyric"],
  description: "Search lyrics with original and Romaji modes.",
  category: "Music",

  run: async (client, interaction) => {
    await interaction.deferReply().catch(() => {});
    if (!interaction.deferred) return;

    try {
      const validation = validatePlayerForLyrics(client, interaction);
      if (validation.error) {
        await interaction.editReply({ content: validation.error });
        return scheduleAutoDelete(interaction);
      }

      const { player, track } = validation;
      await interaction.editReply({ content: "🔍 Searching lyrics..." });

      const result = await searchLyricsForCommand(track, player, client);
      if (!result) {
        await interaction.editReply({
          content: `⚠️ Lyrics not found for **${track.title}**.`,
        });
        return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
      }

      const components = result.canRomanize
        ? [buildLyricsModeRow(interaction.user.id, result.cacheKey)]
        : [];

      return interaction.editReply({
        content: null,
        embeds: [result.embed],
        components,
      });
    } catch (error) {
      logger.error(`Unexpected lyrics command error: ${error.message}`);
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
