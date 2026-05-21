const axios = require("axios");

const URL_REGEX = /https?:\/\/[^\s<>"\])\\']+/gi;
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
  } catch (_) {}
  return null;
}
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

function isSpoiler(content, url) {
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
