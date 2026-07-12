const URL_REGEX = /https?:\/\/[^\s<>"\])\\']+/gi;
async function resolveEmbedEZ(url) {
  const targetUrl = new URL("https://embedez.com/api/v1/providers/combined");
  targetUrl.searchParams.set("q", url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
    });
    if (res.status === 200) {
      const data = await res.json();
      if (data?.data?.key) {
        return `https://embedez.com/embed/${data.data.key}`;
      }
    }
  } catch (_) {
  } finally {
    clearTimeout(timer);
  }
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
