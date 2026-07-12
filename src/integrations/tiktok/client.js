const Logger = require("../../lib/logger");
const { TIKTOK_HTTP_TIMEOUT_MS } = require("../../config/constants");

const logger = new Logger("TIKTOK");

// ---------------------------------------------------------------------------
// Provider-agnostic TikTok client.
//
// TikTok has no official free feed (no Atom/RSS like YouTube). Rather than
// hardcode a scraper or a single paid vendor, this client calls a configurable
// HTTP provider (TIKTOK_API_BASE) and maps its response onto a stable internal
// contract. Swap providers (RSSHub instance, third-party API, your own proxy)
// by changing env only.
//
// EXPECTED PROVIDER CONTRACT
//   GET {TIKTOK_API_BASE}/user/{username}
//   -> 200 JSON:
//      {
//        "user":  { "id": "<numericUserId>", "username": "<canonical>",
//                   "avatar": "<url>", "live": <bool>, "liveId": "<id|null>",
//                   "liveUrl": "<url|null>" },
//        "videos": [
//          { "id": "<videoId>", "url": "<videoUrl>", "cover": "<imgUrl>",
//            "title": "<desc>", "createTime": <unixSeconds>, "isLive": <bool> }
//        ]
//      }
//   -> 404 when the account does not exist (deleted/renamed).
//
// Only `videos[].id`, `videos[].url`, and the `user.live*` fields are strictly
// required; everything else degrades gracefully. The mapping lives in
// `_normalize` so adapting a differently-shaped provider is a one-function job.
// ---------------------------------------------------------------------------

function providerConfig() {
  const cfg = require("../../config/config");
  return { base: cfg.TIKTOK_API_BASE, key: cfg.TIKTOK_API_KEY };
}

function isConfigured() {
  // Always active by default because we fall back to TikWM scraper when TIKTOK_API_BASE is not configured.
  return true;
}

class TiktokAccountNotFoundError extends Error {
  constructor(username) {
    super(`TikTok account @${username} not found`);
    this.name = "TiktokAccountNotFoundError";
    this.code = "ACCOUNT_NOT_FOUND";
  }
}

function _normalize(username, raw) {
  // Check if raw is TikWM style: { code: 0, msg: "success", data: { videos: [...] } }
  const isTikwm =
    raw &&
    typeof raw.code === "number" &&
    raw.data &&
    Array.isArray(raw.data.videos);

  if (isTikwm) {
    const rawData = raw.data;
    const videosRaw = rawData.videos || [];

    // Extract user details from the first video's author (if available)
    const firstVideoAuthor = videosRaw[0]?.author || {};
    const userId =
      firstVideoAuthor.id != null ? String(firstVideoAuthor.id) : null;
    const userUniqueId = firstVideoAuthor.unique_id
      ? String(firstVideoAuthor.unique_id)
      : username;
    const avatar = firstVideoAuthor.avatar || null;

    const videos = videosRaw
      .filter((v) => v && v.video_id)
      .map((v) => ({
        id: String(v.video_id),
        url: `https://www.tiktok.com/@${userUniqueId}/video/${v.video_id}`,
        cover: v.cover || null,
        title: v.title || "",
        createTime: v.create_time || null,
        isLive: false,
      }));

    return {
      user: {
        id: userId,
        username: userUniqueId,
        avatar,
        live: false, // TikWM user posts endpoint does not support live info.
        liveId: null,
        liveUrl: `https://www.tiktok.com/@${userUniqueId}/live`,
      },
      videos,
    };
  }

  // Fallback/Legacy Custom API behavior
  const user = raw?.user || {};
  const videosRaw = Array.isArray(raw?.videos) ? raw.videos : [];
  const videos = videosRaw
    .filter((v) => v && v.id)
    .map((v) => ({
      id: String(v.id),
      url: v.url || `https://www.tiktok.com/@${username}/video/${v.id}`,
      cover: v.cover || null,
      title: v.title || "",
      createTime: v.createTime || null,
      isLive: Boolean(v.isLive),
    }));

  return {
    user: {
      id: user.id != null ? String(user.id) : null,
      username: user.username ? String(user.username) : username,
      avatar: user.avatar || null,
      live: Boolean(user.live),
      liveId: user.liveId != null ? String(user.liveId) : null,
      liveUrl: user.liveUrl || `https://www.tiktok.com/@${username}/live`,
    },
    videos,
  };
}

// Fetch + normalize a profile. Throws TiktokAccountNotFoundError on 404 so the
// scheduler can distinguish a deleted account from a transient network error.
async function fetchProfile(username) {
  const { base, key } = providerConfig();

  if (base) {
    const url = `${base.replace(/\/$/, "")}/user/${encodeURIComponent(username)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
    try {
      const headers = {};
      if (key) headers["Authorization"] = `Bearer ${key}`;
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      if (res.status === 404) throw new TiktokAccountNotFoundError(username);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return _normalize(username, data);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) throw err;
      logger.warning(`Provider fetch failed for @${username}: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  } else {
    // Scraper fallback (TikWM API)
    const url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.code !== 0) {
        const msg = String(data.msg || "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("not found")) {
          throw new TiktokAccountNotFoundError(username);
        }
        throw new Error(`TikWM error code ${data.code}: ${data.msg}`);
      }

      if (!data || !data.data) {
        throw new Error("Empty response from TikWM API");
      }

      return _normalize(username, data);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) throw err;
      logger.warning(`Scraper fetch failed for @${username}: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = {
  fetchProfile,
  isConfigured,
  TiktokAccountNotFoundError,
  _normalize,
};
