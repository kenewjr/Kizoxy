/**
 * Lyrics Service — shared business logic for lyrics fetching.
 * Used by both:  commands/Slash/Music/Lyrics.js
 *                buttons/lyrics.js
 *
 * Eliminates ~350 lines of duplicated code.
 *
 * NEW: Uses Lavalink LRCLIB directly with romaji conversion
 */

const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const NodeCache = require("node-cache");
const http = require("http");
const https = require("https");
const {
  convertLyricsToRomaji,
  isJapanese,
} = require("../../utils/lyrics/romajiConverter");

// ══════════════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════════════
const LAVALINK_URL = process.env.LAVALINK_URL || "http://localhost:2333";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || "youshallnotpass";
const TIMEOUT_MS = 15_000;

// ══════════════════════════════════════════════════════════════════════════
// Cache & Connection Pooling (Phase 1 Optimization)
// ══════════════════════════════════════════════════════════════════════════
const lyricsCache = new NodeCache({
  stdTTL: 1800, // 30 minutes TTL
  checkperiod: 120, // cleanup every 2 minutes
  maxKeys: 200, // max 200 songs in cache
  useClones: false, // performance: don't clone objects
});

// HTTP connection pooling with keep-alive
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

// Axios instance with connection pooling
const axiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: TIMEOUT_MS,
});

// ══════════════════════════════════════════════════════════════════════════
// Helpers — cleaning & strategy building
// ══════════════════════════════════════════════════════════════════════════
const _BRAND_BLOCKLIST = new Set([
  "valorant",
  "riot games",
  "minecraft",
  "roblox",
  "fortnite",
  "league of legends",
  "youtube",
  "google",
  "spotify",
  "apple",
  "amazon",
  "netflix",
  "disney",
  "warner",
  "sony",
  "universal",
  "epic games",
  "steam",
  "twitch",
  "bandai namco",
]);

function cleanTitle(raw) {
  let t = raw;
  t = t.replace(/（[^）]*）/g, "");
  t = t.replace(/《[^》]*》/g, "");
  t = t.replace(/[「-』][^「-』]*[「-』]/g, "");
  t = t.replace(/【[^】]*】/g, "");
  t = t.replace(/『[^』]*』/g, "");
  t = t.replace(/〈[^〉]*〉/g, "");
  t = t.replace(/\([^)]*\)/g, "");
  t = t.replace(/\[[^\]]*\]/g, "");
  const slashIdx = t.indexOf("//");
  if (slashIdx !== -1) t = t.slice(0, slashIdx).trim();
  const pipeIdx = t.indexOf("||");
  if (pipeIdx !== -1) t = t.slice(0, pipeIdx).trim();
  t = t.replace(/covered?\s*by\s*\S+/gi, "");
  t = t.replace(
    /歌いました|歌ってみた|歌ってみました|歌わせて|演奏してみた|弾いてみた|叩いてみた|踊ってみた|やってみた|カバー/g,
    "",
  );
  t = t.replace(
    /\b(official\s*video\s*clip|official\s*music\s*video|music\s*video|audio|extended|hd|covers?|MV|lyric\s*video)\b/gi,
    "",
  );
  t = t.replace(/\s+official\s*$/i, "");
  t = t.replace(/\s+lyrics?\s*$/i, "");
  t = t.replace(/[/\\|]\s*$/, "").replace(/^\s*[/\\|]\s*/, "");
  return t.replace(/\s+/g, " ").trim();
}

function extractFtArtist(rawTitle) {
  const m = rawTitle.match(
    /\b(?:ft|feat)\.\s*([A-Za-z][^\s/|\\]+(?:\s+[A-Za-z][^\s/|\\]+)*)/i,
  );
  return m ? m[1].trim() : "";
}

