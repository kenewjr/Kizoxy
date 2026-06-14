const Kuroshiro = require("kuroshiro").default || require("kuroshiro");
const KuromojiAnalyzer =
  require("kuroshiro-analyzer-kuromoji").default ||
  require("kuroshiro-analyzer-kuromoji");
const Logger = require("../../lib/logger");

const logger = new Logger("ROMAJI");
let kuroshiroInstance = null;
let isInitialized = false;
let initializationPromise = null;

async function initializeKuroshiro() {
  if (isInitialized && kuroshiroInstance) {
    return kuroshiroInstance;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      logger.warning("Initializing Kuroshiro...");
      kuroshiroInstance = new Kuroshiro();
      await kuroshiroInstance.init(new KuromojiAnalyzer());
      isInitialized = true;
      logger.success("Kuroshiro initialized successfully");
      return kuroshiroInstance;
    } catch (error) {
      logger.error(`Failed to initialize: ${error.message}`);
      isInitialized = false;
      kuroshiroInstance = null;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

function isJapanese(text) {
  if (!text || typeof text !== "string") return false;

  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text);
}

async function convertToRomaji(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  if (!isJapanese(text)) {
    return text;
  }

  try {
    const kuroshiro = await initializeKuroshiro();

    const romaji = await kuroshiro.convert(text, {
      to: "romaji",
      mode: "spaced", // Add spaces between words
      romajiSystem: "hepburn", // Use Hepburn romanization (most common)
    });

    return romaji;
  } catch (error) {
    logger.error(`Conversion error: ${error.message}`);
    // Return original text if conversion fails
    return text;
  }
}

async function convertLyricsToRomaji(lyricsText) {
  if (!lyricsText || !isJapanese(lyricsText)) {
    return lyricsText;
  }

  try {
    const paragraphs = lyricsText.split(/\n\n+/);
    const romajiParagraphs = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        romajiParagraphs.push("");
        continue;
      }

      const lines = paragraph.split(/\n/);
      const romajiLines = [];

      for (const line of lines) {
        if (!line.trim()) {
          romajiLines.push("");
          continue;
        }

        const romajiLine = await convertToRomaji(line);
        romajiLines.push(romajiLine);
      }

      romajiParagraphs.push(romajiLines.join("\n"));
    }

    return romajiParagraphs.join("\n\n");
  } catch (error) {
    logger.error(`Lyrics conversion error: ${error.message}`);
    return lyricsText;
  }
}

function isJapaneseTrack(title, author) {
  if (isJapanese(title) || isJapanese(author)) {
    return true;
  }
  const japaneseKeywords = [
    "歌ってみた",
    "歌いました",
    "カバー",
    "hololive",
    "nijisanji",
    "vtuber",
    "ホロライブ",
    "にじさんじ",
  ];

  const combined = `${title} ${author}`.toLowerCase();
  return japaneseKeywords.some((kw) => combined.includes(kw.toLowerCase()));
}

async function preInitialize() {
  try {
    await initializeKuroshiro();
    logger.info("Pre-initialization complete");
  } catch (error) {
    logger.error(`Pre-initialization failed: ${error.message}`);
  }
}

module.exports = {
  convertToRomaji,
  convertLyricsToRomaji,
  isJapanese,
  isJapaneseTrack,
  preInitialize,
};
