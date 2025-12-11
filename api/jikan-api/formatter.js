const { EmbedBuilder } = require("discord.js");

/**
 * Format a single anime into a Discord Embed.
 * @param {Object} anime - The anime object from Jikan API.
 * @returns {EmbedBuilder}
 */
function formatAnimeEmbed(anime) {
  const embed = new EmbedBuilder()
    .setTitle(anime.title)
    .setURL(anime.url)
    .setColor("#1974d2")
    .setImage(anime.images?.jpg?.image_url)
    .addFields(
      {
        name: "⏱️ Time",
        value: anime.broadcast?.time || "Unknown",
        inline: true,
      },
      {
        name: "⭐ Score",
        value: anime.score?.toString() || "N/A",
        inline: true,
      },
      { name: "📺 Type", value: anime.type || "TV", inline: true },
      {
        name: "💿 Episodes",
        value: anime.episodes?.toString() || "?",
        inline: true,
      },
      { name: "⏳ Duration", value: anime.duration || "Unknown", inline: true },
      {
        name: "📅 Year",
        value: anime.year?.toString() || "Unknown",
        inline: true,
      },
    );

  // Synopsis (truncated to avoid limits)
  if (anime.synopsis) {
    const synopsis =
      anime.synopsis.length > 200
        ? anime.synopsis.substring(0, 197) + "..."
        : anime.synopsis;
    embed.setDescription(synopsis);
  }

  // Genres
  if (anime.genres && anime.genres.length > 0) {
    const genres = anime.genres.map((g) => g.name).join(", ");
    embed.addFields({ name: "🎭 Genres", value: genres, inline: false });
  }

  // Studios
  if (anime.studios && anime.studios.length > 0) {
    const studios = anime.studios.map((s) => s.name).join(", ");
    embed.setFooter({ text: `Studios: ${studios}` });
  }

  return embed;
}

/**
 * Chunk an array into smaller arrays of a specific size.
 * @param {Array} array
 * @param {number} size
 * @returns {Array<Array>}
 */
function chunkArray(array, size) {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

module.exports = {
  formatAnimeEmbed,
  chunkArray,
};
