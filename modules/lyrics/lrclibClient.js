const axios = require("axios");

const LRCLIB_API = "https://lrclib.net/api";
const LRCLIB_HEADERS = {
  "User-Agent": "Kizoxy Discord Bot (https://github.com/kenewjr/Kizoxy)",
};

async function searchLRCLIB(
  trackName,
  artistName,
  albumName = null,
  duration = null,
) {
  try {
    console.warn(
      `[LRCLIB Direct] Searching: "${trackName}" by "${artistName}"`,
    );

    // Build search params
    const params = {
      track_name: trackName,
      artist_name: artistName,
    };

    if (albumName) params.album_name = albumName;
    if (duration) params.duration = Math.floor(duration);

    // Try GET method (exact match)
    const getUrl = `${LRCLIB_API}/get`;
    const getResponse = await axios.get(getUrl, {
      params,
      headers: LRCLIB_HEADERS,
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });

    if (getResponse.status === 200 && getResponse.data) {
      console.warn(`[LRCLIB Direct] ✅ Found via GET (exact match)`);
      return formatLRCLIBResponse(getResponse.data);
    }

    // If GET fails, try SEARCH method (fuzzy match)
    console.warn(`[LRCLIB Direct] GET failed, trying SEARCH...`);
    const searchUrl = `${LRCLIB_API}/search`;
    const searchResponse = await axios.get(searchUrl, {
      params: {
        q: `${trackName} ${artistName}`,
      },
      headers: LRCLIB_HEADERS,
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });

    if (searchResponse.status === 200 && Array.isArray(searchResponse.data)) {
      const results = searchResponse.data;

      if (results.length === 0) {
        console.warn(`[LRCLIB Direct] ❌ No results found`);
        return null;
      }

      // Find best match
      const bestMatch = findBestMatch(results, trackName, artistName);

      if (bestMatch) {
        console.warn(`[LRCLIB Direct] ✅ Found via SEARCH (fuzzy match)`);
        return formatLRCLIBResponse(bestMatch);
      }
    }

    console.warn(`[LRCLIB Direct] ❌ No lyrics found`);
    return null;
  } catch (error) {
    console.error(`[LRCLIB Direct] Error:`, error.message);
    return null;
  }
}


function findBestMatch(results, trackName, artistName) {
  const trackLower = trackName.toLowerCase();
  const artistLower = artistName.toLowerCase();

  // Score each result
  const scored = results.map((result) => {
    let score = 0;
    const resultTrack = (result.trackName || "").toLowerCase();
    const resultArtist = (result.artistName || "").toLowerCase();

    // Exact match = highest score
    if (resultTrack === trackLower) score += 100;
    else if (resultTrack.includes(trackLower)) score += 50;
    else if (trackLower.includes(resultTrack)) score += 30;

    if (resultArtist === artistLower) score += 100;
    else if (resultArtist.includes(artistLower)) score += 50;
    else if (artistLower.includes(resultArtist)) score += 30;

    // Prefer results with synced lyrics
    if (result.syncedLyrics) score += 20;

    return { result, score };
  });

  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);

  // Only return if score is reasonable (at least 50)
  if (scored[0].score >= 50) {
    return scored[0].result;
  }

  return null;
}

function formatLRCLIBResponse(data) {
  const formatted = {
    source: "lrclib",
    text: data.plainLyrics || data.syncedLyrics || "",
    lines: [],
    hasSyncedLyrics: false,
  };

  // Parse synced lyrics if available
  if (data.syncedLyrics) {
    formatted.lines = parseSyncedLyrics(data.syncedLyrics);
    formatted.hasSyncedLyrics = formatted.lines.length > 0;
  }

  // If no plain lyrics but has synced, extract text from synced
  if (!formatted.text && formatted.lines.length > 0) {
    formatted.text = formatted.lines.map((l) => l.line).join("\n");
  }

  return formatted;
}

function parseSyncedLyrics(lrcText) {
  if (!lrcText) return [];

  const lines = [];
  const lrcLines = lrcText.split("\n");

  for (const line of lrcLines) {
    // Match [mm:ss.xx] or [mm:ss]
    const match = line.match(/^\[(\d+):(\d+)\.?(\d+)?\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const centiseconds = match[3] ? parseInt(match[3]) : 0;
      const text = match[4].trim();

      if (text) {
        // Skip metadata lines
        if (
          text.startsWith("[") ||
          text.toLowerCase().includes("instrumental")
        ) {
          continue;
        }

        const timestamp =
          minutes * 60 * 1000 + seconds * 1000 + centiseconds * 10;
        lines.push({
          line: text,
          timestamp: timestamp,
          duration: 2000, // Default 2 seconds per line
        });
      }
    }
  }

  // Calculate actual durations based on next line's timestamp
  for (let i = 0; i < lines.length - 1; i++) {
    lines[i].duration = lines[i + 1].timestamp - lines[i].timestamp;
  }

  return lines;
}

module.exports = {
  searchLRCLIB,
};
