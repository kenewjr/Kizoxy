// buttons/lyrics.js
// Button handler for lyrics — delegates to shared lyricsService

const {
  searchLyrics,
  validatePlayerForLyrics,
} = require("../services/lyrics/lyricsService");

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.reply({ ...payload, ephemeral: true });
  } catch (err) {
    console.error("[lyrics] safeReply failed:", err?.message ?? err);
  }
}

module.exports = {
  customId: "music-lyrics",

  execute: async (interaction, client) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch((err) => {
        console.warn("[lyrics] deferReply failed:", err?.message ?? err);
      });
      if (!interaction.deferred && !interaction.replied) return;
    }

    try {
      const validation = validatePlayerForLyrics(client, interaction);
      if (validation.error) {
        return safeReply(interaction, { content: validation.error });
      }

      const result = await searchLyrics(validation.track, client.color);
      if (result.error) {
        return safeReply(interaction, { content: result.error });
      }

      return safeReply(interaction, { embeds: [result.embed] });
    } catch (error) {
      console.error("[lyrics] Unexpected error:", error);
      const msg =
        error.type === "request" || error.request
          ? "❌ Could not connect to lyrics service."
          : error.response
            ? "❌ Failed to fetch lyrics. Please try again later."
            : "❌ An error occurred while fetching lyrics.";
      return safeReply(interaction, { content: msg });
    }
  },
};
