const fs = require("fs");
const path = require("path");

describe("CommandStorage Persistence Tests", () => {
  let storage, filepath;

  beforeAll(() => {
    filepath = path.join(__dirname, "../../data/command_customizations.json");
  });

  beforeEach(() => {
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }

    jest.resetModules();
    storage = require("../../src/persistence/commandStorage");
    storage._saveDelayMs = 0;
  });

  afterEach(async () => {
    try {
      if (storage) await storage.flush();
      const defaultStorage = require("../../src/persistence/commandStorage");
      if (defaultStorage && defaultStorage !== storage)
        await defaultStorage.flush();
    } catch (_) {}
  });

  it("manages command customizations correctly", async () => {
    await storage._ensureLoaded();

    // Set custom command meta
    await storage.setCustomization("play", {
      displayName: "Main Play",
      description: "Play a music track",
    });

    // Get customization
    const meta = await storage.getCustomization("play");
    expect(meta.displayName).toBe("Main Play");
    expect(meta.description).toBe("Play a music track");

    // Get all customizations
    const all = await storage.getAllCustomizations();
    expect(all.play).toBeDefined();

    // Delete customization
    const deleted = await storage.deleteCustomization("play");
    expect(deleted).toBe(true);

    const check = await storage.getCustomization("play");
    expect(check).toBeNull();
  });
});
