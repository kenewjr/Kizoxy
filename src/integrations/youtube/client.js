const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");
const Logger = require("../../lib/logger");
const { YOUTUBE_HTTP_TIMEOUT_MS } = require("../../config/constants");
const { resolveChannel } = require("./channelResolver");

const logger = new Logger("YOUTUBE");

const API_BASE = "https://www.googleapis.com/youtube/v3";
// Free, no-API-key Atom feed. Polling this costs ZERO YouTube Data API quota.
const FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

// fast-xml-parser handles the CDATA / escaped-entity edge cases in the Atom
// feed for free — do not hand-roll a regex parser here.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function apiKey() {
  return require("../../config/config").YOUTUBE_API_KEY;
}

// Returns the newest feed entry as { videoId, title, publishedAt } or null.
async function fetchLatestFeedEntry(youtubeChannelId) {
  const res = await axios.get(`${FEED_BASE}${youtubeChannelId}`, {
    timeout: YOUTUBE_HTTP_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const parsed = xmlParser.parse(res.data);
  let entries = parsed?.feed?.entry;
  if (!entries) return null;
  if (!Array.isArray(entries)) entries = [entries];
  const newest = entries[0];
  if (!newest) return null;
  return {
    videoId: newest["yt:videoId"],
    title:
      typeof newest.title === "string" ? newest.title : newest.title?.["#text"],
    publishedAt: newest.published,
    author: parsed.feed?.author?.name,
  };
}

// One videos.list call (1 quota unit) — only fired on a genuinely new videoId,
// never per poll. Returns the raw item or null.
async function fetchVideoDetails(videoId) {
  const res = await axios.get(`${API_BASE}/videos`, {
    params: {
      part: "snippet,contentDetails,liveStreamingDetails",
      id: videoId,
      key: apiKey(),
    },
    timeout: YOUTUBE_HTTP_TIMEOUT_MS,
  });
  const item = res.data?.items?.[0];
  if (!item) {
    logger.warning(`videos.list returned no item for ${videoId}`);
    return null;
  }
  return item;
}

module.exports = {
  fetchLatestFeedEntry,
  fetchVideoDetails,
  resolveChannel,
};