function cleanAuthor(raw) {
  let t = raw;
  t = t.replace(/\s*ch\..*$/i, "");
  t = t.replace(/hololive.*/i, "");
  t = t.replace(/nijisanji.*/i, "");
  t = t.replace(/\s*[-–]\s*topic$/i, "");
  t = t.replace(
    /\s*[-–]\s*(official|music|mv|vevo|records?|entertainment|video).*/i,
    "",
  );
  t = t.replace(/\s*official\s*(channel|music|mv|youtube|audio|video)?$/i, "");
  t = t.replace(/\s*(official\s*)?youtube\s*channel$/i, "");
  t = t.replace(/\s*official\s*youtube.*$/i, "");
  t = t.replace(/\s*channel$/i, "");
  t = t.replace(/vevo$/i, "");
  t = t.replace(/\s*\[.*?\]$/g, "");
  t = t.replace(/\s*\(.*?\)$/g, "");
  t = t.trim();
  return _BRAND_BLOCKLIST.has(t.toLowerCase()) ? "" : t;
}

function isCover(rawTitle) {
  return /歌いました|歌ってみた|歌ってみました|カバー|covered?\s*by/i.test(
    rawTitle,
  );
}

function sourceLabel(source = "") {
  const map = {
    lyrical_nonsense: "LyricalNonsense",
    lrclib: "LRCLIB",
    genius: "Genius",
  };
  return map[source.toLowerCase()] ?? source;
}

