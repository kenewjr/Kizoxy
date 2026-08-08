const Logger = require("../../lib/logger");
const { TIKTOK_HTTP_TIMEOUT_MS, TIKTOK_CAMOFOX_URL, TIKTOK_CAMOFOX_TIMEOUT_MS } = require("../../config/constants");

const logger = new Logger("TIKTOK");

// ---------------------------------------------------------------------------
// Multi-Strategy Scraper TikTok Client
//
// Fetches profile & posts without external API keys.
// Strategy chain (tried in order):
// 0. Camofox Browser Proxy  — real-time HTML via anti-bot bypass; authoritative
//      live status + actual video list. Only active when TIKTOK_CAMOFOX_URL set.
// 1. TikWM Search API       — only third-party strategy currently returning video
//      data (verified 2026-08-08). Primary fallback when Camofox unavailable.
// 2. TikWM User Posts API   — fallback (HTTP 403 as of 2026-08-08)
// 3. Direct HTML rehydration — authoritative live status; returns 0 videos
// 4. TikTok oEmbed          — account-exists confirmation only
// 5. HTML Extraction + TikWM single-video — last resort
//
// _liveStatusKnown flag: Strategies 0 and 3 set true (live data from
// rehydration JSON is authoritative). All others set false → checkLiveStatus()
// fallback runs. Flag is stripped before returning to callers.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Strategy stats — in-memory, resets on restart. Rolling window of last 100
// fetchProfile() calls. Tracks consecutive TikWM Search failures for early
// warning visibility via /api/stats.
// ---------------------------------------------------------------------------
const _strategyStats = {
  counts: {},
  total: 0,
  consecutiveTikwmSearchFailures: 0,
};
const _STATS_WINDOW = 100;
const _TIKWM_SEARCH_FAIL_WARN_THRESHOLD = 10;

// Camofox circuit breaker — if Camofox is unreachable, skip it for 2 minutes
// rather than adding latency to every fetchProfile() call.
let _camofoxOfflineUntil = 0;

function _recordStrategyWin(strategyName) {
  try {
    _strategyStats.counts[strategyName] =
      (_strategyStats.counts[strategyName] || 0) + 1;
    _strategyStats.total = Math.min(
      (_strategyStats.total || 0) + 1,
      _STATS_WINDOW,
    );
    if (strategyName === "TikWM Search") {
      _strategyStats.consecutiveTikwmSearchFailures = 0;
    }
  } catch (_) {}
}

function _recordTikwmSearchFailure() {
  try {
    _strategyStats.consecutiveTikwmSearchFailures =
      (_strategyStats.consecutiveTikwmSearchFailures || 0) + 1;
    const n = _strategyStats.consecutiveTikwmSearchFailures;
    if (n >= _TIKWM_SEARCH_FAIL_WARN_THRESHOLD && n % _TIKWM_SEARCH_FAIL_WARN_THRESHOLD === 0) {
      logger.warning(
        `[TIKTOK_CLIENT] TikTok video notifications may be down — primary source (TikWM Search) has failed ${n} consecutive times and no other strategy currently provides video data.`,
      );
    }
  } catch (_) {}
}

