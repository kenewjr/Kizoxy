// src/interactions/buttons/lyrics.js
const Logger = require("../../lib/logger");
const {
  searchLyrics,
  validatePlayerForLyrics,
} = require("../../features/lyrics/lyricsService");
const {
  scheduleAutoDelete,
  EPHEMERAL_ERROR_TTL_MS,
  addLyricsToNowPlaying,
  removeLyricsFromNowPlaying,
  buildMusicControlRow,
  swapNowPlayingComponents,
} = require("../../features/music/musicHelper");

const logger = new Logger("MUSIC-LYRICS");

function nowPlayingControls(player, lyricsEnabled) {
  return buildMusicControlRow({
    paused: !!player.paused,
    queueLength: player.queue?.size ?? 0,
    lyricsEnabled,
  });
}

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

      player.lyricsEnabled = !player.lyricsEnabled;

      if (player.lyricsEnabled) {
        await interaction.editReply({ content: "🔍 Searching lyrics..." });

        const lyricsEmbed = await searchLyrics(track, player, client);

        if (!lyricsEmbed) {
          player.lyricsEnabled = false;
          await interaction.editReply({
            content: `⚠️ Lyrics not found for **${track.title}**.`,
          });
          return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
        }

        const updated = await addLyricsToNowPlaying(client, player, lyricsEmbed);
        if (!updated) {
          logger.warning("addLyricsToNowPlaying returned false");
        }

        await swapNowPlayingComponents(interaction, [
          nowPlayingControls(player, true),
        ]);

        await interaction.editReply({ content: "✅ Lyrics shown." });
        return scheduleAutoDelete(interaction);
      }

      await removeLyricsFromNowPlaying(client, player);
      await swapNowPlayingComponents(interaction, [
        nowPlayingControls(player, false),
      ]);
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
