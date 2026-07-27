const path = require("path");
const fs = require("fs");

// 1. Mock canvacord globally to prevent native canvas CustomGC thread leaks
jest.mock("canvacord", () => ({
  Font: {
    loadDefault: jest.fn(),
  },
  RankCardBuilder: jest.fn().mockImplementation(() => ({
    setUsername: jest.fn().mockReturnThis(),
    setDisplayName: jest.fn().mockReturnThis(),
    setAvatar: jest.fn().mockReturnThis(),
    setCurrentXP: jest.fn().mockReturnThis(),
    setRequiredXP: jest.fn().mockReturnThis(),
    setLevel: jest.fn().mockReturnThis(),
    setRank: jest.fn().mockReturnThis(),
    setStatus: jest.fn().mockReturnThis(),
    build: jest.fn().mockResolvedValue(Buffer.from("mock-image")),
  })),
}));

// 2. Redirect all storage JSON paths to tests/logs/test-data directory
const globalTmpDir = path.resolve(__dirname, "logs", "test-data");
if (!fs.existsSync(globalTmpDir)) {
  fs.mkdirSync(globalTmpDir, { recursive: true });
}

const originalJoin = path.join;
jest.spyOn(path, "join").mockImplementation((...args) => {
  const result = originalJoin(...args);
  if (typeof result !== "string") return result;

  const resolved = path.resolve(result);
  const basename = path.basename(resolved);
  const lower = basename.toLowerCase();

  const configFiles = [
    "package.json",
    "package-lock.json",
    ".markdownlint.json",
    "tsconfig.json",
    "jsconfig.json",
    "plugin.json",
  ];
  if (configFiles.includes(lower)) {
    return result;
  }

  const isDataFolder =
    resolved.includes(path.sep + "data" + path.sep) ||
    resolved.endsWith(path.sep + "data");
  const isTestTempFile =
    lower.startsWith("levels-") ||
    lower.startsWith("youtube.test") ||
    lower.startsWith("tiktok.test") ||
    lower.startsWith("tempvc_test") ||
    lower.includes("music.test");

  if ((isDataFolder && lower.endsWith(".json")) || isTestTempFile) {
    return path.resolve(globalTmpDir, basename);
  }

  return result;
});

// 3. Automatically flush all active storage singletons after each test to prevent pending save timers
afterEach(async () => {
  const storages = [
    "../../src/persistence/commandStorage",
    "../../src/persistence/donateSeenStorage",
    "../../src/persistence/fixembedStorage",
    "../../src/persistence/levelSettingsStorage",
    "../../src/persistence/tempvcStorage",
    "../../src/persistence/tiktokStorage",
    "../../src/persistence/youtubeStorage",
  ];
  for (const s of storages) {
    try {
      const modulePath = require.resolve(s);
      if (require.cache[modulePath]) {
        const inst = require(s);
        if (inst) {
          if (inst._saveDelayMs !== undefined) {
            inst._saveDelayMs = 0;
          }
          if (typeof inst.flush === "function") {
            await inst.flush();
          }
        }
      }
    } catch (_) {}
  }
});
