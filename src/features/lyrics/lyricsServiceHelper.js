// utils/helpers/lyricsServiceHelper.js
// Stateless cleaning, query-strategy, and embed-build utilities lifted from
// services/lyrics/lyricsService.js. Network/cache state stays in the source
// file because it depends on module-scoped agents and a NodeCache instance.

const { EmbedBuilder } = require("discord.js");

// ── Brand blocklist ─────────────────────────────────────────────────
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

// ── Title / Author cleaners ─────────────────────────────────────────
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

// ── Query strategies ────────────────────────────────────────────────
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

// ── Cache key + embed ───────────────────────────────────────────────
function buildCacheKey(track) {
  return (
    track?.identifier ||
    track?.uri ||
    `${track?.title ?? ""}|${track?.author ?? ""}`
  );
}

function buildEmbedFromData(firstData, color, rawTitle) {
  const flag = firstData.is_japanese ? "🇯🇵 " : "";
  const src = sourceLabel(firstData.source ?? "");

  const footerParts = [
    `${flag}${firstData.artist}`,
    firstData.album ? `📀 ${firstData.album}` : null,
    `Powered by ${src}`,
  ].filter(Boolean);

  let displayText = firstData.lyrics;
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
  return embed;
}

module.exports = {
  cleanTitle,
  cleanAuthor,
  extractFtArtist,
  isCover,
  sourceLabel,
  splitTitleSegments,
  buildQueryStrategies,
  buildCacheKey,
  buildEmbedFromData,
};
