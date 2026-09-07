jest.mock("kuroshiro", () => ({
  default: class MockKuroshiro {
    async init() {}

    async convert(text) {
      return text.replace("愛してる", "aishiteru");
    }
  },
}));

jest.mock("kuroshiro-analyzer-kuromoji", () => ({
  default: class MockAnalyzer {},
}));

const {
  convertToRomaji,
  convertLyricsToRomaji,
  isJapanese,
  isKorean,
  hasRomanizableText,
} = require("../../../src/features/lyrics/romajiConverter");

describe("romajiConverter", () => {
  test("detects Japanese and Korean independently", () => {
    expect(isJapanese("愛してる")).toBe(true);
    expect(isKorean("사랑해")).toBe(true);
    expect(hasRomanizableText("plain lyrics")).toBe(false);
  });

  test("romanizes Hangul with hangul-romanizer", async () => {
    await expect(convertToRomaji("안녕하세요")).resolves.toBe("annyeonghaseyo");
  });

  test("romanizes mixed Korean and Japanese lyrics", async () => {
    await expect(convertToRomaji("사랑해 愛してる")).resolves.toBe(
      "saranghae aishiteru",
    );
  });

  test("preserves lyric line breaks", async () => {
    await expect(convertLyricsToRomaji("첫 줄\n\n둘째 줄")).resolves.toBe(
      "cheot jul\n\nduljjae jul",
    );
  });

  test("passes through Latin and guards invalid input", async () => {
    await expect(convertToRomaji("hello")).resolves.toBe("hello");
    await expect(convertToRomaji(null)).resolves.toBe("");
  });
});
