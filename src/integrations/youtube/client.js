const { XMLParser } = require("fast-xml-parser");
const Logger = require("../../lib/logger");
const { YOUTUBE_HTTP_TIMEOUT_MS } = require("../../config/constants");
const { resolveChannel } = require("./channelResolver");

const logger = new Logger("YOUTUBE");

const API_BASE = "https://www.googleapis.com/youtube/v3";
const FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function apiKey() {
  return require("../../config/config").YOUTUBE_API_KEY;
}

// Returns the newest feed entry as { videoId, title, publishedAt } or null.
async function fetchLatestFeedEntry(youtubeChannelId) {
  logger.info(`[YOUTUBE_CLIENT] Fetching latest RSS feed for channel ${youtubeChannelId}...`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${FEED_BASE}${youtubeChannelId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.text();
    const parsed = xmlParser.parse(data);
    let entries = parsed?.feed?.entry;
    if (!entries) {
      logger.warning(`[YOUTUBE_CLIENT] No RSS entries found for channel ${youtubeChannelId}`);
      return null;
    }
    if (!Array.isArray(entries)) entries = [entries];

    entries.sort((a, b) => {
      const timeA = new Date(a.published || 0).getTime();
      const timeB = new Date(b.published || 0).getTime();
      return timeB - timeA;
    });

    const newest = entries[0];
    if (!newest) return null;

    const result = {
      videoId: newest["yt:videoId"],
      title:
        typeof newest.title === "string"
          ? newest.title
          : newest.title?.["#text"],
      publishedAt: newest.published,
      author: parsed.feed?.author?.name,
    };

    logger.success(
      `[YOUTUBE_CLIENT] Fetched latest video for channel ${youtubeChannelId}: ID ${result.videoId} (${result.title})`,
    );

    return result;
  } catch (err) {
    logger.error(`[YOUTUBE_CLIENT] Failed to fetch feed for ${youtubeChannelId}: ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// One videos.list call (1 quota unit) — only fired on a genuinely new videoId,
// never per poll. Returns the raw item or null.
async function fetchVideoDetails(videoId) {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "snippet,contentDetails,liveStreamingDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey() || "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) {
      logger.warning(`videos.list returned no item for ${videoId}`);
      return null;
    }
    return item;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  fetchLatestFeedEntry,
  fetchVideoDetails,
  resolveChannel,
};
