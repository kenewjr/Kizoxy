// Streaming / video / music platforms: YouTube, Twitch clips, BiliBili, Spotify.

const axios = require("axios");
const { resolveEmbedEZ } = require("../fixembedResolverHelper");

module.exports = [
  // ── YouTube ───────────────────────────────────────────────────────
  {
    name: "YouTube",
    originalLabel: "YouTube",
    fixerName: "Koutube",
    match: (u) =>
      /https?:\/\/(?:(?:www|m|music)\.)?youtube\.com\/(?:watch|playlist|shorts\/[^/\s]+)/i.test(
        u,
      ) || /https?:\/\/youtu\.be\/[^/\s?#]+/i.test(u),
    resolve: async (u) => {
      // Normalize youtu.be → youtube.com/watch?v= first
      const youtuBeMatch = u.match(/https?:\/\/youtu\.be\/([^/\s?#]+)(.*)?/i);
      let normalizedUrl = u;
      if (youtuBeMatch) {
        const videoId = youtuBeMatch[1];
        const rest = youtuBeMatch[2] || "";
        const separator = rest.startsWith("?") ? "" : rest ? "?" : "";
        normalizedUrl = `https://youtube.com/watch?v=${videoId}${separator}${rest.replace(/^\?/, "&")}`;
      }

      // Normalize m.youtube.com / music.youtube.com → youtube.com
      normalizedUrl = normalizedUrl.replace(
        /(?:m|music|www)\.youtube\.com/i,
        "youtube.com",
      );

      // Primary: Koutube
      const koutubUrl = normalizedUrl.replace(/youtube\.com/i, "koutube.com");

      // Verify Koutube is responding (lightweight HEAD check)
      try {
        const check = await axios.head(koutubUrl, {
          timeout: 3000,
          maxRedirects: 2,
          validateStatus: (s) => s < 500,
        });
        if (check.status < 400) {
          return { fixed: koutubUrl, authorUrl: null, authorName: null };
        }
      } catch (_) {
        // Koutube down — fall through to EmbedEZ
      }

      // Fallback: EmbedEZ
      const embedEzUrl = await resolveEmbedEZ(normalizedUrl);
      if (embedEzUrl) {
        return { fixed: embedEzUrl, authorUrl: null, authorName: null };
      }

      // Last resort: return Koutube URL anyway (may still work for Discord)
      return { fixed: koutubUrl, authorUrl: null, authorName: null };
    },
  },

  // ── Twitch Clips ──────────────────────────────────────────────────
  {
    name: "Twitch",
    originalLabel: "Clip",
    fixerName: "fxtwitch",
    match: (u) =>
      /https?:\/\/(?:www\.)?twitch\.tv\/[^/\s]+\/clip\/[^/\s]+/i.test(u) ||
      /https?:\/\/clips\.twitch\.tv\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?twitch\.tv/, "fxtwitch.seria.moe");
      const m = u.match(/twitch\.tv\/([^/\s]+)\/clip\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://twitch.tv/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── BiliBili ──────────────────────────────────────────────────────
  {
    name: "BiliBili",
    originalLabel: "BiliBili",
    fixerName: "BiliFix",
    match: (u) =>
      /https?:\/\/(?:[^.]+\.)?(?:bilibili\.com|b23\.tv|b22\.top)\//i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(bilibili\.com|b23\.tv|b22\.top)/i, (m) => "vx" + m),
      authorUrl: null,
      authorName: null,
    }),
  },

  // ── Spotify ───────────────────────────────────────────────────────
  {
    name: "Spotify",
    originalLabel: "Spotify",
    fixerName: "fxspotify",
    match: (u) =>
      /https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?track\/[^/\s?#]+/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/open\.spotify\.com/, "fxspotify.com"),
      authorUrl: null,
      authorName: null,
    }),
  },
];
