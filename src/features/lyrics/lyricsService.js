// src/features/lyrics/lyricsService.js
const axios = require("axios");
const NodeCache = require("node-cache");
const http = require("http");
const https = require("https");
const Logger = require("../../lib/logger");
const { convertLyricsToRomaji, isJapanese } = require("./romajiConverter");
const { searchLRCLIB } = require("./lrclibClient");
const {
  cleanTitle,
  cleanAuthor,
  splitTitleSegments,
  buildQueryStrategies,
  buildCacheKey,
  buildEmbedFromData,
} = require("./lyricsServiceHelper");

const logger = new Logger("LYRICS");

const LAVALINK_URL = process.env.LAVALINK_URL || "http://localhost:2333";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const TIMEOUT_MS = 15_000;
const DIRECT_LRCLIB_TIMEOUT_MS = 60_000;
const DIRECT_LRCLIB_RETRIES = 2;
const DIRECT_LRCLIB_RETRY_DELAY_MS = 1_000;

const lyricsCache = new NodeCache({
  stdTTL: 86400,
  checkperiod: 600,
  maxKeys: 500,
  useClones: false,
});

let _lyricsLookupCount = 0;
function _maybeLogCacheStats() {
  _lyricsLookupCount++;
  if (_lyricsLookupCount % 50 !== 0) return;
  const { hits, misses, keys } = lyricsCache.getStats();
  const total = hits + misses;
  const rate = total === 0 ? 0 : ((hits / total) * 100).toFixed(1);
  logger.info(
    `cache stats: hits=${hits} misses=${misses} keys=${keys} hit_rate=${rate}%`,
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

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _isRetryableError(error) {
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;
  if (!error.response) return true;
  return false;
}

const _resolvers = [
  {
    name: "LavalinkLrclib",
    resolve: async (trackInfo, player) => {
      if (!player?.node?.sessionId || !player?.guildId) {
        logger.warning("LavalinkLrclib: invalid player or missing session/guild ID");
        return null;
      }

      const sessionId = player.node.sessionId;
      const guildId = player.guildId;
      const url = `${LAVALINK_URL}/v4/sessions/${sessionId}/players/${guildId}/track/lyrics`;

      logger.info(`LavalinkLrclib: fetching from ${url}`);

      try {
        const response = await axiosInstance.get(url, {
          headers: { Authorization: LAVALINK_PASSWORD },
          timeout: TIMEOUT_MS,
          validateStatus: () => true,
        });

        if (response.status < 200 || response.status >= 300) {
          logger.warning(`LavalinkLrclib: non-2xx status ${response.status} — treating as miss`);
          return null;
        }

        if (!response.data?.text) {
          logger.warning("LavalinkLrclib: empty lyrics text in response");
          return null;
        }

        logger.success(
          `LavalinkLrclib: found | source=${response.data.source} | len=${response.data.text.length}`,
        );

        return {
          source: response.data.source || "lrclib",
          text: response.data.text,
          lines: response.data.lines || [],
          hasSyncedLyrics:
            Array.isArray(response.data.lines) && response.data.lines.length > 0,
        };
      } catch (error) {
        logger.warning(`LavalinkLrclib: request failed — ${error.message}`);
        return null;
      }
    },
  },

  {
    name: "DirectLrclib",
    resolve: async (trackInfo) => {
      for (let attempt = 0; attempt <= DIRECT_LRCLIB_RETRIES; attempt++) {
        try {
          const result = await Promise.race([
            searchLRCLIB(trackInfo),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(Object.assign(new Error("LRCLIB timeout"), { code: "ETIMEDOUT" })),
                DIRECT_LRCLIB_TIMEOUT_MS,
              ),
            ),
          ]);

          if (result && result.text) {
            logger.success("DirectLrclib: found");
            return result;
          }

          logger.warning("DirectLrclib: no lyrics returned");
          return null;
        } catch (error) {
          if (_isRetryableError(error) && attempt < DIRECT_LRCLIB_RETRIES) {
            logger.warning(
              `DirectLrclib: attempt ${attempt + 1} failed (${error.message}), retrying...`,
            );
            await _sleep(DIRECT_LRCLIB_RETRY_DELAY_MS);
            continue;
          }
          logger.warning(`DirectLrclib: all attempts exhausted — ${error.message}`);
          return null;
        }
      }

      return null;
    },
  },
];

function registerResolver(resolver) {
  _resolvers.push(resolver);
}

async function searchLyrics(track, player, client) {
  const rawTitle = track.title ?? "";
  const rawAuthor = track.author ?? "";

  const cacheKey = buildCacheKey(track);
  const cached = lyricsCache.get(cacheKey);
  _maybeLogCacheStats();
  if (cached) {
    logger.success(`Cache hit for: ${cacheKey}`);
    return buildEmbedFromData(client, cached);
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

  logger.info(`Track    : "${rawTitle}"`);
  logger.info(`Author   : "${rawAuthor}"`);
  logger.info(`Ref title: "${trackTitle}" | ref author: "${trackAuthor}"`);
  logger.debug(
    `Strategies: ${queries.map((q, i) => `[${i + 1}] (${labels[i]}) "${q}"`).join(", ")}`,
  );

  const trackInfo = {
    rawTitle,
    rawAuthor,
    cleanedTitle: trackTitle,
    cleanedAuthor: trackAuthor,
    duration: track.length ? Math.floor(track.length / 1000) : null,
    queries,
    labels,
    segments: splitTitleSegments(rawTitle),
  };

  let rawData = null;
  for (const resolver of _resolvers) {
    logger.info(`Trying resolver: ${resolver.name}`);
    try {
      rawData = await resolver.resolve(trackInfo, player, client);
    } catch (error) {
      logger.error(`Resolver ${resolver.name} threw unexpectedly: ${error.message}`);
      rawData = null;
    }
    if (rawData) break;
  }

  if (!rawData || !rawData.text) {
    logger.warning("No lyrics found from any resolver");
    return null;
  }

  const isJp = isJapanese(rawData.text);
  logger.info(`Japanese detected: ${isJp}`);

  let displayLyrics = rawData.text;
  if (isJp) {
    logger.info("Converting to romaji...");
    displayLyrics = await convertLyricsToRomaji(rawData.text).catch((err) => {
      logger.error(`Romaji conversion failed: ${err.message}`);
      return rawData.text;
    });
    logger.success("Romaji conversion complete");
  }

  const firstData = {
    title: track.title,
    artist: cleanAuthor(rawAuthor) || "Unknown Artist",
    album: null,
    source: rawData.source,
    is_japanese: isJp,
    url: null,
    lyrics: displayLyrics,
  };

  logger.info(
    `source=${firstData.source} | is_jp=${firstData.is_japanese}` +
      ` | artist="${firstData.artist}" | len=${displayLyrics.length}`,
  );

  if (!displayLyrics?.trim()) {
    return null;
  }

  lyricsCache.set(cacheKey, firstData);

  return buildEmbedFromData(client, firstData);
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
  registerResolver,
  cleanTitle,
  cleanAuthor,
  buildQueryStrategies,
  lyricsCache,
  getCacheStats,
};
