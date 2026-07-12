const NodeCache = require("node-cache");
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
  extractOriginalMetadata,
} = require("./lyricsServiceHelper");

const logger = new Logger("LYRICS");

const LAVALINK_URL = process.env.LAVALINK_URL || "http://localhost:2333";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const TIMEOUT_MS = 15_000;

const LAVALINK_LYRICS_ENABLED = false;

const DIRECT_LRCLIB_TIMEOUT_MS = 15_000;
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
      if (!LAVALINK_LYRICS_ENABLED) {
        logger.debug(
          "LavalinkLrclib: disabled — Java TLS incompatible with lrclib.net",
        );
        return null;
      }

      if (!player?.node?.sessionId || !player?.guildId) {
        logger.warning(
          "LavalinkLrclib: invalid player or missing session/guild ID",
        );
        return null;
      }

      const sessionId = player.node.sessionId;
      const guildId = player.guildId;
      const url = `${LAVALINK_URL}/v4/sessions/${sessionId}/players/${guildId}/track/lyrics`;

      logger.info(`LavalinkLrclib: fetching from ${url}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { Authorization: LAVALINK_PASSWORD },
          signal: controller.signal,
        });

        if (response.status < 200 || response.status >= 300) {
          logger.warning(
            `LavalinkLrclib: non-2xx status ${response.status} — treating as miss`,
          );
          return null;
        }

        const data = await response.json();
        if (!data?.text) {
          logger.warning("LavalinkLrclib: empty lyrics text in response");
          return null;
        }

        logger.success(
          `LavalinkLrclib: found | source=${data.source} | len=${data.text.length}`,
        );

        return {
          source: data.source || "lrclib",
          text: data.text,
          lines: data.lines || [],
          hasSyncedLyrics: Array.isArray(data.lines) && data.lines.length > 0,
        };
      } catch (error) {
        logger.warning(`LavalinkLrclib: request failed — ${error.message}`);
        return null;
      } finally {
        clearTimeout(timer);
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
              setTimeout(() => {
                const err = new Error("DirectLrclib: timed out after 15s");
                err.code = "ETIMEDOUT";
                reject(err);
              }, DIRECT_LRCLIB_TIMEOUT_MS),
            ),
          ]);

          if (result && result.text) {
            logger.success("DirectLrclib: found");
            return result;
          }

          logger.warning("DirectLrclib: no lyrics returned");
          return null;
        } catch (error) {
          if (error.message === "DirectLrclib: timed out after 15s") {
            logger.warning("DirectLrclib: timed out after 15s");
            return null;
          }
          if (_isRetryableError(error) && attempt < DIRECT_LRCLIB_RETRIES) {
            logger.warning(
              `DirectLrclib: attempt ${attempt + 1} failed (${error.message}), retrying...`,
            );
            await _sleep(DIRECT_LRCLIB_RETRY_DELAY_MS);
            continue;
          }
          logger.warning(
            `DirectLrclib: all attempts exhausted — ${error.message}`,
          );
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

  // Extract cover-clean title and original artist before building strategies.
  // This is the single call site — result is passed into buildQueryStrategies
  // so the helper does not duplicate the work internally.
  const { cleanTitle: coverCleanTitle, originalArtist } =
    extractOriginalMetadata(rawTitle, rawAuthor);

  const { queries, labels, cleanedTitle, cleanedAuthor } = buildQueryStrategies(
    rawTitle,
    rawAuthor,
  );

  const trackAuthor = cleanedAuthor || cleanAuthor(rawAuthor);

  // Use the cover-cleaned title as the ref title for the resolver. This
  // replaces the old segment-split heuristic, which only handled "Artist × Title"
  // patterns but not cover parentheticals.
  const trackTitle = coverCleanTitle || cleanedTitle;

  logger.info(`Track    : "${rawTitle}"`);
  logger.info(`Author   : "${rawAuthor}"`);
  logger.info(`Ref title: "${trackTitle}" | ref author: "${trackAuthor}"`);
  logger.debug(
    `Cover-clean: "${coverCleanTitle}" | original artist: "${originalArtist ?? "none"}"`,
  );
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
      logger.error(
        `Resolver ${resolver.name} threw unexpectedly: ${error.message}`,
      );
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
  logger.debug(`Lyrics cached: key=${cacheKey} | ttl=24h`);

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
