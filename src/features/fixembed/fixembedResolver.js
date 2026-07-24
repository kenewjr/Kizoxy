const { URL_REGEX, isSpoiler } = require("./fixembedResolverHelper");
const Logger = require("../../lib/logger");
const RESOLVERS = require("./resolvers");

const logger = new Logger("FIXEMBED");

async function extractFixedLinks(
  content,
  settingsOrViewMode = "normal",
  platformsSettings = null,
) {
  let settings;
  if (typeof settingsOrViewMode === "object" && settingsOrViewMode !== null) {
    settings = settingsOrViewMode;
  } else {
    settings = {
      viewMode: settingsOrViewMode,
      platforms: {},
      ignoredDomains: [],
      spoilerPassthrough: true,
    };
    if (platformsSettings) {
      for (const [k, enabled] of Object.entries(platformsSettings)) {
        settings.platforms[k] = {
          enabled: !!enabled,
          viewMode: settingsOrViewMode,
        };
      }
    }
  }

  const urls = [...(content.matchAll(URL_REGEX) || [])].map((m) => m[0]);
  const results = [];
  const seen = new Set();

  for (const url of urls) {
    const cleanUrl = url.replace(/[.,!?)]+$/, "");
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    // 3. Ignored domain
    if (settings.ignoredDomains?.some((d) => cleanUrl.includes(d))) continue;

    // 4. Spoiler passthrough
    const spoiler = isSpoiler(content, cleanUrl);
    if (spoiler && !settings.spoilerPassthrough) continue;

    for (const resolver of RESOLVERS) {
      if (!resolver.match(cleanUrl)) continue;

      const platformKey =
        resolver.platformKey || resolver.name.toLowerCase().replace(/\s+/g, "");
      const platformSettings = settings.platforms?.[platformKey] ?? {
        enabled: true,
      };

      // 5. Platform check
      if (!platformSettings.enabled) break;

      // 6. View mode
      const viewMode =
        platformSettings.viewMode ?? settings.viewMode ?? "normal";

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
            spoiler,
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
