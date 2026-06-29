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
const EXTERNAL_ID_RE = /"externalId":"(UC[\w-]+)"/;
const META_CHANNEL_ID_RE =
  /<meta\s+itemprop="channelId"\s+content="(UC[\w-]+)"/i;
const PAGE_TITLE_RE = /<meta property="og:title" content="([^"]+)"/i;

const RESOLVE_ERROR =
  "Couldn't find a YouTube channel for that input. Try pasting the raw Channel ID (starts with UC…, found via Share › Copy channel ID on the channel’s About page).";

function apiKey() {
  return require("../../config/config").YOUTUBE_API_KEY;
}

async function channelsList(params) {
  const key = apiKey();
  if (!key) {
    throw new Error("No YOUTUBE_API_KEY configured.");
  }
  const res = await axios.get(`${API_BASE}/channels`, {
    params: { ...params, part: "snippet", key },
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
// Also used as a fallback if the official API fails or is quota-exhausted.
async function resolveFromPageHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: YOUTUBE_HTTP_TIMEOUT_MS,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = res.data || "";

    // Try multiple patterns — YouTube markup shifts periodically
    const match =
      PAGE_CHANNEL_ID_RE.exec(html) ||
      EXTERNAL_ID_RE.exec(html) ||
      META_CHANNEL_ID_RE.exec(html);
    if (!match) {
      logger.debug(`Page scrape found no channelId pattern in ${url}`);
      return null;
    }
    const id = match[1];

    // Try API first to get clean metadata
    try {
      const byId = await channelsList({ id });
      if (byId) return byId;
    } catch (apiErr) {
      logger.warning(
        `API fallback failed during page scrape: ${apiErr.message}`,
      );
    }

    // Scrape title from metadata as a secondary fallback
    let title = id;
    const titleMatch = PAGE_TITLE_RE.exec(html);
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/ - YouTube$/i, "");
    }

    return {
      youtubeChannelId: id,
      youtubeChannelTitle: title,
    };
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

  // 1. Bare UC... ID
  if (CHANNEL_ID_RE.test(raw)) {
    logger.debug(`Strategy 1 (bare ID): ${raw}`);
    try {
      const byId = await channelsList({ id: raw });
      if (byId) return byId;
      logger.debug("Strategy 1: API returned no items");
    } catch (apiErr) {
      logger.warning(
        `API channelsList failed for ID ${raw}: ${apiErr.message}`,
      );
    }
    // Fall back to scraping channel page
    const scraped = await resolveFromPageHtml(
      `https://www.youtube.com/channel/${raw}`,
    );
    return scraped || { youtubeChannelId: raw, youtubeChannelTitle: raw };
  }

  // 2. /channel/UC... URL
  const urlIdMatch = URL_CHANNEL_ID_RE.exec(raw);
  if (urlIdMatch) {
    const id = urlIdMatch[1];
    logger.debug(`Strategy 2 (channel URL): ${id}`);
    try {
      const byId = await channelsList({ id });
      if (byId) return byId;
      logger.debug("Strategy 2: API returned no items");
    } catch (apiErr) {
      logger.warning(
        `API channelsList failed for URL ID ${id}: ${apiErr.message}`,
      );
    }
    const scraped = await resolveFromPageHtml(raw);
    return scraped || { youtubeChannelId: id, youtubeChannelTitle: id };
  }

  // 3. @handle (bare or in a URL) — channels.list?forHandle (1 unit).
  const handleMatch = HANDLE_RE.exec(raw);
  if (handleMatch) {
    logger.debug(`Strategy 3 (handle): @${handleMatch[1]}`);
    try {
      const resolved = await channelsList({ forHandle: `@${handleMatch[1]}` });
      if (resolved) return resolved;
      logger.debug("Strategy 3: API returned no items");
    } catch (apiErr) {
      logger.warning(
        `API channelsList failed for handle ${handleMatch[1]}: ${apiErr.message}`,
      );
    }
    const handleUrl = raw.startsWith("http")
      ? raw
      : `https://www.youtube.com/@${handleMatch[1]}`;
    logger.debug(`Strategy 3 fallback: scraping ${handleUrl}`);
    const scraped = await resolveFromPageHtml(handleUrl);
    if (scraped) return scraped;
    logger.debug("Strategy 3 fallback: scrape returned null");
  }

  // 4. /user/LegacyName — channels.list?forUsername (1 unit).
  const userMatch = USER_RE.exec(raw);
  if (userMatch) {
    logger.debug(`Strategy 4 (user): ${userMatch[1]}`);
    try {
      const resolved = await channelsList({ forUsername: userMatch[1] });
      if (resolved) return resolved;
      logger.debug("Strategy 4: API returned no items");
    } catch (apiErr) {
      logger.warning(
        `API channelsList failed for user ${userMatch[1]}: ${apiErr.message}`,
      );
    }
    const scraped = await resolveFromPageHtml(raw);
    if (scraped) return scraped;
  }

  // 5. /c/CustomName — scraping fallback (no official lookup).
  const customMatch = CUSTOM_RE.exec(raw);
  if (customMatch) {
    logger.debug(`Strategy 5 (custom): ${customMatch[1]}`);
    const resolved = await resolveFromPageHtml(raw);
    if (resolved) return resolved;
  }

  // 6. Nothing resolved — all strategies exhausted.
  logger.debug(`All strategies exhausted for input: ${raw}`);
  throw new Error(RESOLVE_ERROR);
}

module.exports = {
  resolveChannel,
  resolveFromPageHtml,
  RESOLVE_ERROR,
  CHANNEL_ID_RE,
};
