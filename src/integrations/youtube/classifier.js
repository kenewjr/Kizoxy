const axios = require("axios");
const Logger = require("../../lib/logger");
const {
  YOUTUBE_HTTP_TIMEOUT_MS,
  YOUTUBE_SHORT_MAX_SECONDS,
} = require("../../config/constants");

const logger = new Logger("YOUTUBE");

const SHORTS_URL = "https://www.youtube.com/shorts/";

// Parse an ISO-8601 duration (PT#H#M#S) to seconds.
function parseIsoDurationToSeconds(iso) {
  if (typeof iso !== "string") return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

// Best-effort Shorts probe: a real Short keeps you on /shorts/<id>; a regular
// video redirects to /watch. YouTube exposes no stable public "is this a Short"
// API flag, so this is best-effort, not guaranteed.
async function probeIsShort(videoId) {
  try {
    const res = await axios.get(`${SHORTS_URL}${videoId}`, {
      timeout: YOUTUBE_HTTP_TIMEOUT_MS,
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const location = res.headers?.location || "";
    if (res.status >= 300 && location.includes("/watch")) return false;
    return res.status === 200;
  } catch (err) {
    // A 303/302 to /watch surfaces here when redirects are disabled.
    const location = err.response?.headers?.location || "";
    if (location.includes("/watch")) return false;
    logger.debug(`Shorts probe inconclusive for ${videoId}: ${err.message}`);
    return null;
  }
}

// Given a videos.list item, classify as "live" | "upcoming" | "short" | "video".
async function classify(videoItem) {
  const broadcast = videoItem?.snippet?.liveBroadcastContent;
  if (broadcast === "live") return "live";
  if (broadcast === "upcoming") return "upcoming";

  const videoId = videoItem?.id;
  const probed = await probeIsShort(videoId);
  if (probed === true) return "short";
  if (probed === false) return "video";

  // Probe inconclusive — fall back to duration.
  const seconds = parseIsoDurationToSeconds(
    videoItem?.contentDetails?.duration,
  );
  if (seconds !== null && seconds <= YOUTUBE_SHORT_MAX_SECONDS) return "short";
  return "video";
}

module.exports = {
  classify,
  parseIsoDurationToSeconds,
  probeIsShort,
};
