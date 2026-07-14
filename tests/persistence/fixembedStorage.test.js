const fs = require("fs");
const path = require("path");

describe("FixEmbedStorage Persistence Tests", () => {
  let storage, filepath;

  beforeAll(() => {
    filepath = path.join(__dirname, "../../data/fixembed.json");
  });

  beforeEach(() => {
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }

    jest.resetModules();
    storage = require("../../src/persistence/fixembedStorage");
  });

  afterEach(async () => {
    if (storage && typeof storage.flush === "function") {
      await storage.flush();
    }
  });

  it("provides default settings for new guilds", () => {
    const settings = storage.getSettings("guild-new");
    expect(settings.enabled).toBe(false);
    expect(settings.viewMode).toBe("normal");
  });

  it("saves and reads settings correctly", () => {
    storage.saveSettings("guild-new", { enabled: true, viewMode: "gallery" });

    const settings = storage.getSettings("guild-new");
    expect(settings.enabled).toBe(true);
    expect(settings.viewMode).toBe("gallery");
    expect(fs.existsSync(filepath)).toBe(true);
  });
});
