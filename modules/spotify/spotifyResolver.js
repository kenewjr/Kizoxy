require("dotenv").config();

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const PAGE_SIZE = 50; // Turunkan dari 100 ke 50 untuk lebih aman
const MAX_PAGES = 100;

const RATE_LIMIT = {
  maxRequestsPerSecond: 5, // Max 5 request per detik
  minDelayMs: 200, // Min 200ms delay antar request
  lastRequestTime: 0,
  requestQueue: [],
  isProcessing: false,
};

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastRequest = now - RATE_LIMIT.lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
    const waitTime = RATE_LIMIT.minDelayMs - timeSinceLastRequest;
    await new Promise((r) => setTimeout(r, waitTime));
  }

  RATE_LIMIT.lastRequestTime = Date.now();
}

const cache = new Map();
const CACHE_TTL = 3600000; // 1 jam

function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });

  // Auto cleanup: hapus cache lama jika terlalu banyak
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

let cachedToken = null;
let tokenExpiry = 0;

async function getClientCredentialsToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.spotifyClientID?.trim();
  const clientSecret = process.env.spotifySecret?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("spotifyClientID atau spotifySecret tidak ada di .env");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  await rateLimitedDelay(); // Rate limit bahkan untuk token request

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  console.warn("[SPOTIFY] Token refreshed successfully");
  return cachedToken;
}

async function spotifyFetch(url, retries = 5) {
  const token = await getClientCredentialsToken();
  if (!token) throw new Error("Gagal mendapatkan Spotify access token");

  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimitedDelay(); // WAJIB: delay sebelum setiap request

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // ── RATE LIMIT (429) ──────────────────────────────────
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
      // Exponential backoff: 5s, 10s, 20s, 40s, 80s
      const backoffMultiplier = Math.pow(2, attempt);
      const waitSec = Math.min(retryAfter * backoffMultiplier, 120); // Max 2 menit

      console.warn(
        `[SPOTIFY] Rate limited (429). Waiting ${waitSec}s (attempt ${attempt + 1}/${retries})...`,
      );

      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    // ── TOKEN EXPIRED (401) ───────────────────────────────
    if (res.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      if (attempt < retries) {
        console.warn("[SPOTIFY] Token expired, refreshing...");
        continue;
      }
    }

    // ── TOO MANY REQUESTS (503) ───────────────────────────
    if (res.status === 503) {
      const waitSec = Math.min(5 * Math.pow(2, attempt), 60);
      console.warn(
        `[SPOTIFY] Service unavailable (503). Waiting ${waitSec}s...`,
      );
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Spotify API error ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  throw new Error("Spotify API gagal setelah semua retry");
}

function extractPlaylistId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/,
  );
  return match ? match[1] : null;
}

function isSpotifyPlaylist(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/.test(
    query,
  );
}

function extractAlbumId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?album[/:]([A-Za-z0-9]+)/,
  );
  return match ? match[1] : null;
}

function isSpotifyAlbum(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?album[/:]([A-Za-z0-9]+)/.test(
    query,
  );
}

function isSpotifyTrack(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/.test(
    query,
  );
}

function extractTrackId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/,
  );
  return match ? match[1] : null;
}

async function getPlaylistTracks(playlistId) {
  // Cek cache dulu
  const cacheKey = `playlist:${playlistId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.warn(
      `[SPOTIFY] Using cached playlist "${cached.name}" (${cached.tracks.length} tracks)`,
    );
    return cached;
  }

  // Ambil metadata playlist
  const playlist = await spotifyFetch(
    `${SPOTIFY_API}/playlists/${playlistId}?fields=name,tracks.total`,
  );
  const playlistName = playlist.name;
  const totalTracks = playlist.tracks.total;

  console.warn(
    `[SPOTIFY] Loading playlist "${playlistName}" (${totalTracks} tracks)`,
  );

  const tracks = [];
  let offset = 0;
  let pages = 0;

  while (offset < totalTracks && pages < MAX_PAGES) {
    const url = `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=${PAGE_SIZE}&offset=${offset}&fields=items(track(name,artists,duration_ms,id,external_urls,album(images),external_ids,is_local,type)),next,total`;

    const page = await spotifyFetch(url);

    for (const item of page.items || []) {
      const track = item?.track;
      if (!track || !track.name || track.type === "episode" || track.is_local)
        continue;

      tracks.push({
        title: track.name,
        author: track.artists?.[0]?.name || "Unknown",
        duration: track.duration_ms || 0,
        identifier: track.id,
        uri:
          track.external_urls?.spotify ||
          `https://open.spotify.com/track/${track.id}`,
        artworkUrl: track.album?.images?.[0]?.url || null,
        isrc: track.external_ids?.isrc || null,
      });
    }

    offset += PAGE_SIZE;
    pages++;

    console.warn(
      `[SPOTIFY] Page ${pages}: ${tracks.length}/${totalTracks} tracks loaded`,
    );
  }

  console.warn(
    `[SPOTIFY] Done loading "${playlistName}": ${tracks.length} tracks total`,
  );

  const result = { name: playlistName, tracks };
  setCache(cacheKey, result); // Simpan ke cache
  return result;
}

