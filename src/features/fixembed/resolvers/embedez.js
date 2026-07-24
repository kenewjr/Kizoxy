const { resolveEmbedEZ } = require("../fixembedResolverHelper");
function embedEzEntry({ name, originalLabel = name, match, platformKey }) {
  return {
    name,
    platformKey: platformKey || name.toLowerCase(),
    originalLabel,
    fixerName: "EmbedEZ",
    match,
    resolve: async (u) => ({
      fixed: await resolveEmbedEZ(u),
      authorUrl: null,
      authorName: null,
    }),
  };
}

module.exports = [
  embedEzEntry({
    name: "Snapchat",
    match: (u) =>
      /https?:\/\/(?:www\.)?snapchat\.com\/(?:p\/|spotlight\/|@[^/\s]+\/spotlight\/)/i.test(
        u,
      ),
  }),
  embedEzEntry({
    name: "Pinterest",
    match: (u) =>
      /https?:\/\/(?:www\.)?pinterest\.com\/pin\/[^/\s]+/i.test(u) ||
      /https?:\/\/pin\.it\/[^/\s]+/i.test(u),
  }),
  embedEzEntry({
    name: "IFunny",
    match: (u) =>
      /https?:\/\/ifunny\.co\/(?:video|picture|gif)\/[^/\s]+/i.test(u),
  }),
  embedEzEntry({
    name: "Imgur",
    match: (u) =>
      /https?:\/\/(?:i\.)?imgur\.com\/(?:gallery\/)?[^/\s?#]+/i.test(u),
  }),
  embedEzEntry({
    name: "Weibo",
    match: (u) =>
      /https?:\/\/(?:www\.)?weibo\.(?:com|cn)\/[^/\s]+\/[^/\s]+/i.test(u),
  }),
  embedEzEntry({
    name: "Booru",
    originalLabel: "Post",
    match: (u) =>
      /https?:\/\/(?:rule34\.xxx|gelbooru\.com|safebooru\.org|realbooru\.com|hypnohub\.net|xbooru\.com|tbib\.org)\/index\.php/i.test(
        u,
      ),
  }),
  embedEzEntry({
    name: "Danbooru",
    originalLabel: "Post",
    match: (u) => /https?:\/\/danbooru\.donmai\.us\/posts\/\d+/i.test(u),
  }),
  embedEzEntry({
    name: "e621",
    originalLabel: "Post",
    match: (u) => /https?:\/\/(?:e621|e926)\.net\/posts\/\d+/i.test(u),
  }),
  embedEzEntry({
    name: "Moebooru",
    originalLabel: "Post",
    match: (u) =>
      /https?:\/\/(?:konachan\.(?:com|net)|yande\.re)\/post\/show\/\d+/i.test(
        u,
      ),
  }),
  embedEzEntry({
    name: "Derpibooru",
    originalLabel: "Image",
    match: (u) => /https?:\/\/derpibooru\.org\/images\/\d+/i.test(u),
  }),
  embedEzEntry({
    name: "Rule34",
    originalLabel: "Post",
    match: (u) => /https?:\/\/rule34\.paheal\.net\/post\/view\/\d+/i.test(u),
  }),
];
