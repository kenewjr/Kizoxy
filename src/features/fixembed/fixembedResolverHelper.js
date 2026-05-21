// utils/helpers/fixembedResolverHelper.js
// URL detection, EmbedEZ proxy, subdomain maps, and spoiler detection lifted
// out of modules/fixembed/fixembedResolver.js. The platform-by-platform
// RESOLVERS array stays in the source file because each entry's regex/replace
// is tightly coupled to its platform.

const axios = require("axios");

const URL_REGEX = /https?:\/\/[^\s<>"\])\\']+/gi;

// ── EmbedEZ proxy ────────────────────────────────────────────────
async function resolveEmbedEZ(url) {
  try {
    const res = await axios.get(
      "https://embedez.com/api/v1/providers/combined",
      {
        params: { q: url },
        timeout: 5000,
      },
    );
    if (res.status === 200 && res.data?.data?.key) {
      return `https://embedez.com/embed/${res.data.data.key}`;
    }
  } catch (_) {
    // Swallow: caller falls back to the original URL.
  }
  return null;
}

// ── View-mode subdomain helpers ──────────────────────────────────
const FX_EMBED_SUBDOMAIN = {
  normal: "",
  gallery: "g.",
  text: "t.",
  direct: "d.",
};

const TIKTOK_SUBDOMAIN = {
  normal: "a.",
  gallery: "",
  direct: "d.",
  text: "a.",
};

// ── Spoiler detection ────────────────────────────────────────────
function isSpoiler(content, url) {
  // Check if this URL appears between ||…|| markers
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\|\\|[^|]*${escaped}[^|]*\\|\\|`).test(content);
}

module.exports = {
  URL_REGEX,
  resolveEmbedEZ,
  FX_EMBED_SUBDOMAIN,
  TIKTOK_SUBDOMAIN,
  isSpoiler,
};
