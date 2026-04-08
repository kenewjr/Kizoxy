// buttons/lyrics.js
// Sumber lirik diatur oleh unified_api.py:
//   1. Lyrical Nonsense (JP)
//   2. LRCLIB
//   3. Genius

const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

// ══════════════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════════════
const UNIFIED_API = "http://localhost:8000/lyrics";
const TIMEOUT_MS  = 15_000;

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

const _BRAND_BLOCKLIST = new Set([
  "valorant","riot games","minecraft","roblox","fortnite","league of legends",
  "youtube","google","spotify","apple","amazon","netflix","disney",
  "warner","sony","universal","epic games","steam","twitch","bandai namco",
]);

function cleanTitle(raw) {
  let t = raw;
  // Full-width brackets （）【】《》 + ASCII brackets
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
  const pipeIdx  = t.indexOf("||");
  if (pipeIdx  !== -1) t = t.slice(0, pipeIdx).trim();
  t = t.replace(/covered?\s*by\s*\S+/gi, "");
  t = t.replace(/歌いました|歌ってみた|歌ってみました|歌わせて|演奏してみた|弾いてみた|叩いてみた|踊ってみた|やってみた|カバー/g, "");
  t = t.replace(/\b(official\s*video\s*clip|official\s*music\s*video|music\s*video|audio|extended|hd|covers?|MV|lyric\s*video)\b/gi, "");
  t = t.replace(/\s+official\s*$/i, "");
  t = t.replace(/\s+lyrics?\s*$/i, "");
  t = t.replace(/[/\\|]\s*$/, "").replace(/^\s*[/\\|]\s*/, "");
  return t.replace(/\s+/g, " ").trim();
}

function extractFtArtist(rawTitle) {
  const m = rawTitle.match(/\b(?:ft|feat)\.\s*([A-Za-z][^\s/|\\]+(?:\s+[A-Za-z][^\s/|\\]+)*)/i);
  return m ? m[1].trim() : "";
}

function cleanAuthor(raw) {
  let t = raw;
  t = t.replace(/\s*ch\..*$/i, "");
  t = t.replace(/hololive.*/i, "");
  t = t.replace(/nijisanji.*/i, "");
  t = t.replace(/\s*[-–]\s*topic$/i, "");
  t = t.replace(/\s*[-–]\s*(official|music|mv|vevo|records?|entertainment|video).*/i, "");
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
  return /歌いました|歌ってみた|歌ってみました|カバー|covered?\s*by/i.test(rawTitle);
}

function sourceLabel(source = "") {
  const map = {
    lyrical_nonsense: "LyricalNonsense",
    lrclib:           "LRCLIB",
    genius:           "Genius",
  };
  return map[source.toLowerCase()] ?? source;
}

function resolveArtist(lyricsArtist, trackAuthor) {
  if (lyricsArtist?.trim()) return lyricsArtist.trim();
  return cleanAuthor(trackAuthor) || "Unknown Artist";
}

