const axios = require("axios");
const NodeCache = require("node-cache");
const http = require("http");
const https = require("https");
const { convertLyricsToRomaji, isJapanese } = require("./romajiConverter");

const LAVALINK_URL = process.env.LAVALINK_URL || "http://localhost:2333";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const TIMEOUT_MS = 15_000;

const lyricsCache = new NodeCache({
  stdTTL: 86400, // 24 hours TTL
  checkperiod: 600, // cleanup every 10 minutes
  maxKeys: 500, // max 500 songs in cache (≈50–150KB resident)
  useClones: false, // performance: don't clone objects
});

let _lyricsLookupCount = 0;
function _maybeLogCacheStats() {
  _lyricsLookupCount++;
  if (_lyricsLookupCount % 50 !== 0) return;
  const { hits, misses, keys } = lyricsCache.getStats();
  const total = hits + misses;
  const rate = total === 0 ? 0 : ((hits / total) * 100).toFixed(1);
  console.warn(
    `[lyrics] cache stats: hits=${hits} misses=${misses} keys=${keys} hit_rate=${rate}%`,
  );
}

function getCacheStats() {
  return { ...lyricsCache.getStats(), keys: lyricsCache.keys().length };
}

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: TIMEOUT_MS,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: TIMEOUT_MS,
});

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: TIMEOUT_MS,
});

const {
  cleanTitle,
  cleanAuthor,
  buildQueryStrategies,
  buildCacheKey,
  buildEmbedFromData,
} = require("./lyricsServiceHelper");

async function fetchLavalinkLyrics(player) {
  if (!player?.node?.sessionId || !player?.guildId) {
    console.warn(
      "[Lavalink Lyrics] Invalid player or missing session/guild ID",
    );
    return null;
  }

  try {
    const sessionId = player.node.sessionId;
    const guildId = player.guildId;
    const url = `${LAVALINK_URL}/v4/sessions/${sessionId}/players/${guildId}/track/lyrics`;

    console.warn(`[Lavalink Lyrics] Fetching from: ${url}`);

    const response = await axiosInstance.get(url, {
      headers: {
        Authorization: LAVALINK_PASSWORD,
      },
      timeout: TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    });

    if (response.status !== 200) {
      console.warn(`[Lavalink Lyrics] Non-200 status: ${response.status}`);
      return null;
    }

    if (!response.data?.text) {
      console.warn("[Lavalink Lyrics] No lyrics text in response");
      return null;
    }

    console.warn(
      `[Lavalink Lyrics] ✅ Success | source: ${response.data.source} | length: ${response.data.text.length}`,
    );

    return {
      source: response.data.source || "lrclib",
      text: response.data.text,
      lines: response.data.lines || [],
      hasSyncedLyrics:
        Array.isArray(response.data.lines) && response.data.lines.length > 0,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      console.warn("[Lavalink Lyrics] 404 - No lyrics found");
    } else {
      console.error("[Lavalink Lyrics] Error:", error.message);
    }
    return null;
  }
}

async function searchLyrics(player, track, color) {
  const rawTitle = track.title ?? "";
  const rawAuthor = track.author ?? "";

  const cacheKey = buildCacheKey(track);
  const cached = lyricsCache.get(cacheKey);
  _maybeLogCacheStats();
  if (cached) {
    console.warn(`[lyrics] ✅ Cache hit for: ${cacheKey}`);
    return { embed: buildEmbedFromData(cached, color, rawTitle) };
  }

  const { queries, labels, cleanedTitle, cleanedAuthor } = buildQueryStrategies(
    rawTitle,
    rawAuthor,
  );

  const trackAuthor = cleanedAuthor || cleanAuthor(rawAuthor);
  let trackTitle = cleanedTitle;
  if (
    trackAuthor &&
    cleanedTitle.toLowerCase().includes(trackAuthor.toLowerCase())
  ) {
    const parts = cleanedTitle.split(/\s[-–]\s/);
    if (parts.length >= 2) {
      const songPart = parts.find(
        (p) => !p.toLowerCase().includes(trackAuthor.toLowerCase()),
      );
      if (songPart) trackTitle = songPart.trim();
    }
  }

  console.warn(`[lyrics] Track    : "${rawTitle}"`);
  console.warn(`[lyrics] Author   : "${rawAuthor}"`);
  console.warn(
    `[lyrics] Ref title: "${trackTitle}" | ref author: "${trackAuthor}"`,
  );
  console.warn(`[lyrics] Strategies:`);
  queries.forEach((q, i) =>
    console.warn(`[lyrics]   [${i + 1}] (${labels[i]}) "${q}"`),
  );

  console.warn(`[lyrics] Fetching from Lavalink LRCLIB...`);
  let lavalinkData = await fetchLavalinkLyrics(player);

  if (!lavalinkData || !lavalinkData.text) {
    console.warn(
      `[lyrics] No lyrics found from Lavalink, trying direct LRCLIB...`,
    );

    const { searchLRCLIB } = require("./lrclibClient");
    const directLRCLIB = await searchLRCLIB(
      cleanedTitle,
      trackAuthor || cleanAuthor(rawAuthor),
      null, // album
      track.length ? Math.floor(track.length / 1000) : null, // duration in seconds
    );

    if (directLRCLIB && directLRCLIB.text) {
      console.warn(`[lyrics] ✅ Found via direct LRCLIB API`);
      lavalinkData = directLRCLIB;
    } else {
      console.warn(
        `[lyrics] ❌ No lyrics found from both Lavalink and direct LRCLIB`,
      );
      return { error: "🔹 No lyrics found for this track." };
    }
  }

  const isJp = isJapanese(lavalinkData.text);
  console.warn(`[lyrics] Japanese detected: ${isJp}`);

  let displayLyrics = lavalinkData.text;
  if (isJp) {
    console.warn(`[lyrics] Converting to romaji...`);
    displayLyrics = await convertLyricsToRomaji(lavalinkData.text);
    console.warn(`[lyrics] ✅ Romaji conversion complete`);
  }

  const firstData = {
    title: track.title,
    artist: cleanAuthor(rawAuthor) || "Unknown Artist",
    album: null,
    source: lavalinkData.source,
    is_japanese: isJp,
    url: null,
    lyrics: displayLyrics,
  };

  const fullLyrics = displayLyrics;

  console.warn(
    `[lyrics] source=${firstData.source} | is_jp=${firstData.is_japanese}` +
      ` | artist="${firstData.artist}" | len=${fullLyrics.length}`,
  );

  if (!fullLyrics?.trim()) {
    return { error: "🔹 Lyrics are empty or unavailable for this track." };
  }

  lyricsCache.set(cacheKey, firstData);

  return {
    embed: buildEmbedFromData(firstData, color, rawTitle),
  };
}

function validatePlayerForLyrics(client, interaction) {
  const player = client.manager?.players?.get(interaction.guild.id);
  if (!player) return { error: "❌ No music is currently playing." };

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel || voiceChannel.id !== player.voiceId)
    return { error: "❌ You must be in the same voice channel as the bot." };

  const track = player.queue?.current;
  if (!track) return { error: "❌ No track is currently loaded." };

  return { player, track };
}

module.exports = {
  searchLyrics,
  validatePlayerForLyrics,
  cleanTitle,
  cleanAuthor,
  buildQueryStrategies,
  lyricsCache,
  getCacheStats,
};
