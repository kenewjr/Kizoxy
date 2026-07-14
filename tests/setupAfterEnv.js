const path = require("path");
const fs = require("fs");
const os = require("os");

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

// 2. Redirect all storage JSON paths to a temp directory to prevent writing to real data/ folder
const globalTmpDir = path.join(os.tmpdir(), "kizoxy-global-test-data");
if (!fs.existsSync(globalTmpDir)) {
  fs.mkdirSync(globalTmpDir, { recursive: true });
}

const originalJoin = path.join;
jest.spyOn(path, "join").mockImplementation((...args) => {
  const jsonFiles = [
    "command_customizations.json",
    "donate_seen.json",
    "fixembed.json",
    "level_settings.json",
    "tempvc.json",
    "tiktok.json",
    "youtube.json",
    "config_overrides.json",
  ];
  if (
    args.some(
      (arg) =>
        typeof arg === "string" && jsonFiles.some((f) => arg.includes(f)),
    )
  ) {
    const filename = args.find(
      (arg) =>
        typeof arg === "string" && jsonFiles.some((f) => arg.includes(f)),
    );
    const basename = path.basename(filename);
    return path.resolve(globalTmpDir, basename);
  }
  return originalJoin(...args);
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
