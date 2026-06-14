const fs = require("fs");
const path = require("path");

// JSONStorage emits init/recovery diagnostics via Logger (console.warn). The
// tempVcStorage module instantiates a singleton at load time, so the spy must
// be installed BEFORE the require below — not in beforeAll.
const _warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

const { TempVcStorage } = require("../src/persistence/tempVcStorage");

const TEST_FILENAME = `tempvc.test.${process.pid}.${Date.now()}.json`;
const TEST_FILEPATH = path.join(__dirname, "..", "data", TEST_FILENAME);

describe("tempVcStorage", () => {
  let storage;

  beforeAll(async () => {
    storage = new TempVcStorage(TEST_FILENAME);
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

  describe("generators", () => {
    const guildId = "guild-A";
    const generatorId = "111111111111111111";

    test("addGenerator persists a record with normalized fields", async () => {
      const record = await storage.addGenerator(guildId, {
        id: generatorId,
        categoryId: "cat-1",
        defaultName: "{username}'s VC",
        defaultLimit: 5,
        defaultBitrate: 96000,
      });
      expect(record.id).toBe(generatorId);
      expect(record.categoryId).toBe("cat-1");
      expect(record.defaultName).toBe("{username}'s VC");
      expect(record.defaultLimit).toBe(5);
      expect(record.defaultBitrate).toBe(96000);
      expect(typeof record.createdAt).toBe("number");
    });

    test("getGenerator returns the same record", async () => {
      const fetched = await storage.getGenerator(guildId, generatorId);
      expect(fetched).not.toBeNull();
      expect(fetched.id).toBe(generatorId);
    });

    test("getGenerator returns null for unknown id", async () => {
      const missing = await storage.getGenerator(guildId, "nonexistent");
      expect(missing).toBeNull();
    });

    test("getAllGenerators returns guild scope only", async () => {
      await storage.addGenerator("guild-B", { id: "999" });
      const list = await storage.getAllGenerators(guildId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(generatorId);
    });

    test("removeGenerator drops the record", async () => {
      const ok = await storage.removeGenerator(guildId, generatorId);
      expect(ok).toBe(true);
      const after = await storage.getGenerator(guildId, generatorId);
      expect(after).toBeNull();
    });

    test("removeGenerator returns false when not found", async () => {
      const result = await storage.removeGenerator(guildId, "ghost");
      expect(result).toBe(false);
    });
  });

  describe("temp channels", () => {
    const guildId = "guild-C";
    const ownerId = "owner-1";
    const channelId = "tempvc-1";

    test("addTempChannel normalizes lists and flags", async () => {
      const rec = await storage.addTempChannel(guildId, {
        id: channelId,
        ownerId,
        generatorId: "gen-1",
      });
      expect(rec.id).toBe(channelId);
      expect(rec.ownerId).toBe(ownerId);
      expect(Array.isArray(rec.allowedUsers)).toBe(true);
      expect(rec.allowedUsers).toHaveLength(0);
      expect(Array.isArray(rec.bannedUsers)).toBe(true);
      expect(rec.isLocked).toBe(false);
      expect(rec.isHidden).toBe(false);
    });

    test("getTempChannelByOwner finds by ownerId", async () => {
      const found = await storage.getTempChannelByOwner(guildId, ownerId);
      expect(found).not.toBeNull();
      expect(found.id).toBe(channelId);
    });

    test("updateTempChannel preserves id and merges fields", async () => {
      const updated = await storage.updateTempChannel(guildId, channelId, {
        isLocked: true,
        allowedUsers: ["u1", "u2"],
      });
      expect(updated.id).toBe(channelId);
      expect(updated.isLocked).toBe(true);
      expect(updated.allowedUsers).toEqual(["u1", "u2"]);
    });

    test("removeTempChannel deletes and getTempChannel becomes null", async () => {
      const ok = await storage.removeTempChannel(guildId, channelId);
      expect(ok).toBe(true);
      const after = await storage.getTempChannel(guildId, channelId);
      expect(after).toBeNull();
    });
  });

  describe("settings", () => {
    test("isPremium defaults to false on a brand-new guild", async () => {
      const flag = await storage.isPremium("guild-fresh");
      expect(flag).toBe(false);
    });

    test("getSettings returns defaults including free-tier limits", async () => {
      const s = await storage.getSettings("guild-fresh");
      expect(s.maxGenerators).toBe(2);
      expect(s.maxTemplates).toBe(3);
      expect(s.maxVoiceRoles).toBe(1);
      expect(s.isPremium).toBe(false);
    });

    test("updateSettings merges and persists", async () => {
      const next = await storage.updateSettings("guild-fresh", {
        isPremium: true,
        maxGenerators: 10,
      });
      expect(next.isPremium).toBe(true);
      expect(next.maxGenerators).toBe(10);
      expect(next.maxTemplates).toBe(3);
    });
  });
});
