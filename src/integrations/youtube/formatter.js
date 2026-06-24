const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Embeds = require("../../lib/embeds");

const WATCH_URL = "https://www.youtube.com/watch?v=";

// Badge metadata per classification type.
const BADGES = {
  live: { label: "🔴 LIVE NOW", color: 0xff0000 },
  upcoming: { label: "📅 Upcoming Live", color: 0x3498db },
  short: { label: "📱 New Short", color: 0x9b59b6 },
  video: { label: "🎬 New Video", color: 0xff0000 },
};

function videoUrl(videoId) {
  return `${WATCH_URL}${videoId}`;
}

// Pure embed builder. Uses Embeds.withColor (per CONTEXT.md, never
// new EmbedBuilder() directly). ctx: { videoItem, type, channelTitle }.
function buildAnnouncementEmbed(client, { videoItem, type, channelTitle }) {
  const badge = BADGES[type] || BADGES.video;
  const snippet = videoItem?.snippet || {};
  const videoId = videoItem?.id;
  const url = videoUrl(videoId);

  const thumbs = snippet.thumbnails || {};
  const image =
    thumbs.maxres?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    null;

  return Embeds.withColor(client, badge.color, {
    author: {
      name: `${badge.label} • ${channelTitle || snippet.channelTitle || "YouTube"}`,
    },
    title: snippet.title || "New upload",
    url,
    description: snippet.channelTitle
      ? `**${snippet.channelTitle}** just posted on YouTube.`
      : undefined,
    image,
  });
}

function buildWatchRow(videoId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Watch on YouTube")
      .setURL(videoUrl(videoId)),
  );
}

module.exports = {
  buildAnnouncementEmbed,
  buildWatchRow,
  videoUrl,
  BADGES,
};
