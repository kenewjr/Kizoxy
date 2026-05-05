const {
  searchLyrics,
  validatePlayerForLyrics,
} = require("../../../services/lyrics/lyricsService");

module.exports = {
  name: ["music", "lyric"],
  description: "Display lyrics of a song.",
  category: "Music",

  run: async (client, interaction) => {
    await interaction.deferReply().catch(() => {});
    if (!interaction.deferred) return;

    try {
      const validation = validatePlayerForLyrics(client, interaction);
      if (validation.error) {
        return interaction.editReply({ content: validation.error });
      }

      const result = await searchLyrics(validation.track, client.color);
      if (result.error) {
        return interaction.editReply({ content: result.error });
      }

      return interaction.editReply({ embeds: [result.embed] });
    } catch (error) {
      console.error("[lyrics] Unexpected error:", error);
      const msg =
        error.type === "request" || error.request
          ? "❌ Could not connect to lyrics service."
          : error.response
            ? "❌ Failed to fetch lyrics. Please try again later."
            : "❌ An error occurred while fetching lyrics.";
      try {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ content: msg }).catch(() => {});
        } else {
          return interaction
            .reply({ content: msg, ephemeral: true })
            .catch(() => {});
        }
      } catch (e) {
        console.error("[lyrics] Failed to send error reply:", e.message);
      }
    }
  },
};
