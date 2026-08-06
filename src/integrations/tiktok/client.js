const Logger = require("../../lib/logger");
const { TIKTOK_HTTP_TIMEOUT_MS } = require("../../config/constants");

const logger = new Logger("TIKTOK");

// ---------------------------------------------------------------------------
// Multi-Strategy Scraper TikTok Client
//
// Fetches profile & posts without external API keys.
// Uses a 4-tiered strategy chain:
// 1. TikWM Search API (https://www.tikwm.com/api/feed/search)
// 2. TikWM User Posts API (https://www.tikwm.com/api/user/posts)
// 3. Direct HTML profile rehydration script parsing
// 4. TikTok oEmbed metadata verification
// ---------------------------------------------------------------------------

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
      .filter((v) => v && v.video_id)
      .map((v) => {
        const isPhoto =
          Boolean(v.images && v.images.length > 0) ||
          v.type === "images" ||
          v.type === "photo";
        const postType = isPhoto ? "photo" : "video";
        const pathType = isPhoto ? "photo" : "video";
        return {
          id: String(v.video_id),
          type: postType,
          url: `https://www.tiktok.com/@${userUniqueId}/${pathType}/${v.video_id}`,
          cover: v.cover || (v.images && v.images[0]) || null,
          images: Array.isArray(v.images) ? v.images : [],
          title: v.title || "",
          createTime: v.create_time || null,
          isLive: false,
        };
      });

    return {
      user: {
        id: userId,
        username: userUniqueId,
        avatar,
        live: false, // TikWM user posts endpoint does not support live stream status.
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

async function _fetchTikwmSearch(username) {
  const cleanUser = username.replace(/^@/, "");
  const queries = [`@${cleanUser}`, cleanUser];
  const allMatches = [];

  for (const q of queries) {
    const url = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}`;
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

    return _normalize(username, data);
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

    return {
      user: {
        id: user.id != null ? String(user.id) : null,
        username: user.uniqueId || username,
        avatar: user.avatarThumb || user.avatarLarger || null,
        live: isLive,
        liveId: liveId,
        liveUrl: `https://www.tiktok.com/@${user.uniqueId || username}/live`,
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
      },
      videos: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch + normalize a profile via multi-strategy chain with detailed logging.
async function fetchProfile(username) {
  const errors = [];

  // Strategy 1: TikWM Search API
  try {
    logger.info(`[TIKTOK_CLIENT] Strategy 1: Fetching @${username} via TikWM Search...`);
    const profile = await _fetchTikwmSearch(username);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 1 Success: Fetched @${username} (${profile.videos.length} video(s) found)`,
    );
    return profile;
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 1 (TikWM Search) failed for @${username}: ${err.message}`,
    );
    errors.push(`TikWM Search: ${err.message}`);
  }

  // Strategy 2: TikWM User Posts API
  try {
    logger.info(`[TIKTOK_CLIENT] Strategy 2: Fetching @${username} via TikWM User Posts...`);
    const profile = await _fetchTikwmUserPosts(username);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 2 Success: Fetched @${username} (${profile.videos.length} video(s) found)`,
    );
    return profile;
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 2 (TikWM User Posts) failed for @${username}: ${err.message}`,
    );
    errors.push(`TikWM Posts: ${err.message}`);
  }

  // Strategy 3: Direct HTML Profile scraping
  try {
    logger.info(`[TIKTOK_CLIENT] Strategy 3: Fetching @${username} via Direct HTML...`);
    const profile = await _fetchHtmlProfile(username);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 3 Success: Fetched @${username} (${profile.videos.length} video(s) found)`,
    );
    return profile;
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 3 (Direct HTML) failed for @${username}: ${err.message}`,
    );
    errors.push(`Direct HTML: ${err.message}`);
  }

  // Strategy 4: TikTok oEmbed check
  try {
    logger.info(`[TIKTOK_CLIENT] Strategy 4: Verifying @${username} via TikTok oEmbed...`);
    const profile = await _fetchOembedProfile(username);
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 4 Success: Account @${username} verified via oEmbed (no video list)`,
    );
    return profile;
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 4 (TikTok oEmbed) failed for @${username}: ${err.message}`,
    );
    errors.push(`TikTok oEmbed: ${err.message}`);
  }

  const aggregated = new Error(
    `All TikTok fetch strategies failed for @${username} [${errors.join(" | ")}]`,
  );
  logger.error(`[TIKTOK_CLIENT] ${aggregated.message}`);
  throw aggregated;
}

module.exports = {
  fetchProfile,
  isConfigured,
  TiktokAccountNotFoundError,
  _normalize,
};


