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
    jest.restoreAllMocks();
  });

  it("provides default settings for new guilds", () => {
    const settings = storage.getSettings("guild-new");
    expect(settings.enabled).toBe(true);
    expect(settings.viewMode).toBe("normal");
    expect(settings.ignoredUsers).toEqual([]);
    expect(settings.ignoredRoles).toEqual([]);
    expect(settings.ignoredKeywords).toEqual([]);
  });

  it("saves and reads settings correctly", () => {
    storage.saveSettings("guild-new", {
      enabled: true,
      viewMode: "gallery",
      ignoredUsers: ["1234567890"],
      ignoredRoles: ["9876543210"],
      ignoredKeywords: ["bypass_kw"],
    });

    const settings = storage.getSettings("guild-new");
    expect(settings.enabled).toBe(true);
    expect(settings.viewMode).toBe("gallery");
    expect(settings.ignoredUsers).toEqual(["1234567890"]);
    expect(settings.ignoredRoles).toEqual(["9876543210"]);
    expect(settings.ignoredKeywords).toEqual(["bypass_kw"]);
    console.log("TEST FILEPATH:", filepath);
    const realFilepath = path.resolve(__dirname, "../../data/fixembed.json");
    expect(fs.existsSync(filepath) || fs.existsSync(realFilepath)).toBe(true);
  });

  it("applies ignore filters correctly", () => {
    storage.saveSettings("guild-test", {
      enabled: true,
      ignoredUsers: ["user1"],
      ignoredRoles: ["role1"],
      ignoredChannels: ["chan1"],
      ignoredKeywords: ["skipme"],
    });

    // Ignored user check
    expect(
      storage.isEnabled("guild-test", "chan2", {
        id: "user1",
        roles: { cache: [] },
      }),
    ).toBe(false);

    // Ignored role check
    expect(
      storage.isEnabled("guild-test", "chan2", {
        id: "user2",
        roles: { cache: [{ id: "role1" }] },
      }),
    ).toBe(false);

    // Ignored channel check
    expect(
      storage.isEnabled("guild-test", "chan1", {
        id: "user2",
        roles: { cache: [] },
      }),
    ).toBe(false);

    // Allowed checking
    expect(
      storage.isEnabled("guild-test", "chan2", {
        id: "user2",
        roles: { cache: [] },
      }),
    ).toBe(true);

    // Keyword check
    expect(storage.hasIgnoredKeyword("guild-test", "hello world")).toBe(false);
    expect(
      storage.hasIgnoredKeyword("guild-test", "this contains SkipMe keyword"),
    ).toBe(true);
  });

  it("supports toggle helpers", () => {
    const guildId = "guild-toggle";

    // Toggle channel
    expect(storage.toggleChannel(guildId, "c1")).toBe(true);
    expect(storage.getSettings(guildId).ignoredChannels).toContain("c1");
    expect(storage.toggleChannel(guildId, "c1")).toBe(false);
    expect(storage.getSettings(guildId).ignoredChannels).not.toContain("c1");

    // Toggle user
    expect(storage.toggleUser(guildId, "u1")).toBe(true);
    expect(storage.getSettings(guildId).ignoredUsers).toContain("u1");
    expect(storage.toggleUser(guildId, "u1")).toBe(false);
    expect(storage.getSettings(guildId).ignoredUsers).not.toContain("u1");

    // Toggle role
    expect(storage.toggleRole(guildId, "r1")).toBe(true);
    expect(storage.getSettings(guildId).ignoredRoles).toContain("r1");
    expect(storage.toggleRole(guildId, "r1")).toBe(false);
    expect(storage.getSettings(guildId).ignoredRoles).not.toContain("r1");

    // Toggle keyword
    expect(storage.toggleKeyword(guildId, "kw1")).toBe(true);
    expect(storage.getSettings(guildId).ignoredKeywords).toContain("kw1");
    expect(storage.toggleKeyword(guildId, "kw1")).toBe(false);
    expect(storage.getSettings(guildId).ignoredKeywords).not.toContain("kw1");
  });

  it("sets actions and view modes correctly", () => {
    const guildId = "guild-sets";

    storage.setEnabled(guildId, false);
    expect(storage.getSettings(guildId).enabled).toBe(false);

    storage.setBaseMessageAction(guildId, "delete_message");
    expect(storage.getSettings(guildId).baseMessageAction).toBe(
      "delete_message",
    );
    expect(storage.getSettings(guildId).deleteBehavior).toBe("delete");

    expect(() => storage.setBaseMessageAction(guildId, "invalid")).toThrow();

    storage.setViewMode(guildId, "gallery");
    expect(storage.getSettings(guildId).viewMode).toBe("gallery");
    expect(() => storage.setViewMode(guildId, "invalid")).toThrow();
  });

  it("handles initialization and write errors", () => {
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Disk Full");
    });
    storage.setEnabled("guild-err", false); // Should catch error

    jest.restoreAllMocks();
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("Read failed");
    });

    jest.resetModules();
    const badStorage = require("../../src/persistence/fixembedStorage");
    expect(badStorage.getSettings("guild-err").enabled).toBe(true);
  });
});
