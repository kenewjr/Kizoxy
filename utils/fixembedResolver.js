/**
 * fixembedResolver.js
 * Detects social media URLs, resolves author info, and returns fixed URLs.
 * Supports view modes: normal | direct | gallery | text
 * Domains sourced from the FixTweetBot project.
 */

const axios = require("axios");

const URL_REGEX = /https?:\/\/[^\s<>"\])\\']+/gi;

// ─── EmbedEZ ────────────────────────────────────────────────────────────────
async function resolveEmbedEZ(url) {
  try {
    const res = await axios.get("https://embedez.com/api/v1/providers/combined", {
      params: { q: url },
      timeout: 5000,
    });
    if (res.status === 200 && res.data?.data?.key) {
      return `https://embedez.com/embed/${res.data.data.key}`;
    }
  } catch (_) {}
  return null;
}

// ─── View-mode subdomain helpers ─────────────────────────────────────────────
const FX_EMBED_SUBDOMAIN = {
  normal:  '',
  gallery: 'g.',
  text:    't.',
  direct:  'd.',
};

const TIKTOK_SUBDOMAIN = {
  normal:  'a.',
  gallery: '',
  direct:  'd.',
  text:    'a.',
};

// ─── Spoiler detection ────────────────────────────────────────────────────────
function isSpoiler(content, url) {
  // Check if this URL appears between ||…|| markers
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\|\\|[^|]*${escaped}[^|]*\\|\\|`).test(content);
}

// ─── Author extractor helpers ────────────────────────────────────────────────
function usernameFromPath(url, afterDomain) {
  // e.g. /username/... → extract first segment
  const m = url.match(new RegExp(`${afterDomain}\\/([^/?#\\s]+)`, 'i'));
  return m ? m[1] : null;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────
/**
 * Each resolver:
 *   name          – platform display name
 *   originalLabel – label for the content type (Tweet, Reel, etc.)
 *   fixerName     – name of the fix service
 *   match(url)    – bool
 *   resolve(url, viewMode) → { fixed, authorUrl, authorName } | null
 */
const RESOLVERS = [

  // ── Twitter / X / Nitter ──────────────────────────────────────────────────
  {
    name: 'Twitter',
    originalLabel: 'Tweet',
    fixerName: 'FxTwitter',
    match: (u) =>
      /https?:\/\/(?:[^.]+\.)?(?:twitter\.com|x\.com|nitter\.net|xcancel\.com|nitter\.poast\.org|nitter\.privacyredirect\.com|lightbrd\.com|nitter\.space|nitter\.tiekoetter\.com)\/(?:\w+\/status\/\d+|i\/status\/\d+)/i.test(u),
    resolve: async (u, viewMode) => {
      const subdomain = FX_EMBED_SUBDOMAIN[viewMode] ?? '';
      const fixed = u.replace(
        /(?:[^./]+\.)?(?:twitter\.com|x\.com|nitter\.net|xcancel\.com|nitter\.poast\.org|nitter\.privacyredirect\.com|lightbrd\.com|nitter\.space|nitter\.tiekoetter\.com)/i,
        subdomain + 'fxtwitter.com'
      );
      const m = u.match(/\/([A-Za-z0-9_]+)\/status\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://twitter.com/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Instagram ─────────────────────────────────────────────────────────────
  {
    name: 'Instagram',
    originalLabel: 'Instagram',
    fixerName: 'InstaFix',
    match: (u) =>
      /https?:\/\/(?:www\.)?instagram\.com\/(?:share\/|p\/|reel(?:s)?\/|tv\/)[^/\s?#]+/i.test(u),
    resolve: async (u, viewMode) => {
      let fixed = u.replace(/(?:www\.)?instagram\.com/, 'fxstagram.com');
      if (viewMode === 'direct') fixed += (fixed.includes('?') ? '&' : '?') + 'direct=true';
      if (viewMode === 'gallery') fixed += (fixed.includes('?') ? '&' : '?') + 'gallery=true';
      // Try to extract username: instagram.com/username/p/id
      const m = u.match(/instagram\.com\/([^/?#\s]+)\/(?:p|reel|tv)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://www.instagram.com/${authorName}/` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── TikTok ────────────────────────────────────────────────────────────────
  {
    name: 'TikTok',
    originalLabel: 'TikTok',
    fixerName: 'fxTikTok',
    match: (u) =>
      /https?:\/\/(?:(?:www|vt|vm)\.)?tiktok\.com\/@[^/\s]+\/(?:video|photo)\/\d+/i.test(u) ||
      /https?:\/\/(?:(?:www|vt|vm)\.)?tiktok\.com\/(?:t|embed|[A-Za-z0-9]+)\/[^/\s]*/i.test(u) ||
      /https?:\/\/(?:vt|vm)\.tiktok\.com\/[A-Za-z0-9]+\/?/i.test(u),
    resolve: async (u, viewMode) => {
      // Expand short URL dulu jika dari vt.tiktok.com
      if (/vt\.tiktok\.com|vm\.tiktok\.com/.test(u)) {
        const res = await fetch(u, { method: 'HEAD', redirect: 'follow' });
        u = res.url; // URL asli setelah redirect
      }

      const subdomain = TIKTOK_SUBDOMAIN[viewMode] ?? 'a.';
      const fixed = u.replace(/(?:(?:www|vt|vm)\.)?tiktok\.com/, `${subdomain}tnktok.com`);
      const m = u.match(/tiktok\.com\/@([^/\s?#]+)/i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://www.tiktok.com/@${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Reddit ────────────────────────────────────────────────────────────────
  {
    name: 'Reddit',
    originalLabel: 'Reddit',
    fixerName: 'vxreddit',
    match: (u) =>
      /https?:\/\/(?:www\.)?reddit(?:media)?\.com\/r\/[^/\s]+\/(?:comments|s)\/[^/\s]+/i.test(u) ||
      /https?:\/\/redd\.it\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u
        .replace(/(?:www\.)?reddit\.com/, 'vxreddit.com')
        .replace(/redd\.it/, 'vxreddit.com');
      const m = u.match(/\/r\/([^/\s?#]+)\//i);
      const authorName = m ? `r/${m[1]}` : null;
      const authorUrl = m ? `https://www.reddit.com/r/${m[1]}/` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Threads ───────────────────────────────────────────────────────────────
  {
    name: 'Threads',
    originalLabel: 'Threads',
    fixerName: 'FixThreads',
    match: (u) =>
      /https?:\/\/(?:www\.)?threads\.(?:net|com)\/@[^/\s]+\/post\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?threads\.(?:net|com)/, 'fixthreads.seria.moe');
      const m = u.match(/\/@([^/\s?#]+)\/post\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://www.threads.net/@${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Bluesky ───────────────────────────────────────────────────────────────
  {
    name: 'Bluesky',
    originalLabel: 'Bluesky',
    fixerName: 'FxBluesky',
    match: (u) =>
      /https?:\/\/bsky\.app\/profile\/[^/\s]+\/post\/[^/\s]+/i.test(u),
    resolve: async (u, viewMode) => {
      const subdomain = FX_EMBED_SUBDOMAIN[viewMode] ?? '';
      const fixed = u.replace(/bsky\.app/, `${subdomain}fxbsky.app`);
      const m = u.match(/\/profile\/([^/\s?#]+)\/post\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://bsky.app/profile/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Facebook ──────────────────────────────────────────────────────────────
  {
    name: 'Facebook',
    originalLabel: 'Facebook',
    fixerName: 'facebed',
    match: (u) =>
      /https?:\/\/(?:www\.)?facebook\.com\/(?:\w+\/(?:posts|videos)|share\/(?:v|r|p)?\/|reel\/|photo|watch|story\.php|permalink\.php|groups\/)/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?facebook\.com/, 'facebed.com');
      return { fixed, authorUrl: null, authorName: null };
    },
  },

  // ── Pixiv ─────────────────────────────────────────────────────────────────
  {
    name: 'Pixiv',
    originalLabel: 'Pixiv',
    fixerName: 'phixiv',
    match: (u) =>
      /https?:\/\/(?:www\.)?pixiv\.net\/(?:(?:\w+)\/)?artworks\/\d+/i.test(u) ||
      /https?:\/\/(?:www\.)?pixiv\.net\/member_illust\.php/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(?:www\.)?pixiv\.net/, 'phixiv.net'),
      authorUrl: null, authorName: null,
    }),
  },

  // ── YouTube ───────────────────────────────────────────────────────────────
  {
    name: 'YouTube',
    originalLabel: 'YouTube',
    fixerName: 'Koutube',
    match: (u) =>
      /https?:\/\/(?:www\.)?youtube\.com\/(?:watch|playlist|shorts\/[^/\s]+)/i.test(u) ||
      /https?:\/\/youtu\.be\/[^/\s?#]+/i.test(u),
    resolve: async (u) => {
      const fixed = u
        .replace(/(?:www\.)?youtube\.com/, 'koutube.com')
        .replace(/youtu\.be/, 'koutube.com');
      return { fixed, authorUrl: null, authorName: null };
    },
  },

  // ── Tumblr ────────────────────────────────────────────────────────────────
  {
    name: 'Tumblr',
    originalLabel: 'Tumblr',
    fixerName: 'fxtumblr',
    match: (u) =>
      /https?:\/\/[a-zA-Z0-9-]+\.tumblr\.com\/(?:post\/\d+|[^/\s]+\/\d+)/i.test(u) ||
      /https?:\/\/(?:www\.)?tumblr\.com\/(?:post\/\d+|[^/\s]+\/\d+)/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/tumblr\.com/, 'tpmblr.com');
      const m = u.match(/https?:\/\/([^.]+)\.tumblr\.com/i);
      const authorName = (m && m[1] !== 'www') ? m[1] : null;
      const authorUrl = authorName ? `https://${authorName}.tumblr.com` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Mastodon ──────────────────────────────────────────────────────────────
  {
    name: 'Mastodon',
    originalLabel: 'Mastodon',
    fixerName: 'FxMastodon',
    match: (u) =>
      /https?:\/\/(?:mastodon\.social|mstdn\.jp|mastodon\.cloud|mstdn\.social|mastodon\.world|mastodon\.online|mas\.to|techhub\.social|mastodon\.uno|infosec\.exchange)\/@[^/\s]+\/\d+/i.test(u),
    resolve: async (u) => {
      const m = u.match(/https?:\/\/([^/]+)\/@([^/\s]+)\/(\d+)/i);
      if (!m) return null;
      const fixed = `https://fx.zillanlabs.tech/${m[1]}/@${m[2]}/${m[3]}`;
      const authorUrl = `https://${m[1]}/@${m[2]}`;
      return { fixed, authorUrl, authorName: m[2] };
    },
  },

  // ── Twitch Clips ──────────────────────────────────────────────────────────
  {
    name: 'Twitch',
    originalLabel: 'Clip',
    fixerName: 'fxtwitch',
    match: (u) =>
      /https?:\/\/(?:www\.)?twitch\.tv\/[^/\s]+\/clip\/[^/\s]+/i.test(u) ||
      /https?:\/\/clips\.twitch\.tv\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?twitch\.tv/, 'fxtwitch.seria.moe');
      const m = u.match(/twitch\.tv\/([^/\s]+)\/clip\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://twitch.tv/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Spotify ───────────────────────────────────────────────────────────────
  {
    name: 'Spotify',
    originalLabel: 'Spotify',
    fixerName: 'fxspotify',
    match: (u) =>
      /https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?track\/[^/\s?#]+/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/open\.spotify\.com/, 'fxspotify.com'),
      authorUrl: null, authorName: null,
    }),
  },

  // ── DeviantArt ────────────────────────────────────────────────────────────
  {
    name: 'DeviantArt',
    originalLabel: 'DeviantArt',
    fixerName: 'fixDeviantArt',
    match: (u) =>
      /https?:\/\/(?:www\.)?deviantart\.com\/[^/\s]+\/(?:art|journal)\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?deviantart\.com/, 'fixdeviantart.com');
      const m = u.match(/deviantart\.com\/([^/\s]+)\/(?:art|journal)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://www.deviantart.com/${authorName}` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Newgrounds ────────────────────────────────────────────────────────────
  {
    name: 'Newgrounds',
    originalLabel: 'Newgrounds',
    fixerName: 'FixNewgrounds',
    match: (u) =>
      /https?:\/\/(?:www\.)?newgrounds\.com\/(?:art\/view|portal\/view)\/[^/\s]+/i.test(u),
    resolve: async (u) => {
      const fixed = u.replace(/(?:www\.)?newgrounds\.com/, 'fixnewgrounds.com');
      const m = u.match(/art\/view\/([^/\s]+)\//i);
      const authorName = m ? m[1] : null;
      const authorUrl = authorName ? `https://${authorName}.newgrounds.com/` : null;
      return { fixed, authorUrl, authorName };
    },
  },

  // ── Fur Affinity ──────────────────────────────────────────────────────────
  {
    name: 'Fur Affinity',
    originalLabel: 'Fur Affinity',
    fixerName: 'xfuraffinity',
    match: (u) =>
      /https?:\/\/(?:www\.)?furaffinity\.net\/view\/\d+/i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(?:www\.)?furaffinity\.net/, 'xfuraffinity.net'),
      authorUrl: null, authorName: null,
    }),
  },

  // ── BiliBili ──────────────────────────────────────────────────────────────
  {
    name: 'BiliBili',
    originalLabel: 'BiliBili',
    fixerName: 'BiliFix',
    match: (u) =>
      /https?:\/\/(?:[^.]+\.)?(?:bilibili\.com|b23\.tv|b22\.top)\//i.test(u),
    resolve: async (u) => ({
      fixed: u.replace(/(bilibili\.com|b23\.tv|b22\.top)/i, (m) => 'vx' + m),
      authorUrl: null, authorName: null,
    }),
  },

  // ── EmbedEZ-backed platforms ─────────────────────────────────────────────

  {
    name: 'Snapchat',
    originalLabel: 'Snapchat',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:www\.)?snapchat\.com\/(?:p\/|spotlight\/|@[^/\s]+\/spotlight\/)/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Pinterest',
    originalLabel: 'Pinterest',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:www\.)?pinterest\.com\/pin\/[^/\s]+/i.test(u) ||
      /https?:\/\/pin\.it\/[^/\s]+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'IFunny',
    originalLabel: 'IFunny',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/ifunny\.co\/(?:video|picture|gif)\/[^/\s]+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Imgur',
    originalLabel: 'Imgur',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:i\.)?imgur\.com\/(?:gallery\/)?[^/\s?#]+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Weibo',
    originalLabel: 'Weibo',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:www\.)?weibo\.(?:com|cn)\/[^/\s]+\/[^/\s]+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Booru',
    originalLabel: 'Post',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:rule34\.xxx|gelbooru\.com|safebooru\.org|realbooru\.com|hypnohub\.net|xbooru\.com|tbib\.org)\/index\.php/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Danbooru',
    originalLabel: 'Post',
    fixerName: 'EmbedEZ',
    match: (u) => /https?:\/\/danbooru\.donmai\.us\/posts\/\d+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'e621',
    originalLabel: 'Post',
    fixerName: 'EmbedEZ',
    match: (u) => /https?:\/\/(?:e621|e926)\.net\/posts\/\d+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Moebooru',
    originalLabel: 'Post',
    fixerName: 'EmbedEZ',
    match: (u) =>
      /https?:\/\/(?:konachan\.(?:com|net)|yande\.re)\/post\/show\/\d+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Derpibooru',
    originalLabel: 'Image',
    fixerName: 'EmbedEZ',
    match: (u) => /https?:\/\/derpibooru\.org\/images\/\d+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
  {
    name: 'Rule34',
    originalLabel: 'Post',
    fixerName: 'EmbedEZ',
    match: (u) => /https?:\/\/rule34\.paheal\.net\/post\/view\/\d+/i.test(u),
    resolve: async (u) => ({ fixed: await resolveEmbedEZ(u), authorUrl: null, authorName: null }),
  },
];

/**
 * Extract and fix all social media URLs in a message.
 *
 * @param {string} content        - Original message content
 * @param {string} [viewMode='normal'] - 'normal' | 'direct' | 'gallery' | 'text'
 * @returns {Promise<Array<{
 *   original: string, originalLabel: string,
 *   authorUrl: string|null, authorName: string|null,
 *   fixed: string|null, fixerName: string,
 *   platform: string, changed: boolean, spoiler: boolean
 * }>>}
 */
async function extractFixedLinks(content, viewMode = 'normal') {
  const urls = [...(content.matchAll(URL_REGEX) || [])].map((m) => m[0]);
  const results = [];
  const seen = new Set();

  for (const url of urls) {
    const cleanUrl = url.replace(/[.,!?)]+$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    for (const resolver of RESOLVERS) {
      if (resolver.match(cleanUrl)) {
        try {
          const res = await resolver.resolve(cleanUrl, viewMode);
          if (res && res.fixed) {
            results.push({
              original:      cleanUrl,
              originalLabel: resolver.originalLabel,
              authorUrl:     res.authorUrl,
              authorName:    res.authorName,
              fixed:         res.fixed,
              fixerName:     resolver.fixerName,
              platform:      resolver.name,
              changed:       res.fixed !== cleanUrl,
              spoiler:       isSpoiler(content, cleanUrl),
            });
          }
        } catch (err) {
          console.error(`[FixEmbed] Resolver error for ${resolver.name}:`, err.message);
        }
        break;
      }
    }
  }

  return results;
}

module.exports = { extractFixedLinks };