// ══════════════════════════════════════════════════════════════════════════
// Query strategies
// ══════════════════════════════════════════════════════════════════════════
function splitTitleSegments(rawTitle) {
  return rawTitle
    .split(/\s[-–×x／/]\s|\s[-–×x／/]|[-–×x／/]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildQueryStrategies(rawTitle, rawAuthor) {
  const cleanedTitle = cleanTitle(rawTitle);
  const cover = isCover(rawTitle);
  let author = cleanAuthor(rawAuthor);

  if (!author && !cover) author = extractFtArtist(rawTitle);

  const q1 =
    !cover &&
    author &&
    !cleanedTitle.toLowerCase().includes(author.toLowerCase())
      ? `${cleanedTitle} ${author}`.trim()
      : cleanedTitle;

  const segments = splitTitleSegments(rawTitle);
  const firstSeg = segments.length > 0 ? cleanTitle(segments[0]) : "";
  const lastSeg =
    segments.length > 1 ? cleanTitle(segments[segments.length - 1]) : "";

  const q2 =
    firstSeg && firstSeg.toLowerCase() !== cleanedTitle.toLowerCase()
      ? `${cleanedTitle} ${firstSeg}`.trim()
      : null;

  const q3 =
    lastSeg &&
    lastSeg.toLowerCase() !== firstSeg.toLowerCase() &&
    lastSeg.toLowerCase() !== cleanedTitle.toLowerCase()
      ? `${cleanedTitle} ${lastSeg}`.trim()
      : null;

  const q4 = cleanedTitle;

  const seen = new Set();
  const queries = [];
  const labels = [];
  for (const [q, label] of [
    [q1, "title+author"],
    [q2, "first-seg-as-author"],
    [q3, "last-seg-as-author"],
    [q4, "title-only"],
  ]) {
    if (q && !seen.has(q)) {
      seen.add(q);
      queries.push(q);
      labels.push(label);
    }
  }

  return { queries, labels, cleanedTitle, cleanedAuthor: author };
}

// ══════════════════════════════════════════════════════════════════════════
// Lavalink Lyrics API
// ══════════════════════════════════════════════════════════════════════════

/**
 * Fetch lyrics from Lavalink's built-in LRCLIB
 * @param {object} player - Kazagumo player instance
 * @returns {Promise<object|null>} Lyrics data or null
 */
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

// ══════════════════════════════════════════════════════════════════════════
// REMOVED: fetchAllPages function
// Optimization: API now returns only the requested page, no need to fetch all
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC API — called by both command and button
// ══════════════════════════════════════════════════════════════════════════

/**
 * Search lyrics for the given track and return a Discord embed.
 * @param {object} track  - Kazagumo track object { title, author, ... }
 * @param {string} color  - Embed color (hex)
 * @returns {{ embed: EmbedBuilder } | { error: string }}
 */
async function searchLyrics(player, track, color) {
  const rawTitle = track.title ?? "";
  const rawAuthor = track.author ?? "";

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

  // Fetch lyrics from Lavalink LRCLIB
  console.warn(`[lyrics] Fetching from Lavalink LRCLIB...`);
  let lavalinkData = await fetchLavalinkLyrics(player);

  if (!lavalinkData || !lavalinkData.text) {
    console.warn(
      `[lyrics] No lyrics found from Lavalink, trying direct LRCLIB...`,
    );

    // Fallback: Try direct LRCLIB API with cleaned query
    const { searchLRCLIB } = require("../../utils/lyrics/lrclibClient");
    const directLRCLIB = await searchLRCLIB(
      cleanedTitle,
      trackAuthor || cleanAuthor(rawAuthor),
      null, // album
      track.length ? Math.floor(track.length / 1000) : null, // duration in seconds
    );

    if (directLRCLIB && directLRCLIB.text) {
      console.warn(`[lyrics] ✅ Found via direct LRCLIB API`);
      // Use direct LRCLIB data
      lavalinkData = directLRCLIB;
    } else {
      console.warn(
        `[lyrics] ❌ No lyrics found from both Lavalink and direct LRCLIB`,
      );
      return { error: "🔹 No lyrics found for this track." };
    }
  }

  // Detect if lyrics are Japanese
  const isJp = isJapanese(lavalinkData.text);
  console.warn(`[lyrics] Japanese detected: ${isJp}`);

  // Convert to romaji if Japanese
  let displayLyrics = lavalinkData.text;
  if (isJp) {
    console.warn(`[lyrics] Converting to romaji...`);
    displayLyrics = await convertLyricsToRomaji(lavalinkData.text);
    console.warn(`[lyrics] ✅ Romaji conversion complete`);
  }

  // Build lyrics data object
  const firstData = {
    title: track.title,
    artist: cleanAuthor(rawAuthor) || "Unknown Artist",
    album: null,
    source: lavalinkData.source,
    is_japanese: isJp,
    url: null,
    lyrics: displayLyrics,
  };

  // Lyrics data is ready (already processed above)
  const fullLyrics = displayLyrics;

  console.warn(
    `[lyrics] source=${firstData.source} | is_jp=${firstData.is_japanese}` +
      ` | artist="${firstData.artist}" | len=${fullLyrics.length}`,
  );

  if (!fullLyrics?.trim()) {
    return { error: "🔹 Lyrics are empty or unavailable for this track." };
  }

  // Build embed
  const flag = firstData.is_japanese ? "🇯🇵 " : "";
  const src = sourceLabel(firstData.source ?? "");

  const footerParts = [
    `${flag}${firstData.artist}`,
    firstData.album ? `📀 ${firstData.album}` : null,
    `Powered by ${src}`,
  ].filter(Boolean);

  let displayText = fullLyrics;
  if (displayText.length > 4096) {
    const suffix = firstData.url
      ? `...\n[Read more](${firstData.url})`
      : "...\n[Lyrics truncated]";
    displayText = displayText.slice(0, 4096 - suffix.length) + suffix;
  }

  const embed = new EmbedBuilder()
    .setColor(color ?? 0x9b59b6)
    .setTitle(`🎵 ${firstData.title || rawTitle || "Unknown"}`)
    .setDescription(displayText)
    .setFooter({ text: footerParts.join("  ·  ") });

  if (firstData.url) embed.setURL(firstData.url);

  return {
    embed,
  };
}

/**
 * Validate that a player exists and user is in the correct voice channel.
 * @returns {{ player, track } | { error: string }}
 */
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
  // Exported for testing/extension
  cleanTitle,
  cleanAuthor,
  buildQueryStrategies,
  // Cache management
  lyricsCache,
};
