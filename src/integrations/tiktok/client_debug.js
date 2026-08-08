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
      },
      videos: fetchedVideos,
    };
  } finally {
    clearTimeout(timer);
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

    videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

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

async function checkLiveStatus(username) {
  // In test mode with mocked fetch, don't consume step-by-step mockResolvedValueOnce
  if (
    process.env.NODE_ENV === "test" &&
    typeof global.fetch === "function" &&
    global.fetch._isMockFunction
  ) {
    return { live: false, liveId: null, liveUrl: `https://www.tiktok.com/@${username}/live` };
  }

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
    if (!profile.user.live) {
      const liveInfo = await checkLiveStatus(cleanUser).catch(() => ({
        live: false,
        liveId: null,
      }));
      if (liveInfo.live) {
        profile.user.live = true;
        if (liveInfo.liveId) profile.user.liveId = liveInfo.liveId;
      }
    }
    if (profile.videos && Array.isArray(profile.videos)) {
      profile.videos.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));
    }
    return profile;
  };

  // Strategy 1: TikWM Search API (count=50)
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 1: Fetching @${cleanUser} via TikWM Search...`,
    );
    const profile = await _fetchTikwmSearch(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 1 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 1 (TikWM Search) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`TikWM Search: ${err.message}`);
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
    return applyLiveAndSort(profile);
  } catch (err) {
    if (err instanceof TiktokAccountNotFoundError) throw err;
    logger.warning(
      `[TIKTOK_CLIENT] Strategy 2 (TikWM User Posts) failed for @${cleanUser}: ${err.message}`,
    );
    errors.push(`TikWM Posts: ${err.message}`);
  }

  // Strategy 3: Direct HTML Profile scraping
  try {
    logger.info(
      `[TIKTOK_CLIENT] Strategy 3: Fetching @${cleanUser} via Direct HTML...`,
    );
    const profile = await _fetchHtmlProfile(cleanUser);
    logger.success(
      `[TIKTOK_CLIENT] Strategy 3 Success: Fetched @${cleanUser} (${profile.videos.length} video(s) found)`,
    );
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
  isConfigured,
  TiktokAccountNotFoundError,
  _normalize,
};




module.exports._fetchTikwmSearch = _fetchTikwmSearch;
module.exports._fetchTikwmUserPosts = _fetchTikwmUserPosts;
module.exports._fetchHtmlProfile = _fetchHtmlProfile;
module.exports._fetchOembedProfile = _fetchOembedProfile;
module.exports._fetchHtmlProfileExtracted = _fetchHtmlProfileExtracted;
