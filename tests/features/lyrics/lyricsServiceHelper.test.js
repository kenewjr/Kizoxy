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
  extractOriginalMetadata,
} = require("../src/features/lyrics/lyricsServiceHelper");

describe("lyricsServiceHelper", () => {
  // Logger routes non-error output through console.warn; silence it so helper
  // diagnostics don't leak into the jest reporter.
  beforeAll(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    console.warn.mockRestore();
  });
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
    // KI #45 refactor changed the signature to (client, data); colour is always
    // the music purple supplied by Embeds.music — there is no colour argument.
    const client = {};
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
      const json = buildEmbedFromData(client, data).toJSON();
      expect(json.title).toContain("Song");
      expect(json.color).toBe(0x9b59b6);
    });

    test("always uses the music color (0x9b59b6)", () => {
      const json = buildEmbedFromData(client, data).toJSON();
      expect(json.color).toBe(0x9b59b6);
    });

    test("truncates lyrics longer than 4096 characters", () => {
      const huge = { ...data, lyrics: "x".repeat(5000) };
      const json = buildEmbedFromData(client, huge).toJSON();
      expect(json.description.length).toBeLessThanOrEqual(4096);
    });

    test("Japanese flag appears when is_japanese is true", () => {
      const json = buildEmbedFromData(client, {
        ...data,
        is_japanese: true,
      }).toJSON();
      expect(json.footer.text).toContain("🇯🇵");
    });
  });

  describe("[NEW] extractOriginalMetadata", () => {
    // covers: a plain title with no cover/remix noise is returned unchanged
    test("plain title → cleanTitle equals title, originalArtist null", () => {
      const { cleanTitle: ct, originalArtist } = extractOriginalMetadata(
        "Plain Song",
        "Some Artist",
      );
      expect(ct).toBe("Plain Song");
      expect(originalArtist).toBeNull();
    });

    // covers: "(Cover by X)" captures the original artist and strips the paren
    test('"(Cover by Ed Sheeran)" → captures Ed Sheeran, strips noise', () => {
      const { cleanTitle: ct, originalArtist } = extractOriginalMetadata(
        "Perfect (Cover by Ed Sheeran)",
        "Random Uploader",
      );
      expect(originalArtist).toBe("Ed Sheeran");
      expect(ct).toBe("Perfect");
    });

    // covers: "(Originally by X)" form captures the original artist
    test('"(Originally by The Weeknd)" → captures The Weeknd', () => {
      const { originalArtist } = extractOriginalMetadata(
        "Blinding Lights (Originally by The Weeknd)",
        "",
      );
      expect(originalArtist).toBe("The Weeknd");
    });

    // covers: trailing "(X cover)" form captures the original artist
    test('"(Adele cover)" → captures Adele', () => {
      const { originalArtist } = extractOriginalMetadata(
        "Hello (Adele cover)",
        "",
      );
      expect(originalArtist).toBe("Adele");
    });

    // covers: dash-suffixed YouTube "Official Video" noise is stripped
    test('"Title - Official Video" → cleanTitle "Title"', () => {
      const { cleanTitle: ct } = extractOriginalMetadata(
        "Title - Official Video",
        "",
      );
      expect(ct).toBe("Title");
    });

    // covers: dash-suffixed "Acoustic Version" noise is stripped
    test('"Title - Acoustic Version" → cleanTitle "Title"', () => {
      const { cleanTitle: ct } = extractOriginalMetadata(
        "Title - Acoustic Version",
        "",
      );
      expect(ct).toBe("Title");
    });

    // covers: pipe-separated subtitle is dropped
    test('"Title | Subtitle" → cleanTitle "Title"', () => {
      const { cleanTitle: ct } = extractOriginalMetadata(
        "Title | Subtitle",
        "",
      );
      expect(ct).toBe("Title");
    });

    // covers: fullwidth multiplication sign is normalised to ascii x
    test('"DAOKO × 米津玄師" → × normalised to x', () => {
      const { cleanTitle: ct } = extractOriginalMetadata(
        "DAOKO × 米津玄師",
        "",
      );
      expect(ct).toBe("DAOKO x 米津玄師");
    });

    // covers: empty input degrades gracefully without throwing
    test("empty string → { cleanTitle: '', originalArtist: null }", () => {
      expect(extractOriginalMetadata("", "")).toEqual({
        cleanTitle: "",
        originalArtist: null,
      });
    });
  });
});