function buildFullLyrics(data) {
  if (!data?.lyrics?.length) return "";
  if (data.is_japanese) {
    for (const field of ["romaji", "english", "japanese"]) {
      const merged = data.lyrics
        .map((p) => p[field]?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n");
      if (merged) return merged;
    }
    return "";
  }
  return data.lyrics
    .map((p) => p.english?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

// ══════════════════════════════════════════════════════════════════════════
// Bangun daftar query (4 strategi) — API menangani validasi judul
// ══════════════════════════════════════════════════════════════════════════
function splitTitleSegments(rawTitle) {
  return rawTitle
    .split(/\s[-–×x／/]\s|\s[-–×x／/]|[-–×x／/]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildQueryStrategies(rawTitle, rawAuthor) {
  const cleanedTitle = cleanTitle(rawTitle);
  const cover        = isCover(rawTitle);
  let   author       = cleanAuthor(rawAuthor);

  if (!author && !cover) author = extractFtArtist(rawTitle);

  // Strategi 1 — judul + artis
  const q1 = (!cover && author && !cleanedTitle.toLowerCase().includes(author.toLowerCase()))
    ? `${cleanedTitle} ${author}`.trim()
    : cleanedTitle;

  // Segmen dari rawTitle
  const segments = splitTitleSegments(rawTitle);
  const firstSeg = segments.length > 0 ? cleanTitle(segments[0]) : "";
  const lastSeg  = segments.length > 1 ? cleanTitle(segments[segments.length - 1]) : "";

  // Strategi 2 — segmen pertama sebagai author
  const q2 = (firstSeg && firstSeg.toLowerCase() !== cleanedTitle.toLowerCase())
    ? `${cleanedTitle} ${firstSeg}`.trim()
    : null;

  // Strategi 3 — segmen terakhir sebagai author
  const q3 = (
    lastSeg &&
    lastSeg.toLowerCase() !== firstSeg.toLowerCase() &&
    lastSeg.toLowerCase() !== cleanedTitle.toLowerCase()
  ) ? `${cleanedTitle} ${lastSeg}`.trim() : null;

  // Strategi 4 — judul saja
  const q4 = cleanedTitle;

  const seen    = new Set();
  const queries = [];
  const labels  = [];
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
// Single fetch → null jika gagal / tidak ditemukan
// ══════════════════════════════════════════════════════════════════════════
async function fetchLyrics(query, rawAuthor, trackTitle, trackAuthor) {
  let res;
  try {
    res = await axios.get(UNIFIED_API, {
      params: {
        q:            query,
        lang:         "all",
        page:         1,
        raw_author:   rawAuthor,
        track_title:  trackTitle  || "",
        track_author: trackAuthor || "",
      },
      timeout: TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    console.warn(`[lyrics] Network error for query "${query}":`, err.message);
    return null;
  }
  if (res.status !== 200)        return null;
  if (!res.data?.lyrics?.length) return null;
  return res.data;
}

// ══════════════════════════════════════════════════════════════════════════
// Fetch semua halaman lalu merge
// ══════════════════════════════════════════════════════════════════════════
async function fetchAllPages(query, rawAuthor, firstData, trackTitle, trackAuthor) {
  const MAX_PAGES  = 8;   // lagu nyata jarang >8 halaman; lebih = kompilasi/mix
  const totalPages = Math.min(firstData.pages ?? 1, MAX_PAGES);
  const allLyricPages = [...firstData.lyrics];

  if (totalPages > 1) {
    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        axios.get(UNIFIED_API, {
          params: {
            q:            query,
            lang:         "all",
            page:         i + 2,
            track_title:  trackTitle  || "",
            track_author: trackAuthor || "",
          },
          timeout: TIMEOUT_MS,
          validateStatus: (s) => s < 500,
        }).catch(() => null)
      )
    );
    for (const res of extras) {
      if (res?.data?.lyrics?.length) allLyricPages.push(...res.data.lyrics);
    }
  }

  return allLyricPages;
}

// ══════════════════════════════════════════════════════════════════════════
// Reply aman
// ══════════════════════════════════════════════════════════════════════════
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.reply({ ...payload, ephemeral: true });
  } catch (err) {
    console.error("[lyrics] safeReply failed:", err?.message ?? err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Button Handler
// ══════════════════════════════════════════════════════════════════════════
module.exports = {
  customId: "music-lyrics",

  execute: async (interaction, client) => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch((err) => {
        console.warn("[lyrics] deferReply failed:", err?.message ?? err);
      });
      if (!interaction.deferred && !interaction.replied) return;
    }

    try {
      const player = client.manager?.players?.get(interaction.guild.id);
      if (!player)
        return safeReply(interaction, { content: "❌ No music is currently playing." });

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel || voiceChannel.id !== player.voiceId)
        return safeReply(interaction, { content: "❌ You must be in the same voice channel as the bot." });

      const track = player.queue?.current;
      if (!track)
        return safeReply(interaction, { content: "❌ No track is currently loaded." });

      const rawTitle  = track.title  ?? "";
      const rawAuthor = track.author ?? "";

      const { queries, labels, cleanedTitle, cleanedAuthor } = buildQueryStrategies(rawTitle, rawAuthor);

      // track_title: kirim HANYA nama lagu, bukan full title + artis.
      const trackAuthor = cleanedAuthor || cleanAuthor(rawAuthor);
      let trackTitle = cleanedTitle;
      if (trackAuthor && cleanedTitle.toLowerCase().includes(trackAuthor.toLowerCase())) {
        const parts = cleanedTitle.split(/\s[-–]\s/);
        if (parts.length >= 2) {
          const songPart = parts.find(p => !p.toLowerCase().includes(trackAuthor.toLowerCase()));
          if (songPart) trackTitle = songPart.trim();
        }
      }

      console.log(`[lyrics] Track    : "${rawTitle}"`);
      console.log(`[lyrics] Author   : "${rawAuthor}"`);
      console.log(`[lyrics] Ref title: "${trackTitle}" | ref author: "${trackAuthor}"`);
      console.log(`[lyrics] Strategies:`);
      queries.forEach((q, i) => console.log(`[lyrics]   [${i + 1}] (${labels[i]}) "${q}"`));

      // ── Loop strategi
      let firstData    = null;
      let usedQuery    = null;
      let strategyUsed = 0;

      for (let i = 0; i < queries.length; i++) {
        console.log(`[lyrics] Trying [${i + 1}/${queries.length}] (${labels[i]}): "${queries[i]}"`);

        const candidate = await fetchLyrics(queries[i], rawAuthor, trackTitle, trackAuthor);

        if (candidate) {
          const preview = buildFullLyrics(candidate);
          if (preview?.trim()) {
            firstData    = candidate;
            usedQuery    = queries[i];
            strategyUsed = i + 1;
            console.log(`[lyrics] ✅ Hit on strategy ${strategyUsed} (${labels[i]}) | len=${preview.length}`);
            break;
          }
          console.log(`[lyrics] ⚠️  Data found but lyrics empty on strategy ${i + 1} (${labels[i]}) — continuing...`);
        } else {
          console.log(`[lyrics] ❌ Miss on strategy ${i + 1} (${labels[i]})`);
        }
      }

      if (!firstData) {
        console.log(`[lyrics] All ${queries.length} strategies exhausted — no lyrics found.`);
        return safeReply(interaction, { content: "🔹 No lyrics found for this track." });
      }

      const allLyricPages = await fetchAllPages(usedQuery, rawAuthor, firstData, trackTitle, trackAuthor);

      const lyricsData = {
        ...firstData,
        lyrics: allLyricPages,
        artist: resolveArtist(firstData.artist, rawAuthor),
      };

      const fullLyrics = buildFullLyrics(lyricsData);
      console.log(
        `[lyrics] source=${lyricsData.source} | is_jp=${lyricsData.is_japanese}` +
        ` | artist="${lyricsData.artist}" | len=${fullLyrics.length} | strategy=${strategyUsed}`,
      );

      if (!fullLyrics?.trim())
        return safeReply(interaction, { content: "🔹 Lyrics are empty or unavailable for this track." });

      const flag = lyricsData.is_japanese ? "🇯🇵 " : "";
      const src  = sourceLabel(lyricsData.source ?? "");

      const footerParts = [
        `${flag}${lyricsData.artist}`,
        lyricsData.album ? `📀 ${lyricsData.album}` : null,
        `Powered by ${src}`,
      ].filter(Boolean);

      let displayText = fullLyrics;
      if (displayText.length > 4096) {
        const suffix = lyricsData.url
          ? `...\n[Read more](${lyricsData.url})`
          : "...\n[Lyrics truncated]";
        displayText = displayText.slice(0, 4096 - suffix.length) + suffix;
      }

      const embed = new EmbedBuilder()
        .setColor(client.color ?? 0x9b59b6)
        .setTitle(`🎵 ${lyricsData.title || rawTitle || "Unknown"}`)
        .setDescription(displayText)
        .setFooter({ text: footerParts.join("  ·  ") });

      if (lyricsData.url) embed.setURL(lyricsData.url);

      return safeReply(interaction, { embeds: [embed] });

    } catch (error) {
      console.error("[lyrics] Unexpected error:", error);
      const msg =
        error.type === "request" || error.request
          ? "❌ Could not connect to lyrics service."
          : error.response
            ? "❌ Failed to fetch lyrics. Please try again later."
            : "❌ An error occurred while fetching lyrics.";
      return safeReply(interaction, { content: msg });
    }
  },
};