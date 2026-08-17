const Logger = require("../../lib/logger");
const scraper = require("../scraperService/client");

const logger = new Logger("TIKTOK");

class TiktokAccountNotFoundError extends Error {
  constructor(username) {
    super(`TikTok account @${username} not found`);
    this.name = "TiktokAccountNotFoundError";
    this.code = "ACCOUNT_NOT_FOUND";
  }
}

function isConfigured() {
  return true;
}

// Validates TikTok video Snowflake ID: 15-22 digit numeric string (e.g. 7384910293847561829)
function isValidTikTokId(id) {
  if (!id) return false;
  const str = String(id).trim();
  return /^\d{15,22}$/.test(str);
}

// Transform scraper posts -> bot video format with strict ID validation & repost filtering.
function _mapPost(username, post) {
  const id = String(post.id || "").trim();
  if (!isValidTikTokId(id)) {
    logger.warning(
      `[TIKTOK] Ignored invalid TikTok video ID: "${id}" for @${username}`,
    );
    return null;
  }

  // Filter out reposts
  const isRepost = Boolean(
    post.is_repost ||
    post.isRepost ||
    post.repost ||
    post.is_reposted ||
    post.item_type === 2 ||
    post.type === "repost",
  );
  if (isRepost) {
    logger.debug(
      `[TIKTOK] [REPOST_IGNORED] Ignored reposted video ${id} for @${username}`,
    );
    return null;
  }

  return {
    id,
    type: "video",
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    cover: post.cover_url || post.cover || null,
    images: [],
    title: post.desc || post.title || "",
    createTime: post.create_time || post.createTime || null,
    isLive: false,
  };
}

// Track scraper call stats.
const _serviceStats = { calls: 0, successes: 0, failures: 0 };

function getStrategyStats() {
  const serviceSt = scraper.getServiceStatus();
  const { calls, successes } = _serviceStats;
  const pct = calls > 0 ? Math.round((successes / calls) * 100) : 100;
  const isHealthy = serviceSt.status !== "Offline" && (calls < 5 || pct >= 50);

  return {
    window: 100,
    total_recorded: calls,
    primary_strategy: "kizoxy-scraper",
    service_status: serviceSt.status,
    primary_healthy: isHealthy,
    primary_pct: pct,
    warning_banner: !isHealthy
      ? `⚠️ Scraper service (${serviceSt.status}) success rate: ${pct}% — TikTok notifications may be delayed. Check kizoxy-scraper microservice.`
      : null,
    breakdown: { "kizoxy-scraper": { count: successes, pct } },
  };
}

function _recordSuccess() {
  _serviceStats.calls = Math.min(_serviceStats.calls + 1, 200);
  _serviceStats.successes = Math.min(_serviceStats.successes + 1, 200);
}
function _recordFailure() {
  _serviceStats.calls = Math.min(_serviceStats.calls + 1, 200);
  _serviceStats.failures = Math.min(_serviceStats.failures + 1, 200);
}

// Main entry point — matches fetchProfile(username) signature.
async function fetchProfile(username) {
  // Match resolver.js's normalizeUsername() so a manual /tiktok check on
  // "@SomeUser" displays the same handle casing as a stored subscription
  // (subscriptions are always normalized to lowercase at creation time).
  const cleanUser = username.replace(/^@/, "").toLowerCase();
  let postsBody = null;
  let liveBody = null;
  let fetchError = null;

  try {
    const [pRes, lRes] = await Promise.allSettled([
      scraper.getTiktokPosts(cleanUser),
      scraper.getTiktokLiveStatus(cleanUser),
    ]);

    if (pRes.status === "fulfilled") {
      postsBody = pRes.value;
    } else {
      fetchError = pRes.reason;
    }

    if (lRes.status === "fulfilled") {
      liveBody = lRes.value;
    }
  } catch (err) {
    fetchError = err;
  }

  if (fetchError && fetchError.code === "NOT_FOUND") {
    _recordFailure();
    logger.error(
      `[TIKTOK] [ERROR] @${cleanUser}: Code 404 - Account not found`,
    );
    throw new TiktokAccountNotFoundError(cleanUser);
  }

  if (!postsBody && fetchError) {
    _recordFailure();
    const code = fetchError.status || fetchError.code || 500;
    logger.error(
      `[TIKTOK] [ERROR] @${cleanUser}: Code ${code} - ${fetchError.message}`,
    );
    // BUG FIX (previously): this returned a "successful" empty profile
    // instead of throwing. The scheduler's TiktokScheduler#_pollUser only
    // records a failure / engages exponential backoff when fetchProfile()
    // throws — swallowing the error here meant clearFailures() ran on
    // every cycle instead, so a scraper-service outage or persistent
    // error was retried every single poll (every 5 min) at full frequency
    // forever, instead of backing off. It also made real outages
    // indistinguishable from "this account genuinely has 0 videos" in the
    // logs. Propagate the error so the scheduler's existing catch block
    // (which already handles this correctly) can back off.
    const err = new Error(
      `TikTok fetch failed for @${cleanUser}: ${fetchError.message}`,
    );
    err.status = fetchError.status;
    err.code = fetchError.code;
    throw err;
  }

  _recordSuccess();

  const rawPosts = Array.isArray(postsBody?.data) ? postsBody.data : [];
  const source = postsBody?.source || "fast";

  const videos = rawPosts.map((p) => _mapPost(cleanUser, p)).filter(Boolean);

  videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

  const liveData = liveBody?.data || {};
  const isLive = Boolean(liveData.is_live);
  const liveId = liveData.video_id ? String(liveData.video_id) : null;

  if (videos.length === 0) {
    logger.info(
      `[TIKTOK] [NO_VIDEOS] @${cleanUser} has 0 uploaded videos or restricted account`,
    );
  } else {
    logger.success(
      `[TIKTOK] [SUCCESS] @${cleanUser} fetched ${videos.length} videos (Source: ${source})`,
    );
  }

  return {
    user: {
      id: null,
      username: cleanUser,
      avatar: null,
      live: isLive,
      liveId,
      liveUrl: `https://www.tiktok.com/@${cleanUser}/live`,
    },
    videos,
    source,
    diagnostic: postsBody?.diagnostic || null,
  };
}

// Standalone live check.
async function checkLiveStatus(username) {
  const cleanUser = username.replace(/^@/, "").toLowerCase();
  const liveUrl = `https://www.tiktok.com/@${cleanUser}/live`;
  try {
    const res = await scraper.getTiktokLiveStatus(cleanUser);
    const data = res?.data || {};
    return {
      live: Boolean(data.is_live),
      liveId: data.video_id ? String(data.video_id) : null,
      liveUrl,
      source: res?.source || "fast",
    };
  } catch (err) {
    const code = err.status || err.code || 500;
    logger.error(
      `[TIKTOK] [ERROR] @${cleanUser}: Code ${code} - live check failed: ${err.message}`,
    );
    return { live: false, liveId: null, liveUrl, source: null };
  }
}

module.exports = {
  fetchProfile,
  checkLiveStatus,
  getStrategyStats,
  isConfigured,
  isValidTikTokId,
  TiktokAccountNotFoundError,
};