async function getAlbumTracks(albumId) {
  // Cek cache dulu
  const cacheKey = `album:${albumId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.warn(
      `[SPOTIFY] Using cached album "${cached.name}" (${cached.tracks.length} tracks)`,
    );
    return cached;
  }

  const album = await spotifyFetch(`${SPOTIFY_API}/albums/${albumId}`);
  const albumName = album.name;
  const artworkUrl = album.images?.[0]?.url || null;
  const totalTracks = album.tracks?.total || 0;

  console.warn(
    `[SPOTIFY] Loading album "${albumName}" (${totalTracks} tracks)`,
  );

  const tracks = [];
  let offset = 0;
  let pages = 0;

  while (offset < totalTracks && pages < MAX_PAGES) {
    const url = `${SPOTIFY_API}/albums/${albumId}/tracks?limit=${PAGE_SIZE}&offset=${offset}`;
    const page = await spotifyFetch(url);

    for (const track of page.items || []) {
      if (!track || !track.name) continue;
      tracks.push({
        title: track.name,
        author: track.artists?.[0]?.name || "Unknown",
        duration: track.duration_ms || 0,
        identifier: track.id,
        uri:
          track.external_urls?.spotify ||
          `https://open.spotify.com/track/${track.id}`,
        artworkUrl,
        isrc: null,
      });
    }

    offset += PAGE_SIZE;
    pages++;
  }

  console.warn(
    `[SPOTIFY] Done loading album "${albumName}": ${tracks.length} tracks total`,
  );

  const result = { name: albumName, tracks };
  setCache(cacheKey, result); // Simpan ke cache
  return result;
}

async function getTrackInfo(spotifyUrl) {
  try {
    const trackId = extractTrackId(spotifyUrl);
    if (!trackId) return null;

    // Cek cache
    const cacheKey = `track:${trackId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const track = await spotifyFetch(`${SPOTIFY_API}/tracks/${trackId}`);
    if (!track || !track.name) return null;

    const artist = track.artists?.[0]?.name || "";
    const searchQuery = artist ? `${track.name} ${artist}` : track.name;

    console.warn(`[SPOTIFY] Track resolved: "${searchQuery}"`);
    setCache(cacheKey, searchQuery);
    return searchQuery;
  } catch (err) {
    console.error("[SPOTIFY] getTrackInfo failed:", err.message);
    return null;
  }
}

async function getTrackInfoFromOEmbed(spotifyUrl) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.title) {
      let searchQuery = data.title;
      if (data.description) {
        const parts = data.description.split(" · ");
        if (parts.length >= 2) {
          searchQuery = `${parts[0]} ${parts[1]}`;
        }
      }
      console.warn(`[SPOTIFY-OEMBED] Resolved: "${searchQuery}"`);
      return searchQuery;
    }
    return null;
  } catch (err) {
    console.error("[SPOTIFY-OEMBED] Failed:", err.message);
    return null;
  }
}

module.exports = {
  isSpotifyPlaylist,
  isSpotifyAlbum,
  isSpotifyTrack,
  extractPlaylistId,
  extractAlbumId,
  extractTrackId,
  getPlaylistTracks,
  getAlbumTracks,
  getTrackInfo,
  getTrackInfoFromOEmbed,
};
