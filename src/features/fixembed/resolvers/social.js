// Social media platforms: Twitter/X/Nitter, Instagram, TikTok, Reddit,
// Threads, Bluesky, Facebook, Tumblr, Mastodon.

const {
  FX_EMBED_SUBDOMAIN,
  TIKTOK_SUBDOMAIN,
} = require("../fixembedResolverHelper");

module.exports = [
  {
    name: "Twitter",
    originalLabel: "Tweet",
    fixerName: "FxTwitter",
    match: (u) =>
      /https?:\/\/(?:[^.]+\.)?(?:twitter\.com|x\.com|nitter\.net|xcancel\.com|nitter\.poast\.org|nitter\.privacyredirect\.com|lightbrd\.com|nitter\.space|nitter\.tiekoetter\.com)\/(?:\w+\/status\/\d+|i\/status\/\d+)/i.test(
        u,
      ),
    resolve: async (u, viewMode) => {
      const subdomain = FX_EMBED_SUBDOMAIN[viewMode] ?? "";
      const fixed = u.replace(
        /(?:[^./]+\.)?(?:twitter\.com|x\.com|nitter\.net|xcancel\.com|nitter\.poast\.org|nitter\.privacyredirect\.com|lightbrd\.com|nitter\.space|nitter\.tiekoetter\.com)/i,
        subdomain + "fxtwitter.com",
      );
      const m = u.match(/\/([A-Za-z0-9_]+)\/status\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://twitter.com/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Instagram",
    originalLabel: "Instagram",
    fixerName: "InstaFix",
    match: (u) =>
      /https?:\/\/(?:www\.)?instagram\.com\/(?:share\/|p\/|reel(?:s)?\/|tv\/)[^/\s?#]+/i.test(
        u,
      ),
    resolve: async (u, viewMode) => {
      let fixed = u.replace(/(?:www\.)?instagram\.com/, "fxstagram.com");
      if (viewMode === "direct")
        fixed += (fixed.includes("?") ? "&" : "?") + "direct=true";
      if (viewMode === "gallery")
        fixed += (fixed.includes("?") ? "&" : "?") + "gallery=true";
      const m = u.match(/instagram\.com\/([^/?#\s]+)\/(?:p|reel|tv)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://www.instagram.com/${authorName}/`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "TikTok",
    originalLabel: "TikTok",
    fixerName: "fxTikTok",
    match: (u) =>
      /https?:\/\/(?:(?:www|vt|vm)\.)?tiktok\.com\/@[^/\s]+\/(?:video|photo)\/\d+/i.test(
        u,
      ) ||
      /https?:\/\/(?:(?:www|vt|vm)\.)?tiktok\.com\/(?:t|embed|[A-Za-z0-9]+)\/[^/\s]*/i.test(
        u,
      ) ||
      /https?:\/\/(?:vt|vm)\.tiktok\.com\/[A-Za-z0-9]+\/?/i.test(u),
    resolve: async (u, viewMode) => {
      // Expand short URL first if it's a vt.tiktok.com link
      if (/vt\.tiktok\.com|vm\.tiktok\.com/.test(u)) {
        const res = await fetch(u, { method: "HEAD", redirect: "follow" });
        u = res.url; // canonical URL after redirect
      }

      const subdomain = TIKTOK_SUBDOMAIN[viewMode] ?? "a.";
      const fixed = u.replace(
        /(?:(?:www|vt|vm)\.)?tiktok\.com/,
        `${subdomain}tnktok.com`,
      );
      const m = u.match(/tiktok\.com\/@([^/\s?#]+)/i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://www.tiktok.com/@${authorName}`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Reddit",
    originalLabel: "Reddit",
    fixerName: "vxreddit",
    match: (u) =>
      /https?:\/\/(?:www\.)?reddit(?:media)?\.com\/r\/[^/\s]+\/(?:comments|s)\/[^/\s]+/i.test(
        u,
      ) || /https?:\/\/redd\.it\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u
        .replace(/(?:www\.)?reddit\.com/, "vxreddit.com")
        .replace(/redd\.it/, "vxreddit.com");
      const m = u.match(/\/r\/([^/\s?#]+)\//i);
      const authorName = m ? `r/${m[1]}` : null;
      const authorUrl = m ? `https://www.reddit.com/r/${m[1]}/` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Threads",
    originalLabel: "Threads",
    fixerName: "FixThreads",
    match: (u) =>
      /https?:\/\/(?:www\.)?threads\.(?:net|com)\/@[^/\s]+\/post\/[^/\s]+/i.test(
        u,
      ),
    resolve: async (u) => {
      const fixed = u.replace(
        /(?:www\.)?threads\.(?:net|com)/,
        "fixthreads.seria.moe",
      );
      const m = u.match(/\/@([^/\s?#]+)\/post\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://www.threads.net/@${authorName}`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Bluesky",
    originalLabel: "Bluesky",
    fixerName: "FxBluesky",
    match: (u) =>
      /https?:\/\/bsky\.app\/profile\/[^/\s]+\/post\/[^/\s]+/i.test(u),
    resolve: async (u, viewMode) => {
      const subdomain = FX_EMBED_SUBDOMAIN[viewMode] ?? "";
      const fixed = u.replace(/bsky\.app/, `${subdomain}fxbsky.app`);
      const m = u.match(/\/profile\/([^/\s?#]+)\/post\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName
        ? `https://bsky.app/profile/${authorName}`
        : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Facebook",
    originalLabel: "Facebook",
    fixerName: "facebed",
    match: (u) =>
      /https?:\/\/(?:www\.)?facebook\.com\/(?:\w+\/(?:posts|videos)|share\/(?:v|r|p)?\/|reel\/|photo|watch|story\.php|permalink\.php|groups\/)/i.test(
        u,
      ),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?facebook\.com/, "facebed.com");
      return { fixed, authorUrl: null, authorName: null };
    },
  },

  {
    name: "Tumblr",
    originalLabel: "Tumblr",
    fixerName: "fxtumblr",
    match: (u) =>
      /https?:\/\/[a-zA-Z0-9-]+\.tumblr\.com\/(?:post\/\d+|[^/\s]+\/\d+)/i.test(
        u,
      ) ||
      /https?:\/\/(?:www\.)?tumblr\.com\/(?:post\/\d+|[^/\s]+\/\d+)/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/tumblr\.com/, "tpmblr.com");
      const m = u.match(/https?:\/\/([^.]+)\.tumblr\.com/i);
      const authorName = m && m[1] !== "www" ? m[1] : null;
      const authorUrl = authorName ? `https://${authorName}.tumblr.com` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  {
    name: "Mastodon",
    originalLabel: "Mastodon",
    fixerName: "FxMastodon",
    match: (u) =>
      /https?:\/\/(?:mastodon\.social|mstdn\.jp|mastodon\.cloud|mstdn\.social|mastodon\.world|mastodon\.online|mas\.to|techhub\.social|mastodon\.uno|infosec\.exchange)\/@[^/\s]+\/\d+/i.test(
        u,
      ),
    resolve: async (u) => {
      const m = u.match(/https?:\/\/([^/]+)\/@([^/\s]+)\/(\d+)/i);
      if (!m) return null;
      const fixed = `https://fx.zillanlabs.tech/${m[1]}/@${m[2]}/${m[3]}`;
      const authorUrl = `https://${m[1]}/@${m[2]}`;
      return { fixed, authorUrl, authorName: m[2] };
    },
  },
];
