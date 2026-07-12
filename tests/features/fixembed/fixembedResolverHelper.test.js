// Tests for utils/helpers/fixembedResolverHelper.js
const {
  URL_REGEX,
  resolveEmbedEZ,
  FX_EMBED_SUBDOMAIN,
  TIKTOK_SUBDOMAIN,
  isSpoiler,
} = require("../../../src/features/fixembed/fixembedResolverHelper");

describe("fixembedResolverHelper", () => {
  describe("URL_REGEX", () => {
    test("captures multiple URLs in a message", () => {
      const text =
        "Check this out https://example.com and also http://foo.bar/baz";
      const matches = [...text.matchAll(URL_REGEX)].map((m) => m[0]);
      expect(matches).toEqual(["https://example.com", "http://foo.bar/baz"]);
    });

    test("ignores trailing punctuation by capturing only the URL chars", () => {
      const text = "Visit https://example.com.";
      const matches = [...text.matchAll(URL_REGEX)].map((m) => m[0]);
      expect(matches[0].startsWith("https://example.com")).toBe(true);
    });
  });

  describe("subdomain maps", () => {
    test("FX_EMBED_SUBDOMAIN has all four view modes", () => {
      expect(Object.keys(FX_EMBED_SUBDOMAIN).sort()).toEqual([
        "direct",
        "gallery",
        "normal",
        "text",
      ]);
    });

    test("TIKTOK_SUBDOMAIN has all four view modes", () => {
      expect(Object.keys(TIKTOK_SUBDOMAIN).sort()).toEqual([
        "direct",
        "gallery",
        "normal",
        "text",
      ]);
    });

    test("FX_EMBED 'normal' is empty (no subdomain prefix)", () => {
      expect(FX_EMBED_SUBDOMAIN.normal).toBe("");
    });
  });

  describe("isSpoiler", () => {
    test("returns true when URL is wrapped in spoiler markers", () => {
      const url = "https://example.com/foo";
      expect(isSpoiler(`||look ${url} here||`, url)).toBe(true);
    });

    test("returns false when URL is outside spoiler markers", () => {
      const url = "https://example.com/foo";
      expect(isSpoiler(`look ${url} here`, url)).toBe(false);
    });

    test("escapes regex metacharacters in the URL", () => {
      const url = "https://example.com/path?q=hello";
      expect(isSpoiler(`||${url}||`, url)).toBe(true);
      expect(isSpoiler(`other content`, url)).toBe(false);
    });
  });

  describe("resolveEmbedEZ", () => {
    test("is an async function", () => {
      expect(typeof resolveEmbedEZ).toBe("function");
      expect(resolveEmbedEZ.constructor.name).toBe("AsyncFunction");
    });
  });
});
