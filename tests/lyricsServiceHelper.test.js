// Tests for utils/helpers/lyricsServiceHelper.js
const {
  cleanTitle,
  cleanAuthor,
  extractFtArtist,
  isCover,
  sourceLabel,
  splitTitleSegments,
  buildQueryStrategies,
  buildCacheKey,
  buildEmbedFromData,
} = require("../src/features/lyrics/lyricsServiceHelper");

describe("lyricsServiceHelper", () => {
  describe("cleanTitle", () => {
    test("strips parenthesised qualifiers", () => {
      expect(cleanTitle("Song Name (Official Music Video)")).toBe("Song Name");
    });

    test("strips bracketed qualifiers", () => {
      expect(cleanTitle("Song [Official Audio]")).toBe("Song");
    });

    test("trims trailing 'lyrics'", () => {
      expect(cleanTitle("Song Name Lyrics")).toBe("Song Name");
    });

    test("collapses repeated whitespace", () => {
      expect(cleanTitle("Song    Name")).toBe("Song Name");
    });

    test("handles empty input gracefully", () => {
      expect(cleanTitle("")).toBe("");
    });
  });

  describe("cleanAuthor", () => {
    test("strips ' - Topic' suffix", () => {
      expect(cleanAuthor("Artist - Topic")).toBe("Artist");
    });

    test("strips 'Official' channel suffix", () => {
      expect(cleanAuthor("Artist Official Music")).toBe("Artist");
    });

    test("returns empty string for blocklisted brands", () => {
      expect(cleanAuthor("Spotify")).toBe("");
      expect(cleanAuthor("YouTube")).toBe("");
    });
  });

  describe("extractFtArtist", () => {
    test("pulls feat. artist", () => {
      expect(extractFtArtist("Title feat. Other Artist")).toBe("Other Artist");
    });
    test("pulls ft. artist", () => {
      expect(extractFtArtist("Title ft. Other Artist")).toBe("Other Artist");
    });
    test("returns empty when no feat", () => {
      expect(extractFtArtist("Plain Title")).toBe("");
    });
  });

  describe("isCover", () => {
    test("detects 'covered by'", () => {
      expect(isCover("Song (Covered by Artist)")).toBe(true);
    });
    test("returns false for plain titles", () => {
      expect(isCover("Plain Song Name")).toBe(false);
    });
  });

  describe("sourceLabel", () => {
    test.each([
      ["lrclib", "LRCLIB"],
      ["genius", "Genius"],
      ["lyrical_nonsense", "LyricalNonsense"],
      ["unknown", "unknown"],
      ["", ""],
    ])("sourceLabel(%p) === %p", (input, expected) => {
      expect(sourceLabel(input)).toBe(expected);
    });
  });

  describe("splitTitleSegments", () => {
    test("splits on en-dash", () => {
      expect(splitTitleSegments("Artist - Song")).toEqual(["Artist", "Song"]);
    });
    test("returns single-element array when no separator", () => {
      expect(splitTitleSegments("OneTitle")).toEqual(["OneTitle"]);
    });
  });

  describe("buildQueryStrategies", () => {
    test("dedupes identical queries", () => {
      const { queries } = buildQueryStrategies("Song", "Song");
      const unique = new Set(queries);
      expect(queries.length).toBe(unique.size);
    });

    test("returns the cleaned title fallback", () => {
      const { cleanedTitle, queries } = buildQueryStrategies(
        "Song (Official MV)",
        "Artist",
      );
      expect(cleanedTitle).toBe("Song");
      expect(queries).toContain("Song");
    });

    test("appends author to title for non-covers", () => {
      const { queries } = buildQueryStrategies("Song", "Artist");
      expect(queries[0]).toBe("Song Artist");
    });
  });

  describe("buildCacheKey", () => {
    test("prefers identifier", () => {
      expect(buildCacheKey({ identifier: "id1", uri: "uri1" })).toBe("id1");
    });
    test("falls back to uri", () => {
      expect(buildCacheKey({ uri: "uri1" })).toBe("uri1");
    });
    test("falls back to title|author when nothing else", () => {
      expect(buildCacheKey({ title: "T", author: "A" })).toBe("T|A");
    });
    test("handles fully empty input", () => {
      expect(buildCacheKey({})).toBe("|");
    });
  });

  describe("buildEmbedFromData", () => {
    const data = {
      title: "Song",
      artist: "Artist",
      album: "Album",
      source: "lrclib",
      is_japanese: false,
      url: "https://example.com",
      lyrics: "line one\nline two",
    };

    test("renders title with music note", () => {
      const json = buildEmbedFromData(data, 0xff0000, "raw").toJSON();
      expect(json.title).toContain("Song");
      expect(json.color).toBe(0xff0000);
    });

    test("uses default color when none provided", () => {
      const json = buildEmbedFromData(data, undefined, "raw").toJSON();
      expect(json.color).toBe(0x9b59b6);
    });

    test("truncates lyrics longer than 4096 characters", () => {
      const huge = { ...data, lyrics: "x".repeat(5000) };
      const json = buildEmbedFromData(huge, 0xff0000, "raw").toJSON();
      expect(json.description.length).toBeLessThanOrEqual(4096);
    });

    test("Japanese flag appears when is_japanese is true", () => {
      const json = buildEmbedFromData(
        { ...data, is_japanese: true },
        0xff0000,
        "raw",
      ).toJSON();
      expect(json.footer.text).toContain("🇯🇵");
    });
  });
});