function getStrategyStats() {
  const { counts, total, consecutiveTikwmSearchFailures } = _strategyStats;
  const breakdown = {};
  for (const [name, count] of Object.entries(counts)) {
    breakdown[name] = {
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  }
  return {
    window: _STATS_WINDOW,
    total_recorded: total,
    breakdown,
    tikwm_search_consecutive_failures: consecutiveTikwmSearchFailures,
    tikwm_search_health:
      consecutiveTikwmSearchFailures >= _TIKWM_SEARCH_FAIL_WARN_THRESHOLD
        ? "degraded"
        : "ok",
  };
}

function isConfigured() {
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

    const firstVideoAuthor = videosRaw[0]?.author || {};
    const userId =
      firstVideoAuthor.id != null ? String(firstVideoAuthor.id) : null;
    const userUniqueId = firstVideoAuthor.unique_id
      ? String(firstVideoAuthor.unique_id)
      : username;
    const avatar = firstVideoAuthor.avatar || null;

    const videos = videosRaw
      .filter((v) => v && (v.video_id || v.id))
      .map((v) => {
        const vid = String(v.video_id || v.id);
        const isPhoto =
          Boolean(v.images && v.images.length > 0) ||
          v.type === "images" ||
          v.type === "photo";
        const postType = isPhoto ? "photo" : "video";
        const pathType = isPhoto ? "photo" : "video";
        return {
          id: vid,
          type: postType,
          url: `https://www.tiktok.com/@${userUniqueId}/${pathType}/${vid}`,
          cover: v.cover || (v.images && v.images[0]) || null,
          images: Array.isArray(v.images) ? v.images : [],
          title: v.title || "",
          createTime: v.create_time || v.createTime || null,
          isLive: false,
        };
      });

    videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

    return {
      user: {
        id: userId,
        username: userUniqueId,
        avatar,
        live: false,
        liveId: null,
        liveUrl: `https://www.tiktok.com/@${userUniqueId}/live`,
      },
      videos,
    };
  }

  // Scraper HTML / Direct Object normalization
  const user = raw?.user || {};
  const videosRaw = Array.isArray(raw?.videos) ? raw.videos : [];
  const videos = videosRaw
    .filter((v) => v && v.id)
    .map((v) => ({
      id: String(v.id),
      type: v.type || (v.images && v.images.length > 0 ? "photo" : "video"),
      url:
        v.url ||
        `https://www.tiktok.com/@${username}/${v.type === "photo" ? "photo" : "video"}/${v.id}`,
      cover: v.cover || null,
      images: Array.isArray(v.images) ? v.images : [],
      title: v.title || "",
      createTime: v.createTime || null,
    }));
  videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

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

async function _fetchHtmlProfileExtracted(username) {
  const cleanUser = username.replace(/^@/, "");
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(cleanUser)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (res.status === 404) throw new TiktokAccountNotFoundError(cleanUser);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const matches = [
      ...html.matchAll(
        /(?:video|photo|item|v|embed)\/(\d{18,20})|"(?:id|itemId|videoId)"\s*:\s*"(\d{18,20})"/g,
      ),
    ];
    const extractedIds = matches
      .map((m) => m[1] || m[2])
      .filter(Boolean);

    const fallbackDigitMatches = [...html.matchAll(/\b(7\d{18})\b/g)].map(
      (m) => m[1],
    );

    const candidateIds = [
      ...new Set([...extractedIds, ...fallbackDigitMatches]),
    ].slice(0, 15);
    if (candidateIds.length === 0) {
      throw new Error("No candidate video IDs found in HTML");
    }

    const results = await Promise.allSettled(
      candidateIds.map(async (vid) => {
        try {
          const itemUrl = `https://www.tiktok.com/@${cleanUser}/video/${vid}`;
          const itemRes = await fetch("https://www.tikwm.com/api/", {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
            body: new URLSearchParams({ url: itemUrl }),
          });
          if (itemRes.ok) {
            const itemData = await itemRes.json();
            if (itemData && itemData.code === 0 && itemData.data) {
              return { vid, data: itemData.data };
            }
          }
        } catch (_) {}
        return null;
      }),
    );

    const fetchedVideos = [];
    let authorInfo = null;

    for (const resItem of results) {
      if (resItem.status === "fulfilled" && resItem.value) {
        const { vid, data: v } = resItem.value;
        if (
          !v.author?.unique_id ||
          v.author.unique_id.toLowerCase() === cleanUser.toLowerCase()
        ) {
          if (!authorInfo && v.author) {
            authorInfo = {
              id: v.author.id ? String(v.author.id) : null,
              username: v.author.unique_id || cleanUser,
              avatar: v.author.avatar || null,
            };
          }
          const isPhoto =
            Boolean(v.images && v.images.length > 0) ||
            v.type === "images" ||
            v.type === "photo";
          const postType = isPhoto ? "photo" : "video";
          fetchedVideos.push({
            id: String(v.id || vid),
            type: postType,
            url: `https://www.tiktok.com/@${cleanUser}/${postType}/${v.id || vid}`,
            cover: v.cover || (v.images && v.images[0]) || null,
            images: Array.isArray(v.images) ? v.images : [],
            title: v.title || "",
            createTime: v.create_time || null,
            isLive: false,
          });
        }
      }
    }

    if (fetchedVideos.length === 0) {
      throw new Error("Could not resolve video metadata from extracted IDs");
    }

    fetchedVideos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

    return {
      user: {
        id: authorInfo?.id || null,
        username: authorInfo?.username || cleanUser,
        avatar: authorInfo?.avatar || null,
        live: false,
        liveId: null,
        liveUrl: `https://www.tiktok.com/@${cleanUser}/live`,
        _liveStatusKnown: false,
      },
      videos: fetchedVideos,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Strategy 0: Camofox browser proxy — bypasses TikTok anti-bot with C++-level
// fingerprint spoofing. Uses tab-based API: inject cookies → create tab →
// navigate → evaluate rehydration JSON via JS in page context → cleanup.
// Only used when TIKTOK_CAMOFOX_URL is set and circuit breaker is not tripped.
async function _fetchCamofox(username) {
  const base = TIKTOK_CAMOFOX_URL.replace(/\/$/, "");
  if (!base) throw new Error("Camofox not configured");
  if (Date.now() < _camofoxOfflineUntil) {
    throw new Error("Camofox circuit breaker open (recent failure)");
  }

  const { loadCookies } = require("./cookieStorage");
  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const userId = "kizoxy-tiktok";
  const sessionKey = "kizoxy-session";
  const timeout = TIKTOK_CAMOFOX_TIMEOUT_MS;

  let tabId = null;

  const cfFetch = async (path, opts = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${base}${path}`, {
        ...opts,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      });
      return res;
    } catch (err) {
      if (
        err.name === "AbortError" ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("fetch failed")
      ) {
        _camofoxOfflineUntil = Date.now() + 2 * 60 * 1000;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Step 1: Inject TikTok session cookies if available
    const cookies = loadCookies();
    if (cookies && cookies.length > 0) {
      const cookieRes = await cfFetch(`/sessions/${userId}/cookies`, {
        method: "POST",
        body: JSON.stringify({ cookies }),
      });
      if (!cookieRes.ok) {
        logger.warning(
          `[TIKTOK_CLIENT] Camofox cookie injection failed: ${cookieRes.status}`,
        );
      } else {
        logger.debug(`[TIKTOK_CLIENT] Camofox: injected ${cookies.length} cookie(s) for @${username}`);
      }
    }

    // Step 2: Create tab and navigate
    const createRes = await cfFetch("/tabs", {
      method: "POST",
      body: JSON.stringify({ userId, sessionKey, url: profileUrl }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Camofox create tab failed: ${err.error || createRes.status}`);
    }
    const createData = await createRes.json();
    tabId = createData.tabId || createData.id;
    if (!tabId) throw new Error("Camofox did not return tabId");

    // Step 2: Poll until rehydration script is present in page (max ~15s)
    let rehydrationJson = null;
    const pollStart = Date.now();
    const pollLimit = Math.min(timeout, 15000);

    while (Date.now() - pollStart < pollLimit) {
      await new Promise((r) => setTimeout(r, 1500));

      const evalRes = await cfFetch(`/tabs/${tabId}/evaluate`, {
        method: "POST",
        body: JSON.stringify({
          userId,
          expression: `(function(){var el=document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');return el?el.textContent:null;})()`,
        }),
      });

      if (evalRes.ok) {
        const evalData = await evalRes.json();
        const text = evalData.result || evalData.value || evalData.output || null;
        if (text && text !== "null" && text.length > 100) {
          try {
            rehydrationJson = JSON.parse(text);
            break;
          } catch (_) {
            // keep polling
          }
        }
      }
    }

    if (!rehydrationJson) {
      throw new Error("Rehydration JSON not found in Camofox page after polling");
    }

    // Step 3: Parse rehydration JSON — same logic as _fetchHtmlProfile
    const scope = rehydrationJson["__DEFAULT_SCOPE__"] || {};
    const userDetail = scope["webapp.user-detail"] || {};
    if (userDetail.statusCode === 209002 || !userDetail.userInfo) {
      throw new TiktokAccountNotFoundError(username);
    }
    const user = userDetail.userInfo.user || {};
    const isLive = Boolean(user.roomStatus === 1 || user.isLive);
    const liveId = user.roomId != null ? String(user.roomId) : null;
    const itemList =
      userDetail.itemList || scope["webapp.user-post"]?.itemList || [];

    const videos = itemList
      .map((item) => {
        const isPhoto =
          Boolean(item.images && item.images.length > 0) || item.imagePost;
        const type = isPhoto ? "photo" : "video";
        const id = String(item.id || item.video?.id || "");
        return {
          id,
          type,
          url: `https://www.tiktok.com/@${user.uniqueId || username}/${type}/${id}`,
          cover: item.video?.cover || item.cover || null,
          images: item.images || [],
          title: item.desc || item.title || "",
          createTime: item.createTime || null,
          isLive: false,
        };
      })
      .filter((v) => v.id);

    videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

    return {
      user: {
        id: user.id != null ? String(user.id) : null,
        username: user.uniqueId || username,
        avatar: user.avatarThumb || user.avatarLarger || null,
        live: isLive,
        liveId: liveId,
        liveUrl: `https://www.tiktok.com/@${user.uniqueId || username}/live`,
        _liveStatusKnown: true, // authoritative: rehydration JSON via Camofox
      },
      videos,
    };
  } finally {
    // Step 4: Always clean up tab regardless of success/failure
    if (tabId) {
      cfFetch(`/tabs/${tabId}?userId=${userId}`, { method: "DELETE" }).catch(() => {});
    }
  }
}

async function _fetchTikwmSearch(username) {
  const cleanUser = username.replace(/^@/, "");
  const queries = [`@${cleanUser}`, cleanUser];
  const allMatches = [];

  for (const q of queries) {
    const url = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=50`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          data.code === 0 &&
          data.data &&
          Array.isArray(data.data.videos)
        ) {
          const matches = data.data.videos.filter(
            (v) =>
              v &&
              v.author &&
              String(v.author.unique_id).toLowerCase() === cleanUser.toLowerCase(),
          );
          allMatches.push(...matches);
        }
      }
    } catch (_err) {
      // Ignore query errors
    } finally {
      clearTimeout(timer);
    }
  }

  if (allMatches.length === 0) {
    throw new Error("No matching posts found in search API response");
  }

  // Deduplicate by video_id
  const videoMap = new Map();
  for (const v of allMatches) {
    videoMap.set(String(v.video_id), v);
  }
  const uniqueVideos = [...videoMap.values()];

  const firstAuthor = uniqueVideos[0]?.author || {};
  const userId = firstAuthor.id ? String(firstAuthor.id) : null;
  const userUniqueId = firstAuthor.unique_id || cleanUser;
  const avatar = firstAuthor.avatar || null;

  const videos = uniqueVideos.map((v) => {
    const isPhoto =
      Boolean(v.images && v.images.length > 0) ||
      v.type === "images" ||
      v.type === "photo";
    const postType = isPhoto ? "photo" : "video";
    return {
      id: String(v.video_id),
      type: postType,
      url: `https://www.tiktok.com/@${userUniqueId}/${postType}/${v.video_id}`,
      cover: v.cover || (v.images && v.images[0]) || null,
      images: Array.isArray(v.images) ? v.images : [],
      title: v.title || "",
      createTime: v.create_time || null,
      isLive: false,
    };
  });

  videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

  return {
    user: {
      id: userId,
      username: userUniqueId,
      avatar,
      live: false,
      liveId: null,
      liveUrl: `https://www.tiktok.com/@${userUniqueId}/live`,
      _liveStatusKnown: false,
    },
    videos,
  };
}

