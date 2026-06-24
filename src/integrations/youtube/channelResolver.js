const axios = require("axios");
const Logger = require("../../lib/logger");
const { YOUTUBE_HTTP_TIMEOUT_MS } = require("../../config/constants");

const logger = new Logger("YOUTUBE");

const API_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNEL_ID_RE = /^UC[\w-]{22}$/;
const URL_CHANNEL_ID_RE = /\/channel\/(UC[\w-]{22})/;
const HANDLE_RE = /(?:youtube\.com\/)?@([\w.-]+)/i;
const USER_RE = /\/user\/([\w-]+)/i;
const CUSTOM_RE = /\/c\/([\w-]+)/i;
const PAGE_CHANNEL_ID_RE = /"channelId":"(UC[\w-]+)"/;

const RESOLVE_ERROR =
  "Couldn't find a YouTube channel for that input. Try the full channel URL instead.";

function apiKey() {
  return require("../../config/config").YOUTUBE_API_KEY;
}

async function channelsList(params) {
  const res = await axios.get(`${API_BASE}/channels`, {
    params: { ...params, part: "snippet", key: apiKey() },
    timeout: YOUTUBE_HTTP_TIMEOUT_MS,
  });
  const item = res.data?.items?.[0];
  if (!item) return null;
  return {
    youtubeChannelId: item.id,
    youtubeChannelTitle: item.snippet?.title || item.id,
  };
}

// Scraping fallback: YouTube exposes no cheap API for legacy /c/ custom URLs.
// Isolated so it's trivial to find/replace if an official endpoint appears.
async function resolveFromPageHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: YOUTUBE_HTTP_TIMEOUT_MS,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const match = PAGE_CHANNEL_ID_RE.exec(res.data || "");
    if (!match) return null;
    const id = match[1];
    // Fetch the title via the cheap API now that we have the ID.
    const byId = await channelsList({ id });
    return byId || { youtubeChannelId: id, youtubeChannelTitle: id };
  } catch (err) {
    logger.warning(`Page scrape resolve failed for ${url}: ${err.message}`);
    return null;
  }
}

// Resolution order (cheapest first). Returns
// { youtubeChannelId, youtubeChannelTitle } or throws Error(RESOLVE_ERROR).
async function resolveChannel(input) {
  const raw = (input || "").trim();
  if (!raw) throw new Error(RESOLVE_ERROR);

  // 1. Bare UC... ID — no API call.
  if (CHANNEL_ID_RE.test(raw)) {
    const byId = await channelsList({ id: raw });
    return byId || { youtubeChannelId: raw, youtubeChannelTitle: raw };
  }

  // 2. /channel/UC... URL — extract directly, no API call for the ID.
  const urlIdMatch = URL_CHANNEL_ID_RE.exec(raw);
  if (urlIdMatch) {
    const id = urlIdMatch[1];
    const byId = await channelsList({ id });
    return byId || { youtubeChannelId: id, youtubeChannelTitle: id };
  }

  // 3. @handle (bare or in a URL) — channels.list?forHandle (1 unit).
  const handleMatch = HANDLE_RE.exec(raw);
  if (handleMatch) {
    const resolved = await channelsList({ forHandle: `@${handleMatch[1]}` });
    if (resolved) return resolved;
  }

  // 4. /user/LegacyName — channels.list?forUsername (1 unit).
  const userMatch = USER_RE.exec(raw);
  if (userMatch) {
    const resolved = await channelsList({ forUsername: userMatch[1] });
    if (resolved) return resolved;
  }

  // 5. /c/CustomName — scraping fallback (no official lookup).
  const customMatch = CUSTOM_RE.exec(raw);
  if (customMatch) {
    const resolved = await resolveFromPageHtml(raw);
    if (resolved) return resolved;
  }

  // 6. Nothing resolved.
  throw new Error(RESOLVE_ERROR);
}

module.exports = {
  resolveChannel,
  resolveFromPageHtml,
  RESOLVE_ERROR,
  CHANNEL_ID_RE,
};
