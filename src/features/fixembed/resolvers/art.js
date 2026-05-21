// Art / illustration sites: Pixiv, DeviantArt, Newgrounds, Fur Affinity.

module.exports = [
  // ── Pixiv ─────────────────────────────────────────────────────────
  {
    name: "Pixiv",
    originalLabel: "Pixiv",
    fixerName: "phixiv",
    match: (u) =>
      /https?:\/\/(?:www\.)?pixiv\.net\/(?:(?:\w+)\/)?artworks\/\d+/i.test(u) ||
      /https?:\/\/(?:www\.)?pixiv\.net\/member_illust\.php/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(?:www\.)?pixiv\.net/, "phixiv.net"),
      authorUrl: null,
      authorName: null,
    }),
  },

  // ── DeviantArt ────────────────────────────────────────────────────
  {
    name: "DeviantArt",
    originalLabel: "DeviantArt",
    fixerName: "fixDeviantArt",
    match: (u) =>
      /https?:\/\/(?:www\.)?deviantart\.com\/[^/\s]+\/(?:art|journal)\/[^/\s]+/i.test(
        u,
      ),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?deviantart\.com/, "fixdeviantart.com");
      const m = u.match(/deviantart\.com\/([^/\s]+)\/(?:art|journal)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://www.deviantart.com/${authorName}`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Newgrounds ────────────────────────────────────────────────────
  {
    name: "Newgrounds",
    originalLabel: "Newgrounds",
    fixerName: "FixNewgrounds",
    match: (u) =>
      /https?:\/\/(?:www\.)?newgrounds\.com\/(?:art\/view|portal\/view)\/[^/\s]+/i.test(
        u,
      ),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?newgrounds\.com/, "fixnewgrounds.com");
      const m = u.match(/art\/view\/([^/\s]+)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://${authorName}.newgrounds.com/`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Fur Affinity ──────────────────────────────────────────────────
  {
    name: "Fur Affinity",
    originalLabel: "Fur Affinity",
    fixerName: "xfuraffinity",
    match: (u) => /https?:\/\/(?:www\.)?furaffinity\.net\/view\/\d+/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(?:www\.)?furaffinity\.net/, "xfuraffinity.net"),
      authorUrl: null,
      authorName: null,
    }),
  },
];
