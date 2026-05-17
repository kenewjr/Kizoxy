// utils/spotifyResolver.js
// Spotify resolver menggunakan Official Client Credentials Flow
// Tidak menggunakan anonymous token — tidak akan kena IP ban dari Spotify

require("dotenv").config();

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const PAGE_SIZE = 100; // Spotify max per page
const MAX_PAGES = 100; // Safety limit: 100 pages × 100 tracks = 10,000 max

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Ambil access token menggunakan Client Credentials Flow (official Spotify API).
 * Token berlaku 1 jam. Di-cache secara in-memory dan diperbarui otomatis.
 */
async function getClientCredentialsToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.spotifyClientID?.trim();
  const clientSecret = process.env.spotifySecret?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "spotifyClientID atau spotifySecret tidak ada di .env. Tambahkan keduanya untuk menggunakan Spotify API."
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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
  // Renew 60 detik sebelum expired (biasanya 3600 detik)
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  console.warn("[SPOTIFY-RESOLVER] Client Credentials token refreshed successfully");
  return cachedToken;
}

/**
 * Fetch Spotify API endpoint menggunakan official token.
 * Retry otomatis pada 429 (rate limit) — max 30s wait per retry.
 */
async function spotifyFetch(url, retries = 3) {
  const token = await getClientCredentialsToken();
  if (!token) throw new Error("Gagal mendapatkan Spotify access token");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
      const waitSec = Math.min(retryAfter + 1, 30); // cap 30 detik
      console.warn(
        `[SPOTIFY-RESOLVER] Rate limited (429). Menunggu ${waitSec}s, retry ${attempt + 1}/${retries}...`
      );
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (res.status === 401) {
      // Token expired — force refresh lalu retry sekali
      cachedToken = null;
      tokenExpiry = 0;
      if (attempt < retries) {
        console.warn("[SPOTIFY-RESOLVER] Token expired, refreshing...");
        continue;
      }
    }

    if (!res.ok) {
      throw new Error(`Spotify API error ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  throw new Error("Spotify API gagal setelah semua retry");
}

/**
 * Extract playlist ID dari Spotify URL.
 * Support: https://open.spotify.com/playlist/ID?si=xxx  dan  spotify:playlist:ID
 */
function extractPlaylistId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/
  );
  return match ? match[1] : null;
}

/**
 * Cek apakah query adalah Spotify playlist URL.
 */
function isSpotifyPlaylist(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/.test(
    query
  );
}

/**
 * Extract album ID dari Spotify URL.
 */
function extractAlbumId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?album[/:]([A-Za-z0-9]+)/
  );
  return match ? match[1] : null;
}

/**
 * Cek apakah query adalah Spotify album URL.
 */
function isSpotifyAlbum(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?album[/:]([A-Za-z0-9]+)/.test(
    query
  );
}

/**
 * Cek apakah query adalah Spotify single track URL.
 */
function isSpotifyTrack(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/.test(
    query
  );
}

/**
 * Extract track ID dari Spotify URL.
 */
function extractTrackId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/
  );
  return match ? match[1] : null;
}

/**
 * Ambil semua track dari Spotify playlist dengan full pagination.
 * Menggunakan official Spotify API — tidak kena IP ban.
 * Returns { name, tracks: [{ title, author, duration, uri, artworkUrl, isrc, identifier }] }
 */
async function getPlaylistTracks(playlistId) {
  // Ambil metadata playlist
  const playlist = await spotifyFetch(
    `${SPOTIFY_API}/playlists/${playlistId}?fields=name,tracks.total`
  );
  const playlistName = playlist.name;
  const totalTracks = playlist.tracks.total;

  console.warn(
    `[SPOTIFY-RESOLVER] Loading playlist "${playlistName}" (${totalTracks} tracks)`
  );

  const tracks = [];
  let offset = 0;
  let pages = 0;

  while (offset < totalTracks && pages < MAX_PAGES) {
    const url = `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=${PAGE_SIZE}&offset=${offset}&fields=items(track(name,artists,duration_ms,id,external_urls,album(images),external_ids,is_local,type)),next,total`;

    const page = await spotifyFetch(url);

    for (const item of page.items || []) {
      const track = item?.track;
      // Skip: null, episode, local file
      if (!track || !track.name || track.type === "episode" || track.is_local) continue;

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
      `[SPOTIFY-RESOLVER] Page ${pages}: ${tracks.length}/${totalTracks} tracks loaded`
    );
  }

  console.warn(
    `[SPOTIFY-RESOLVER] Done loading "${playlistName}": ${tracks.length} tracks total`
  );

  return { name: playlistName, tracks };
}

/**
 * Ambil semua track dari Spotify album.
 * Returns { name, tracks: [...] }
 */
async function getAlbumTracks(albumId) {
  const album = await spotifyFetch(
    `${SPOTIFY_API}/albums/${albumId}`
  );
  const albumName = album.name;
  const artworkUrl = album.images?.[0]?.url || null;
  const totalTracks = album.tracks?.total || 0;

  console.warn(
    `[SPOTIFY-RESOLVER] Loading album "${albumName}" (${totalTracks} tracks)`
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
    `[SPOTIFY-RESOLVER] Done loading album "${albumName}": ${tracks.length} tracks total`
  );

  return { name: albumName, tracks };
}

/**
 * Ambil info single track dari Spotify API.
 * Returns search string "Title Artist" untuk YouTube search.
 */
async function getTrackInfo(spotifyUrl) {
  try {
    const trackId = extractTrackId(spotifyUrl);
    if (!trackId) return null;

    const track = await spotifyFetch(`${SPOTIFY_API}/tracks/${trackId}`);
    if (!track || !track.name) return null;

    const artist = track.artists?.[0]?.name || "";
    const searchQuery = artist ? `${track.name} ${artist}` : track.name;

    console.warn(`[SPOTIFY-RESOLVER] Track resolved: "${searchQuery}"`);
    return searchQuery;
  } catch (err) {
    console.error("[SPOTIFY-RESOLVER] getTrackInfo failed:", err.message);
    return null;
  }
}

/**
 * Fallback: ambil info track dari Spotify oEmbed (tidak butuh token, tidak rate-limited).
 * Hanya dipakai jika getTrackInfo gagal.
 */
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
          searchQuery = `${parts[0]} ${parts[1]}`; // "Song Artist"
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
