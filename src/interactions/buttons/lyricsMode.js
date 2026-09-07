const Logger = require("../../lib/logger");
const {
  getCachedLyricsEmbed,
  validatePlayerForLyrics,
} = require("../../features/lyrics/lyricsService");
const {
  CUSTOM_ID_PREFIX,
  buildLyricsModeRow,
  parseLyricsModeCustomId,
} = require("../../features/lyrics/lyricsModeControls");
const {
  buildNowPlayingComponents,
} = require("../../features/music/musicHelper");

const logger = new Logger("LYRICS-MODE");

module.exports = {
  customId: CUSTOM_ID_PREFIX,
  execute: async (interaction, client) => {
    const control = parseLyricsModeCustomId(interaction.customId);
    if (!control) {
      return interaction.editReply({ content: "❌ Invalid lyrics control." });
    }

    if (control.scope === "cmd") {
      if (interaction.user.id !== control.ownerId) {
        return interaction.editReply({
          content: "❌ Only the command requester can change these lyrics.",
        });
      }

      const embed = getCachedLyricsEmbed(
        client,
        control.cacheKey,
        control.mode,
      );
      if (!embed) {
        return interaction.editReply({
          content: "⚠️ Lyrics expired. Run the lyrics command again.",
        });
      }

      try {
        await interaction.message.edit({
          embeds: [embed],
          components: [
            buildLyricsModeRow(control.ownerId, control.cacheKey, control.mode),
          ],
        });
        return interaction.editReply({
          content: `✅ Showing ${control.mode === "original" ? "original" : "Romaji"} lyrics.`,
        });
      } catch (error) {
        logger.error(`Failed to switch lyrics mode: ${error.message}`);
        return interaction.editReply({
          content: "❌ Failed to change lyrics mode.",
        });
      }
    }

    const validation = validatePlayerForLyrics(client, interaction);
    if (validation.error) {
      return interaction.editReply({ content: validation.error });
    }

    const { player } = validation;
    const lyricsState = player.data?.lyricsState;
    if (
      !player.lyricsEnabled ||
      player.data?.nowPlayingMessage?.id !== interaction.message.id ||
      !lyricsState?.canRomanize ||
      lyricsState.cacheKey !== control.cacheKey
    ) {
      return interaction.editReply({
        content: "⚠️ This lyrics control is no longer active.",
      });
    }

    const embed = getCachedLyricsEmbed(client, control.cacheKey, control.mode);
    if (!embed) {
      return interaction.editReply({
        content: "⚠️ Lyrics expired. Press Lyrics again.",
      });
    }

    try {
      lyricsState.mode = control.mode;
      player.data.lyricsEmbed = embed;
      await interaction.message.edit({
        embeds: [player.data.nowPlayingEmbed, embed],
        components: buildNowPlayingComponents(player),
      });
      return interaction.editReply({
        content: `✅ Showing ${control.mode === "original" ? "original" : "Romaji"} lyrics.`,
      });
    } catch (error) {
      logger.error(
        `Failed to switch Now Playing lyrics mode: ${error.message}`,
      );
      return interaction.editReply({
        content: "❌ Failed to change lyrics mode.",
      });
    }
  },
};
