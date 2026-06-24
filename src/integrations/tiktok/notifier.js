const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");

const logger = new Logger("TIKTOK");

const VIDEO_COLOR = 0x69c9d0; // TikTok cyan
const LIVE_COLOR = 0xfe2c55; // TikTok red/pink

function formatPublishTime(createTime) {
  if (!createTime) return null;
  // Provider sends unix seconds; render as a Discord relative timestamp.
  const seconds =
    typeof createTime === "number" ? createTime : Number(createTime);
  if (!Number.isFinite(seconds)) return null;
  return `<t:${Math.floor(seconds)}:R>`;
}

function buildVideoEmbed(client, { username, video, avatar }) {
  const publish = formatPublishTime(video.createTime);
  const fields = [
    {
      name: "Creator",
      value: `[@${username}](https://www.tiktok.com/@${username})`,
      inline: true,
    },
    { name: "Video", value: `[Watch on TikTok](${video.url})`, inline: true },
  ];
  if (publish) fields.push({ name: "Published", value: publish, inline: true });

  return Embeds.withColor(client, VIDEO_COLOR, {
    author: {
      name: `🎬 New TikTok Video • @${username}`,
      iconURL: avatar || undefined,
    },
    title: video.title ? video.title.slice(0, 256) : "New TikTok video",
    url: video.url,
    fields,
    image: video.cover || undefined,
  });
}

function buildLiveEmbed(client, { username, liveUrl, avatar }) {
  return Embeds.withColor(client, LIVE_COLOR, {
    author: {
      name: `🔴 TikTok Live Started • @${username}`,
      iconURL: avatar || undefined,
    },
    title: `@${username} is now LIVE!`,
    url: liveUrl,
    fields: [
      {
        name: "Creator",
        value: `[@${username}](https://www.tiktok.com/@${username})`,
        inline: true,
      },
      { name: "Live", value: `[Join the stream](${liveUrl})`, inline: true },
      {
        name: "Started",
        value: "<t:" + Math.floor(Date.now() / 1000) + ":R>",
        inline: true,
      },
    ],
    thumbnail: avatar || undefined,
  });
}

function buildLinkRow(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url),
  );
}

// Send to one subscription's channel. Guards a deleted channel (Rule L3/M1):
// never throws, logs and moves on.
async function send(client, subscription, { embed, row, content }) {
  const channel = await client.channels
    .fetch(subscription.discordChannelId)
    .catch(() => null);
  if (!channel) {
    logger.warning(
      `Announce channel ${subscription.discordChannelId} not found; skipping`,
    );
    return false;
  }
  await channel
    .send({ content, embeds: [embed], components: row ? [row] : [] })
    .catch((e) =>
      logger.error(
        `Failed to send TikTok notification to ${subscription.discordChannelId}: ${e.message}`,
      ),
    );
  return true;
}

function mentionContent(subscription, prefix) {
  if (!subscription.mentionRoleId) return undefined;
  return `<@&${subscription.mentionRoleId}>${prefix ? ` ${prefix}` : ""}`;
}

module.exports = {
  buildVideoEmbed,
  buildLiveEmbed,
  buildLinkRow,
  mentionContent,
  send,
  VIDEO_COLOR,
  LIVE_COLOR,
};
