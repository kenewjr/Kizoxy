// utils/spotifyResolver.js
// Custom Spotify playlist resolver using anonymous token from tokener container
// Bypasses LavaSrc's 50-track limitation by calling Spotify v1 API with pagination

const TOKENER_URL = "http://127.0.0.1:8080/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";
const PAGE_SIZE = 100; // Spotify max per page
const MAX_PAGES = 100; // Safety limit: 100 pages × 100 tracks = 10,000 max

let cachedToken = null;
let tokenExpiry = 0;
let banUntil = 0; // Timestamp when the ban expires — no API calls until then

/**
 * Get an anonymous access token from the spotify-tokener container.
 */
async function getAnonymousToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const res = await fetch(TOKENER_URL);
    if (!res.ok) throw new Error(`Tokener returned ${res.status}`);

    const data = await res.json();
    cachedToken = data.accessToken;
    // Renew 60 seconds before actual expiry
    tokenExpiry = Date.now() + (data.accessTokenExpirationTimestampMs - Date.now()) - 60000;

    console.warn("[SPOTIFY-RESOLVER] Anonymous token refreshed successfully");
    return cachedToken;
  } catch (err) {
    console.error("[SPOTIFY-RESOLVER] Failed to get anonymous token:", err.message);
    return null;
  }
}

/**
 * Fetch a Spotify API endpoint using the anonymous token.
 * Automatically retries on 429 (rate limit) with backoff, up to 30s max wait.
 * Blocks all requests locally while an active ban is in effect.
 */
async function spotifyFetch(url, retries = 3) {
  // Check if we're still in a ban period — don't make ANY request to Spotify
  if (banUntil > Date.now()) {
    const remainMin = Math.ceil((banUntil - Date.now()) / 60000);
    throw new Error(
      `Spotify masih di-ban. Coba lagi dalam ~${remainMin} menit. (Tidak ada request yang dikirim ke Spotify)`
    );
  }

  const token = await getAnonymousToken();
  if (!token) throw new Error("No anonymous token available");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);

      // If Spotify is asking us to wait more than 60 seconds, it's a temporary IP ban
      if (retryAfter > 60) {
        // Save ban timestamp so we don't make any more requests
        banUntil = Date.now() + retryAfter * 1000;
        const hours = Math.round(retryAfter / 3600);
        console.warn(`[SPOTIFY-RESOLVER] Spotify ban detected: ${hours}h. All requests blocked until ban expires.`);
        throw new Error(
          `Spotify rate limit: banned for ${hours}h. Semua request di-block sampai ban selesai.`
        );
      }

      const waitMs = Math.min(retryAfter + 1, 30) * 1000; // cap at 30s
      console.warn(`[SPOTIFY-RESOLVER] Rate limited (429). Waiting ${Math.min(retryAfter + 1, 30)}s before retry ${attempt + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Spotify API returned ${res.status}: ${res.statusText}`);
    }

    return res.json();
  }

  throw new Error("Spotify API rate limit exceeded after all retries");
}

/**
 * Extract playlist ID from a Spotify URL.
 * Supports: https://open.spotify.com/playlist/ID?si=xxx  and  spotify:playlist:ID
 */
function extractPlaylistId(url) {
  const match = url.match(
    /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/
  );
  return match ? match[1] : null;
}

/**
 * Check if a URL is a Spotify playlist URL.
 */
function isSpotifyPlaylist(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/.test(query);
}

/**
 * Fetch all tracks from a Spotify playlist with full pagination.
 * Returns { name, tracks: [{ title, author, duration, uri, artworkUrl, isrc }] }
 */
async function getPlaylistTracks(playlistId) {
  // Get playlist metadata
  const playlist = await spotifyFetch(`${SPOTIFY_API}/playlists/${playlistId}?fields=name,tracks.total`);
  const playlistName = playlist.name;
  const totalTracks = playlist.tracks.total;

  console.warn(`[SPOTIFY-RESOLVER] Loading playlist "${playlistName}" (${totalTracks} tracks)`);

  const tracks = [];
  let offset = 0;
  let pages = 0;

  while (offset < totalTracks && pages < MAX_PAGES) {
    const url = `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=${PAGE_SIZE}&offset=${offset}&fields=items(track(name,artists,duration_ms,id,external_urls,album(images),external_ids)),next,total`;

    const page = await spotifyFetch(url);

    for (const item of page.items || []) {
      const track = item.track;
      if (!track || !track.name || track.type === "episode") continue;
      // Skip local files
      if (track.is_local) continue;

      tracks.push({
        title: track.name,
        author: track.artists?.[0]?.name || "Unknown",
        duration: track.duration_ms || 0,
        identifier: track.id,
        uri: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
        artworkUrl: track.album?.images?.[0]?.url || null,
        isrc: track.external_ids?.isrc || null,
      });
    }

    offset += PAGE_SIZE;
    pages++;

    console.warn(`[SPOTIFY-RESOLVER] Loaded page ${pages}: ${tracks.length}/${totalTracks} tracks`);
  }

  console.warn(`[SPOTIFY-RESOLVER] Finished loading "${playlistName}": ${tracks.length} tracks total`);

  return { name: playlistName, tracks };
}

/**
 * Check if a URL is a Spotify single track URL.
 */
function isSpotifyTrack(query) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/.test(query);
}

/**
 * Get track title from Spotify oEmbed API (free, no auth, not rate-limited).
 * Returns a search string like "Track Name - Artist" suitable for YouTube search.
 */
async function getTrackInfoFromOEmbed(spotifyUrl) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;

    const data = await res.json();
    // oEmbed returns title like "Track Name" and description like "Track · Artist · Album · Year"
    if (data.title) {
      // Try to extract artist from description (format: "Song · Artist · Album · Year")
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
  isSpotifyTrack,
  extractPlaylistId,
  getPlaylistTracks,
  getTrackInfoFromOEmbed,
};
