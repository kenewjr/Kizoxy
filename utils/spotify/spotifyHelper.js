// utils/spotifyHelper.js
// Simple Spotify URL handler using oEmbed API (no auth required)

/**
 * Check if URL is Spotify playlist
 */
function isSpotifyPlaylist(url) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?playlist[/:]([A-Za-z0-9]+)/.test(url);
}

/**
 * Check if URL is Spotify album
 */
function isSpotifyAlbum(url) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?album[/:]([A-Za-z0-9]+)/.test(url);
}

/**
 * Check if URL is Spotify track
 */
function isSpotifyTrack(url) {
  return /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?track[/:]([A-Za-z0-9]+)/.test(url);
}

/**
 * Check if URL is any Spotify URL
 */
function isSpotifyUrl(url) {
  return isSpotifyPlaylist(url) || isSpotifyAlbum(url) || isSpotifyTrack(url);
}

/**
 * Get track info from Spotify oEmbed API (no authentication required)
 * Returns search query string for YouTube
 */
async function getSpotifyTrackInfo(spotifyUrl) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const res = await fetch(oembedUrl);
    
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.title) return null;

    // Extract artist and track name from description
    // Format: "Artist · Track Name" or just "Track Name"
    let searchQuery = data.title;
    
    if (data.description) {
      const parts = data.description.split(" · ");
      if (parts.length >= 2) {
        // Format: "Artist Track Name"
        searchQuery = `${parts[1]} ${parts[0]}`;
      }
    }

    return searchQuery;
  } catch (err) {
    console.error("[SPOTIFY-HELPER] oEmbed failed:", err.message);
    return null;
  }
}

/**
 * Convert Spotify URL to YouTube search query
 * Works for tracks, albums, and playlists
 */
async function spotifyToYouTubeSearch(spotifyUrl) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
    const res = await fetch(oembedUrl);
    
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.title) return null;

    // For playlists/albums, use the title directly
    // For tracks, extract artist + track name
    let searchQuery = data.title;

    if (isSpotifyTrack(spotifyUrl) && data.description) {
      const parts = data.description.split(" · ");
      if (parts.length >= 2) {
        searchQuery = `${parts[1]} ${parts[0]}`;
      }
    }

    return searchQuery;
  } catch (err) {
    console.error("[SPOTIFY-HELPER] Conversion failed:", err.message);
    return null;
  }
}

module.exports = {
  isSpotifyPlaylist,
  isSpotifyAlbum,
  isSpotifyTrack,
  isSpotifyUrl,
  getSpotifyTrackInfo,
  spotifyToYouTubeSearch,
};
