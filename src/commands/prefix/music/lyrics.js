const Logger = require("../../../lib/logger");
const { searchLyrics } = require("../../../features/lyrics/lyricsService");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-LYRICS");

module.exports = {
  name: "lyrics",
  aliases: ["ly", "lyric"],
  description: "Fetch lyrics for the current song.",
  category: "music",
  run: async (client, message) => {
    const ctx = validateMusicContextMessage(client, message);
    if (ctx.error) return message.reply(ctx.error);

    try {
      const { player } = ctx;
      const track = player.queue?.current;
      if (!track)
        return message.channel.send("❌ No track is currently loaded.");

      const loading = await message.channel.send("🔍 Searching lyrics...");

      const lyricsEmbed = await searchLyrics(track, player, client);
      if (!lyricsEmbed) {
        return loading
          .edit({ content: `⚠️ Lyrics not found for **${track.title}**.` })
          .catch(() => {});
      }

      return loading
        .edit({ content: " ", embeds: [lyricsEmbed] })
        .catch(() => {});
    } catch (err) {
      logger.error(`klyrics failed: ${err.message}`);
      return message.reply("❌ An error occurred while fetching lyrics.");
    }
  },
};
