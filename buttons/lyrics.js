// buttons/lyrics.js
// Toggle lyrics button - show/hide lyrics in now playing message

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

      const player = validation.player;

      // Toggle lyrics state
      player.lyricsEnabled = !player.lyricsEnabled;

      if (player.lyricsEnabled) {
        // Show lyrics - fetch and update now playing message
        await safeReply(interaction, { content: "🔍 Mencari lyrics..." });

        const result = await searchLyrics(
          player,
          validation.track,
          client.color,
        );

        if (result.error) {
          player.lyricsEnabled = false;
          return safeReply(interaction, { content: result.error });
        }

        // Update now playing message with lyrics
        try {
          const channel = client.channels.cache.get(player.textId);
          if (channel && player.nowPlayingMessageId) {
            const message = await channel.messages
              .fetch(player.nowPlayingMessageId)
              .catch(() => null);
            if (message) {
              const currentEmbeds = message.embeds;
              await message.edit({
                embeds: [...currentEmbeds, result.embed],
                components: message.components,
              });
            }
          }
        } catch (err) {
          console.error("[lyrics] Failed to update now playing:", err.message);
        }

        return safeReply(interaction, { content: "✅ Lyrics ditampilkan" });
      } else {
        // Hide lyrics - remove lyrics embed from now playing message
        try {
          const channel = client.channels.cache.get(player.textId);
          if (channel && player.nowPlayingMessageId) {
            const message = await channel.messages
              .fetch(player.nowPlayingMessageId)
              .catch(() => null);
            if (message) {
              // Keep only the first embed (now playing), remove lyrics
              const nowPlayingEmbed = message.embeds[0];
              await message.edit({
                embeds: nowPlayingEmbed ? [nowPlayingEmbed] : [],
                components: message.components,
              });
            }
          }
        } catch (err) {
          console.error("[lyrics] Failed to hide lyrics:", err.message);
        }

        return safeReply(interaction, { content: "✅ Lyrics disembunyikan" });
      }
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
