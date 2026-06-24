const fs = require("fs");
const path = require("path");

const _warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

const { TiktokStorage } = require("../src/persistence/tiktokStorage");

const TEST_FILENAME = `tiktok.test.${process.pid}.${Date.now()}.json`;
const TEST_FILEPATH = path.join(__dirname, "..", "data", TEST_FILENAME);

describe("tiktokStorage", () => {
  let storage;

  beforeAll(() => {
    storage = new TiktokStorage(TEST_FILENAME);
  });

  afterAll(async () => {
    if (storage && typeof storage.flush === "function") {
      await storage.flush().catch(() => {});
    }
    for (const ext of ["", ".bak", ".tmp"]) {
      const p = TEST_FILEPATH + ext;
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
    console.warn.mockRestore();
  });

  const guildA = "guild-A";
  const guildB = "guild-B";

  test("addSubscription normalizes username and sets defaults", async () => {
    const rec = await storage.addSubscription(guildA, {
      username: "@CoolCreator",
      profileUrl: "https://www.tiktok.com/@coolcreator",
      discordChannelId: "111",
    });
    expect(rec.id).toBeTruthy();
    expect(rec.username).toBe("coolcreator");
    expect(rec.notifyVideos).toBe(true);
    expect(rec.notifyLive).toBe(true);
    expect(rec.tiktokUserId).toBeNull();
  });

  test("findByUsername matches regardless of @ or case", async () => {
    const found = await storage.findByUsername(guildA, "@COOLCREATOR");
    expect(found).not.toBeNull();
    expect(found.username).toBe("coolcreator");
  });

  test("updateSubscription persists resolver-discovered fields", async () => {
    const list = await storage.listSubscriptions(guildA);
    const updated = await storage.updateSubscription(guildA, list[0].id, {
      tiktokUserId: "999",
      username: "@RenamedCreator",
    });
    expect(updated.tiktokUserId).toBe("999");
    expect(updated.username).toBe("renamedcreator");
  });

  test("getUserSubscriberMap dedups across guilds", async () => {
    await storage.addSubscription(guildA, {
      username: "shared",
      profileUrl: "x",
      discordChannelId: "222",
    });
    await storage.addSubscription(guildB, {
      username: "shared",
      profileUrl: "x",
      discordChannelId: "333",
    });
    const map = await storage.getUserSubscriberMap();
    expect(map.get("shared")).toHaveLength(2);
    const guildIds = map
      .get("shared")
      .map((s) => s.guildId)
      .sort();
    expect(guildIds).toEqual([guildA, guildB]);
  });

  test("removeSubscription deletes by id", async () => {
    const list = await storage.listSubscriptions(guildA);
    const target = list.find((s) => s.username === "shared");
    const removed = await storage.removeSubscription(guildA, target.id);
    expect(removed.id).toBe(target.id);
    const after = await storage.findByUsername(guildA, "shared");
    expect(after).toBeNull();
  });

  test("removeSubscription returns null for unknown id", async () => {
    const removed = await storage.removeSubscription(guildA, "nope");
    expect(removed).toBeNull();
  });
});
