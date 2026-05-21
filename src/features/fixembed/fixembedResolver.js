// src/features/fixembed/fixembedResolver.js
// Orchestrator for the social-media link rewriter. The per-platform resolver
// entries live under ./resolvers/ and are aggregated by resolvers/index.js.
// This file only owns the URL discovery loop.

const { URL_REGEX, isSpoiler } = require("./fixembedResolverHelper");
const RESOLVERS = require("./resolvers");

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
        console.error(
          `[FixEmbed] Resolver error for ${resolver.name}:`,
          err.message,
        );
      }
      break;
    }
  }

  return results;
}

module.exports = { extractFixedLinks };
