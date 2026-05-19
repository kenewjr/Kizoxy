const {
  searchLyrics,
  validatePlayerForLyrics,
} = require("../../../services/lyrics/lyricsService");

module.exports = {
  name: ["music", "lyric"],
  description: "Toggle lyrics display (show/hide) for current song.",
  category: "Music",

  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    if (!interaction.deferred) return;

    try {
      const validation = validatePlayerForLyrics(client, interaction);
      if (validation.error) {
        return interaction.editReply({ content: validation.error });
      }

      const player = validation.player;
      
      // Toggle lyrics state
      player.lyricsEnabled = !player.lyricsEnabled;

      if (player.lyricsEnabled) {
        // Show lyrics - fetch and update now playing message
        await interaction.editReply({ content: "🔍 Mencari lyrics..." });

        const result = await searchLyrics(player, validation.track, client.color);
        
        if (result.error) {
          player.lyricsEnabled = false;
          await interaction.editReply({ content: result.error });
          
          // Delete ephemeral reply after 5 seconds
          setTimeout(async () => {
            try {
              await interaction.deleteReply();
            } catch (err) {
              // Ignore error if already deleted
            }
          }, 5000);
          return;
        }

        // Update now playing message with lyrics
        try {
          const channel = client.channels.cache.get(player.textId);
          if (channel && player.nowPlayingMessageId) {
            const message = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
            if (message) {
              const currentEmbeds = message.embeds;
              await message.edit({ 
                embeds: [...currentEmbeds, result.embed],
                components: message.components 
              });
            }
          }
        } catch (err) {
          console.error("[lyrics] Failed to update now playing:", err.message);
        }

        await interaction.editReply({ content: "✅ Lyrics ditampilkan" });
      } else {
        // Hide lyrics - remove lyrics embed from now playing message
        try {
          const channel = client.channels.cache.get(player.textId);
          if (channel && player.nowPlayingMessageId) {
            const message = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
            if (message) {
              // Keep only the first embed (now playing), remove lyrics
              const nowPlayingEmbed = message.embeds[0];
              await message.edit({ 
                embeds: nowPlayingEmbed ? [nowPlayingEmbed] : [],
                components: message.components 
              });
            }
          }
        } catch (err) {
          console.error("[lyrics] Failed to hide lyrics:", err.message);
        }

        await interaction.editReply({ content: "✅ Lyrics disembunyikan" });
      }

      // Delete ephemeral reply after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (err) {
          // Ignore error if already deleted
        }
      }, 5000);
    } catch (error) {
      console.error("[lyrics] Unexpected error:", error);
      const msg =
        error.type === "request" || error.request
          ? "❌ Could not connect to lyrics service."
          : error.response
            ? "❌ Failed to fetch lyrics. Please try again later."
            : "❌ An error occurred while fetching lyrics.";
      
      try {
        await interaction.editReply({ content: msg });
        
        // Delete ephemeral reply after 5 seconds
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (err) {
            // Ignore error if already deleted
          }
        }, 5000);
      } catch (e) {
        console.error("[lyrics] Failed to send error reply:", e.message);
      }
    }
  },
};
