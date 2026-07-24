const fs = require("fs");
const path = require("path");

describe("LevelSettingsStorage Tests", () => {
  let storage, filepath;

  beforeAll(() => {
    // In tests, path.join is spied on to redirect to os.tmpdir()/kizoxy-global-test-data/levelSettings.json
    filepath = path.join(__dirname, "../../data/levelSettings.json");
  });

  beforeEach(() => {
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }

    jest.resetModules();
    storage = require("../../src/persistence/levelSettingsStorage");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("returns default settings for new guilds", () => {
    const settings = storage.getSettings("guild-new");
    expect(settings.xp_enabled).toBe(true);
    expect(settings.level_up_channel_id).toBeNull();
    expect(settings.xp_min).toBe(10);
    expect(settings.xp_max).toBe(20);
    expect(settings.cooldown_seconds).toBe(15);
  });

  it("saves and loads settings correctly", () => {
    storage.saveSettings("guild-test", {
      xp_enabled: false,
      xp_min: 5,
      xp_max: 15,
      cooldown_seconds: 30,
    });

    const settings = storage.getSettings("guild-test");
    expect(settings.xp_enabled).toBe(false);
    expect(settings.xp_min).toBe(5);
    expect(settings.xp_max).toBe(15);
    expect(settings.cooldown_seconds).toBe(30);
  });

  it("handles write errors gracefully in _save", () => {
    // Force writeFileSync to throw
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Disk Full");
    });

    storage.saveSettings("guild-test", { xp_min: 8 });
    expect(writeSpy).toHaveBeenCalled();
    // Should catch error and not throw to caller
  });

  it("handles initialization errors gracefully in _init", () => {
    jest.restoreAllMocks();
    // Force readFileSync to throw invalid JSON
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("Read failed");
    });

    jest.resetModules();
    const badStorage = require("../../src/persistence/levelSettingsStorage");
    expect(badStorage.getSettings("guild-test").xp_min).toBe(10);
  });
});
