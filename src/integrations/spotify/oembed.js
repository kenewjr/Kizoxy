const OEMBED_BASE = "https://open.spotify.com/oembed";

/**
 * Look up a Spotify URL's display title via the public oEmbed endpoint.
 * No auth required. Works for track/album/artist/playlist/show URLs, but
 * for playlists and albums this only returns the collection's own title,
 * not its track listing — only useful as a search fallback for single
 * tracks/albums/artists, not for expanding a playlist.
 * Returns null on any failure (network error, non-200, missing title) —
 * callers should treat null as "fallback unavailable", not throw.
 */
async function getSpotifyOembedTitle(spotifyUrl) {
  try {
    const res = await fetch(
      `${OEMBED_BASE}?url=${encodeURIComponent(spotifyUrl)}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : null;
  } catch {
    return null;
  }
}

module.exports = { getSpotifyOembedTitle };
