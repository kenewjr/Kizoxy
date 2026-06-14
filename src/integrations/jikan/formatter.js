const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;

const SYNOPSIS_MAX_LENGTH = 200;

function formatAnimeEmbed(anime) {
  const fields = [
    {
      name: "⏱️ Time",
      value: anime.broadcast?.time || "Unknown",
      inline: true,
    },
    { name: "⭐ Score", value: anime.score?.toString() || "N/A", inline: true },
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
  ];

  if (anime.genres?.length > 0) {
    fields.push({
      name: "🎭 Genres",
      value: anime.genres.map((g) => g.name).join(", "),
      inline: false,
    });
  }

  const options = {
    title: anime.title,
    url: anime.url,
    image: anime.images?.jpg?.image_url,
    fields,
  };

  if (anime.synopsis) {
    options.description =
      anime.synopsis.length > SYNOPSIS_MAX_LENGTH
        ? anime.synopsis.substring(0, SYNOPSIS_MAX_LENGTH - 3) + "..."
        : anime.synopsis;
  }

  if (anime.studios?.length > 0) {
    options.footerText = `Studios: ${anime.studios.map((s) => s.name).join(", ")}`;
  }

  return Embeds.withColor(null, COLORS.ANIME, options);
}

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
