const Logger = require("../../lib/logger");
const {
  searchLyricsForNowPlaying,
  validatePlayerForLyrics,
} = require("../../features/lyrics/lyricsService");
const {
  scheduleAutoDelete,
  EPHEMERAL_ERROR_TTL_MS,
  buildNowPlayingComponents,
} = require("../../features/music/musicHelper");

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
      if (player.data?.nowPlayingMessage?.id !== interaction.message.id) {
        await interaction.editReply({
          content: "⚠️ This Now Playing message is no longer active.",
        });
        return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
      }
      player.lyricsEnabled = !player.lyricsEnabled;

      if (player.lyricsEnabled) {
        await interaction.editReply({ content: "🔍 Searching lyrics..." });
        const fetchToken = (player._lyricsFetchToken || 0) + 1;
        player._lyricsFetchToken = fetchToken;
        const result = await searchLyricsForNowPlaying(track, player, client);

        if (
          player._lyricsFetchToken !== fetchToken ||
          !player.lyricsEnabled ||
          player.queue?.current !== track
        ) {
          return scheduleAutoDelete(interaction);
        }

        if (!result) {
          player.lyricsEnabled = false;
          player.data.lyricsState = null;
          await interaction.editReply({
            content: `⚠️ Lyrics not found for **${track.title}**.`,
          });
          return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
        }

        const nowPlayingMessage = player.data?.nowPlayingMessage;
        const nowPlayingEmbed = player.data?.nowPlayingEmbed;
        if (
          !nowPlayingMessage ||
          !nowPlayingEmbed ||
          nowPlayingMessage.id !== interaction.message.id
        ) {
          player.lyricsEnabled = false;
          player.data.lyricsState = null;
          await interaction.editReply({
            content: "⚠️ This Now Playing message is no longer active.",
          });
          return scheduleAutoDelete(interaction, EPHEMERAL_ERROR_TTL_MS);
        }

        player.data.lyricsState = {
          cacheKey: result.cacheKey,
          canRomanize: result.canRomanize,
          mode: "romaji",
        };
        player.data.lyricsEmbed = result.embed;
        await nowPlayingMessage.edit({
          embeds: [nowPlayingEmbed, result.embed],
          components: buildNowPlayingComponents(player),
        });
        await interaction.editReply({ content: "✅ Lyrics shown." });
        return scheduleAutoDelete(interaction);
      }

      player._lyricsFetchToken = (player._lyricsFetchToken || 0) + 1;
      player.data.lyricsState = null;
      player.data.lyricsEmbed = null;
      const nowPlayingMessage = player.data?.nowPlayingMessage;
      const nowPlayingEmbed = player.data?.nowPlayingEmbed;
      if (
        nowPlayingMessage &&
        nowPlayingEmbed &&
        nowPlayingMessage.id === interaction.message.id
      ) {
        await nowPlayingMessage.edit({
          embeds: [nowPlayingEmbed],
          components: buildNowPlayingComponents(player, {
            lyricsEnabled: false,
          }),
        });
      }
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
