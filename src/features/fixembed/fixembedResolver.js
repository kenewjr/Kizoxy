const { URL_REGEX, isSpoiler } = require("./fixembedResolverHelper");
const Logger = require("../../lib/logger");
const RESOLVERS = require("./resolvers");

const logger = new Logger("FIXEMBED");

async function extractFixedLinks(content, viewMode = "normal") {
  const urls = [...(content.matchAll(URL_REGEX) || [])].map((m) => m[0]);
  const results = [];
  const seen = new Set();

  for (const url of urls) {
    const cleanUrl = url.replace(/[.,!?)]+$/, "");
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    for (const resolver of RESOLVERS) {
      if (!resolver.match(cleanUrl)) continue;

      try {
        const res = await resolver.resolve(cleanUrl, viewMode);
        if (res && res.fixed) {
          results.push({
            original: cleanUrl,
            originalLabel: resolver.originalLabel,
            authorUrl: res.authorUrl,
            authorName: res.authorName,
            fixed: res.fixed,
            fixerName: resolver.fixerName,
            platform: resolver.name,
            changed: res.fixed !== cleanUrl,
            spoiler: isSpoiler(content, cleanUrl),
          });
        }
      } catch (err) {
        logger.error(`Resolver error for ${resolver.name}: ${err.message}`);
      }
      break;
    }
  }

  return results;
}

module.exports = { extractFixedLinks };
