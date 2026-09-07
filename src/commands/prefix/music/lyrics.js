const Logger = require("../../../lib/logger");
const {
  searchLyricsForCommand,
} = require("../../../features/lyrics/lyricsService");
const {
  buildLyricsModeRow,
} = require("../../../features/lyrics/lyricsModeControls");
const {
  validateMusicContextMessage,
} = require("../../../features/music/musicHelper");

const logger = new Logger("PREFIX-LYRICS");

module.exports = {
  name: "lyrics",
  aliases: ["ly", "lyric"],
  description: "Fetch lyrics with original and Romaji modes.",
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
      const result = await searchLyricsForCommand(track, player, client);
      if (!result) {
        return loading
          .edit({ content: `⚠️ Lyrics not found for **${track.title}**.` })
          .catch(() => {});
      }

      const components = result.canRomanize
        ? [buildLyricsModeRow(message.author.id, result.cacheKey)]
        : [];

      return loading
        .edit({ content: null, embeds: [result.embed], components })
        .catch(() => {});
    } catch (err) {
      logger.error(`lyrics failed: ${err.message}`);
      return message.reply("❌ An error occurred while fetching lyrics.");
    }
  },
};
