// src/features/lyrics/lyricsServiceHelper.js
const Embeds = require("../../lib/embeds");

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
  t = t.replace(/(.*?)/g, "");
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

function splitTitleSegments(rawTitle) {
  return rawTitle
    .split(/\s[-–×x／/]\s|\s[-–×x／/]|[-–×x／/]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Ordered list of parenthetical patterns that identify the original artist.
// Each entry is [regex, captureGroupIndex]. We capture the artist name from
// inside the parenthetical before we strip it, so the cover-aware query
// strategies can search for the original recording.
const _ORIGINAL_ARTIST_PATTERNS = [
  // "Cover by X" / "Covered by X"
  /\(\s*covers?\s+by\s+([^)]+?)\s*\)/i,
  // "Cover of X"
  /\(\s*covers?\s+of\s+([^)]+?)\s*\)/i,
  // "Originally by X"
  /\(\s*originally\s+by\s+([^)]+?)\s*\)/i,
  // "Made famous by X"
  /\(\s*made\s+famous\s+by\s+([^)]+?)\s*\)/i,
  // "X cover" — e.g. "(Ed Sheeran cover)"
  /\(\s*([^)]+?)\s+covers?\s*\)/i,
];

// Parenthetical / bracket content that flags the track as a cover/remix/live
// variant but does NOT contain an artist name we want to capture.
const _NOISE_PAREN_RE =
  /\(\s*(?:covers?(?:\s+(?:version|by|of)\b[^)]*)?|remixed?(?:\s+(?:version|by)\b[^)]*)?|live(?:\s+(?:version|at|from)\b[^)]*)?|acoustic(?:\s+version)?|originally\s+by\s+[^)]+|made\s+famous\s+by\s+[^)]+|official(?:\s+(?:video|music\s+video|audio))?|music\s+video|mv|lyric(?:s)?\s+video|ft\.?\s+[^)]+|feat(?:uring)?\s+[^)]+)\s*\)/gi;

const _NOISE_BRACKET_RE =
  /\[\s*(?:covers?(?:\s+(?:version|by|of)\b[^]]*)?|remixed?(?:\s+(?:version|by)\b[^]]*)?|live(?:\s+(?:version|at|from)\b[^]]*)?|acoustic(?:\s+version)?|official(?:\s+(?:video|music\s+video|audio))?|music\s+video|mv|lyric(?:s)?\s+video)\s*\]/gi;

// Dash-prefixed YouTube-style suffixes appended without parentheses.
const _NOISE_DASH_SUFFIX_RE =
  /\s*[-–]\s*(?:official\s+(?:video|music\s+video|audio|lyric(?:s)?\s+video)|music\s+video|lyric(?:s)?\s+video|cover|acoustic|live)\s*$/i;

// Pipe-separated subtitle ("|" is sometimes used in YouTube titles).
const _PIPE_SUFFIX_RE = /\s*\|[^|]+$/;

/**
 * Strips cover/remix/live noise from a track title and extracts the original
 * artist name when it appears in a parenthetical.
 *
 * Returns { cleanTitle, originalArtist } where originalArtist is null when
 * no original artist could be identified from the parentheticals.
 */
function extractOriginalMetadata(title, _author) {
  let t = String(title || "");

  // STEP A — capture original artist before stripping parentheticals.
  let originalArtist = null;
  for (const pattern of _ORIGINAL_ARTIST_PATTERNS) {
    const m = t.match(pattern);
    if (m && m[1]) {
      originalArtist = m[1].trim();
      break;
    }
  }

  // STEP B — strip noise parentheticals, brackets, and dash suffixes.
  t = t.replace(_NOISE_PAREN_RE, "");
  t = t.replace(_NOISE_BRACKET_RE, "");
  t = t.replace(_NOISE_DASH_SUFFIX_RE, "");
  t = t.replace(_PIPE_SUFFIX_RE, "");

  // STEP C — normalise.
  t = t.replace(/×/g, "x");
  t = t.replace(/\s+/g, " ").trim();

  const cleanTitle = t || String(title || "");

  return { cleanTitle, originalArtist };
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

  // Cover-aware extras: strip noise from the raw title to get a clean base,
  // then build three additional strategies targeting the original recording.
  const { cleanTitle: coverClean, originalArtist } = extractOriginalMetadata(
    rawTitle,
    rawAuthor,
  );
  const coverCleanLower = coverClean.toLowerCase();
  const cleanedTitleLower = cleanedTitle.toLowerCase();
  const isCoverCleanDifferent = coverCleanLower !== cleanedTitleLower;

  // [5] clean-title + original-artist (most precise cover fallback)
  const q5 =
    originalArtist && isCoverCleanDifferent
      ? `${coverClean} ${originalArtist}`.trim()
      : null;

  // [6] clean-title + cover-uploader (the channel name; works when the uploader
  // uses their real artist name for covers of their own originals)
  const q6 =
    isCoverCleanDifferent && author
      ? `${coverClean} ${author}`.trim()
      : null;

  // [7] clean-title alone
  const q7 = isCoverCleanDifferent ? coverClean : null;

  const seen = new Set();
  const queries = [];
  const labels = [];
  for (const [q, label] of [
    [q1, "title+author"],
    [q2, "first-seg-as-author"],
    [q3, "last-seg-as-author"],
    [q4, "title-only"],
    [q5, "cover:clean+original-artist"],
    [q6, "cover:clean+uploader"],
    [q7, "cover:clean-only"],
  ]) {
    if (q && !seen.has(q.toLowerCase())) {
      seen.add(q.toLowerCase());
      queries.push(q);
      labels.push(label);
    }
  }

  return { queries, labels, cleanedTitle, cleanedAuthor: author };
}

function buildCacheKey(track) {
  return (
    track?.identifier ||
    track?.uri ||
    `${track?.title ?? ""}|${track?.author ?? ""}`
  );
}

function buildEmbedFromData(client, data) {
  const flag = data.is_japanese ? "🇯🇵 " : "";
  const src = sourceLabel(data.source ?? "");

  const footerParts = [
    `${flag}${data.artist}`,
    data.album ? `📀 ${data.album}` : null,
    `Powered by ${src}`,
  ].filter(Boolean);

  let displayText = data.lyrics;
  if (displayText.length > 4096) {
    const suffix = data.url
      ? `...\n[Read more](${data.url})`
      : "...\n[Lyrics truncated]";
    displayText = displayText.slice(0, 4096 - suffix.length) + suffix;
  }

  return Embeds.music(client, {
    title: `🎵 ${data.title || "Unknown"}`,
    description: displayText,
    footerText: footerParts.join("  ·  "),
    url: data.url || undefined,
  });
}

module.exports = {
  cleanTitle,
  cleanAuthor,
  extractFtArtist,
  extractOriginalMetadata,
  isCover,
  sourceLabel,
  splitTitleSegments,
  buildQueryStrategies,
  buildCacheKey,
  buildEmbedFromData,
};