async function _fetchTikwmUserPosts(username) {
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

    const result = _normalize(username, data);
    result.user._liveStatusKnown = false;
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function _fetchHtmlProfile(username) {
  const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (res.status === 404) throw new TiktokAccountNotFoundError(username);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const match = html.match(
      /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"\s+type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) throw new Error("Rehydration script not found in HTML");
    const json = JSON.parse(match[1]);
    const scope = json["__DEFAULT_SCOPE__"] || {};
    const userDetail = scope["webapp.user-detail"] || {};
    if (userDetail.statusCode === 209002 || !userDetail.userInfo) {
      throw new TiktokAccountNotFoundError(username);
    }
    const user = userDetail.userInfo.user || {};
    const isLive = Boolean(user.roomStatus === 1 || user.isLive);
    const liveId = user.roomId != null ? String(user.roomId) : null;
    const itemList =
      userDetail.itemList || scope["webapp.user-post"]?.itemList || [];

    const videos = itemList
      .map((item) => {
        const isPhoto =
          Boolean(item.images && item.images.length > 0) || item.imagePost;
        const type = isPhoto ? "photo" : "video";
        const id = String(item.id || item.video?.id || "");
        return {
          id,
          type,
          url: `https://www.tiktok.com/@${user.uniqueId || username}/${type}/${id}`,
          cover: item.video?.cover || item.cover || null,
          images: item.images || [],
          title: item.desc || item.title || "",
          createTime: item.createTime || null,
          isLive: false,
        };
      })
      .filter((v) => v.id);

    videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

    return {
      user: {
        id: user.id != null ? String(user.id) : null,
        username: user.uniqueId || username,
        avatar: user.avatarThumb || user.avatarLarger || null,
        live: isLive,
        liveId: liveId,
        liveUrl: `https://www.tiktok.com/@${user.uniqueId || username}/live`,
        _liveStatusKnown: true, // authoritative: comes from rehydration JSON
      },
      videos,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function _fetchOembedProfile(username) {
  const url = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 400 || res.status === 404) {
      throw new TiktokAccountNotFoundError(username);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      user: {
        id: data.embed_product_id || null,
        username: data.author_name || username,
        avatar: null,
        live: false,
        liveId: null,
        liveUrl: `https://www.tiktok.com/@${username}/live`,
        _liveStatusKnown: false,
      },
      videos: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLiveStatus(username) {

  const cleanUser = username.replace(/^@/, "");
  const liveUrl = `https://www.tiktok.com/@${encodeURIComponent(cleanUser)}/live`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIKTOK_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(liveUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!res.ok) return { live: false, liveId: null, liveUrl };

    const html = await res.text();
    let isLive = false;
    let liveId = null;

    const matchLiveRoom = html.match(
      /"LiveRoom"\s*:\s*(\{[\s\S]*?\})\s*,\s*"[a-zA-Z0-9]+"/,
    );
    if (matchLiveRoom) {
      try {
        const liveRoomData = JSON.parse(matchLiveRoom[1]);
        const status = liveRoomData.liveRoomStatus;
        const userStatus = liveRoomData.liveRoomUserInfo?.user?.roomStatus;
        if (status === 1 || userStatus === 1) {
          isLive = true;
        }
        const rId =
          liveRoomData.liveRoomUserInfo?.user?.roomId ||
          liveRoomData.liveRoomUserInfo?.liveRoom?.roomId;
        if (rId) liveId = String(rId);
      } catch (_) {}
    }

    if (!isLive) {
      isLive =
        html.includes('"liveRoomStatus":1') ||
        html.includes('"roomStatus":1') ||
        html.includes('"isLive":true');
    }

    if (!liveId) {
      const roomIdMatch = html.match(/"roomId"\s*:\s*"(\d+)"/);
      if (roomIdMatch && isLive) {
        liveId = roomIdMatch[1];
      }
    }

    return {
      live: isLive,
      liveId: isLive ? liveId || "live" : null,
      liveUrl,
    };
  } catch (_) {
    return { live: false, liveId: null, liveUrl };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch + normalize a profile via multi-strategy chain with detailed logging.
async function fetchProfile(username) {
  const errors = [];
  const cleanUser = username.replace(/^@/, "");

  const applyLiveAndSort = async (profile) => {
    if (!profile.user._liveStatusKnown) {
      // Strategy didn't check live status (TikWM, oEmbed, HTML Extraction).
      // Fall back to the /live page regex check.
      // Call via module.exports so jest.spyOn can intercept in tests.
      const liveInfo = await module.exports.checkLiveStatus(cleanUser).catch(() => ({
        live: false,
        liveId: null,
      }));
      if (liveInfo.live) {
        profile.user.live = true;
        if (liveInfo.liveId) profile.user.liveId = liveInfo.liveId;
      }
    }
    // Strip internal flag before returning to callers.
    delete profile.user._liveStatusKnown;
    if (profile.videos && Array.isArray(profile.videos)) {
      profile.videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
    }
    return profile;
  };

  // Strategy 0: Camofox Browser Proxy (only when TIKTOK_CAMOFOX_URL is set)
  // Real-time HTML via anti-bot bypass. Returns actual video list + live status.
  if (TIKTOK_CAMOFOX_URL) {
    try {
      logger.info(
        `[TIKTOK_CLIENT] Strategy 0: Fetching @${cleanUser} via Camofox Browser...`,
      );
      const profile = await _fetchCamofox(cleanUser);
      logger.success(
        `[TIKTOK_CLIENT] Strategy 0 Success: Fetched @${cleanUser} via Camofox (${profile.videos.length} video(s) found)`,
      );
      _recordStrategyWin("Camofox");
      return applyLiveAndSort(profile);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) throw err;
      logger.warning(
        `[TIKTOK_CLIENT] Strategy 0 (Camofox) failed for @${cleanUser}: ${err.message}`,
      );
      errors.push(`Camofox: ${err.message}`);
    }
  }

  // Strategy 1: TikWM Search API (count=50)
  // NOTE: Only strategy currently returning video data (verified 2026-08-08).
  // If this starts failing consistently, check /api/stats tiktok_strategy_stats.
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 1: Fetching @${cleanUser} via TikWM Search...`,
    );
    const profile = await _fetchTikwmSearch(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 1 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
    _recordStrategyWin("TikWM Search");
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 1 (TikWM Search) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`TikWM Search: ${err.message}`);
    _recordTikwmSearchFailure();
  }

  // Strategy 2: TikWM User Posts API
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 2: Fetching @${cleanUser} via TikWM User Posts...`,
    );
    const profile = await _fetchTikwmUserPosts(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 2 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
    _recordStrategyWin("TikWM User Posts");
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 2 (TikWM User Posts) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`TikWM Posts: ${err.message}`);
  }

  // Strategy 3: Direct HTML Profile scraping
  // _liveStatusKnown: true — live status is authoritative from rehydration JSON.
  // checkLiveStatus() fallback skipped when this strategy wins.
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 3: Fetching @${cleanUser} via Direct HTML...`,
    );
    const profile = await _fetchHtmlProfile(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 3 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
    _recordStrategyWin("Direct HTML");
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 3 (Direct HTML) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`Direct HTML: ${err.message}`);
  }

  // Strategy 4: TikTok oEmbed check
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 4: Verifying @${cleanUser} via TikTok oEmbed...`,
    );
    const profile = await _fetchOembedProfile(cleanUser);
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 4 Success: Account @${cleanUser} verified via oEmbed (no video list)`,
    );
    _recordStrategyWin("oEmbed");
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 4 (TikTok oEmbed) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`TikTok oEmbed: ${err.message}`);
  }

  // Strategy 5: HTML Profile Extraction + Single Video API (fallback)
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 5: Fetching @${cleanUser} via HTML Extraction + Single Video API...`,
    );
    const profile = await _fetchHtmlProfileExtracted(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 5 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
    _recordStrategyWin("HTML Extraction");
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 5 (HTML Extraction) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`HTML Extraction: ${err.message}`);
  }

  const aggregated = new Error(
    `All TikTok fetch strategies failed for @${cleanUser} [${errors.join(" | ")}]`,
  );
  logger.error(`[TIKTOK_CLIENT] ${aggregated.message}`);
  throw aggregated;
}

module.exports = {
  fetchProfile,
  checkLiveStatus,
  getStrategyStats,
  isConfigured,
  TiktokAccountNotFoundError,
  _normalize,
  _fetchCamofox,
};



