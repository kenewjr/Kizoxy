const fs = require("fs");
const path = require("path");
const { TempVcStorage } = require("../../src/persistence/tempVcStorage");

describe("tempVcStorage Persistence Tests", () => {
  let storage;
  let filepath;

  beforeAll(() => {
    filepath = path.join(__dirname, "../../data/tempvc_test.json");
  });

  beforeEach(async () => {
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }
    storage = new TempVcStorage("tempvc_test.json");
    await storage._ensureLoaded();
  });

  afterEach(async () => {
    if (storage) {
      await storage.flush();
    }
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }
  });

  it("handles generators CRUD", async () => {
    expect(await storage.getGenerator("g1", "vc1")).toBeNull();
    expect(await storage.getAllGenerators("g1")).toEqual([]);

    await expect(storage.addGenerator("g1", {})).rejects.toThrow();

    const record = await storage.addGenerator("g1", {
      id: "vc1",
      categoryId: "cat1",
      defaultName: "Test Name",
      defaultLimit: 5,
      defaultBitrate: 96000,
      bitrate: 96,
      rtcRegion: "us-east",
    });

    expect(record.id).toBe("vc1");
    expect(await storage.getGenerator("g1", "vc1")).toEqual(record);
    expect(await storage.getAllGenerators("g1")).toEqual([record]);

    const updated = await storage.updateGenerator("g1", "vc1", {
      defaultLimit: 10,
    });
    expect(updated.defaultLimit).toBe(10);

    expect(await storage.updateGenerator("g1", "nonexistent", {})).toBeNull();

    expect(await storage.removeGenerator("g1", "nonexistent")).toBe(false);
    expect(await storage.removeGenerator("g1", "vc1")).toBe(true);
    expect(await storage.getGenerator("g1", "vc1")).toBeNull();
  });

  it("handles temp channels CRUD", async () => {
    expect(await storage.getTempChannel("g1", "tc1")).toBeNull();
    expect(await storage.getAllTempChannels("g1")).toEqual([]);
    expect(await storage.getTempChannelByOwner("g1", "owner1")).toBeNull();

    await expect(storage.addTempChannel("g1", {})).rejects.toThrow();

    const record = await storage.addTempChannel("g1", {
      id: "tc1",
      ownerId: "owner1",
      name: "Channel A",
      limit: 3,
      isLocked: true,
      isHidden: false,
    });

    expect(record.id).toBe("tc1");
    expect(await storage.getTempChannel("g1", "tc1")).toEqual(record);
    expect(await storage.getTempChannelByOwner("g1", "owner1")).toEqual(record);
    expect(await storage.getAllTempChannels("g1")).toEqual([record]);

    const updated = await storage.updateTempChannel("g1", "tc1", {
      isLocked: false,
    });
    expect(updated.isLocked).toBe(false);

    expect(await storage.updateTempChannel("g1", "nonexistent", {})).toBeNull();

    expect(await storage.removeTempChannel("g1", "nonexistent")).toBe(false);
    expect(await storage.removeTempChannel("g1", "tc1")).toBe(true);
    expect(await storage.getTempChannel("g1", "tc1")).toBeNull();
  });

  it("handles templates CRUD", async () => {
    expect(await storage.getTemplate("g1", "t1")).toBeNull();
    expect(await storage.getAllTemplates("g1")).toEqual([]);

    const record = await storage.addTemplate("g1", {
      id: "t1",
      name: "Template A",
    });

    expect(record.id).toBe("t1");
    expect(await storage.getTemplate("g1", "t1")).toEqual(record);
    expect(await storage.getAllTemplates("g1")).toEqual([record]);

    const updated = await storage.updateTemplate("g1", "t1", {
      name: "Template B",
    });
    expect(updated.name).toBe("Template B");

    expect(await storage.updateTemplate("g1", "nonexistent", {})).toBeNull();

    expect(await storage.removeTemplate("g1", "nonexistent")).toBe(false);
    expect(await storage.removeTemplate("g1", "t1")).toBe(true);
    expect(await storage.getTemplate("g1", "t1")).toBeNull();
  });

  it("handles voice roles CRUD", async () => {
    expect(await storage.getVoiceRoles("g1")).toEqual([]);

    await expect(storage.addVoiceRole("g1", {})).rejects.toThrow();

    const record = await storage.addVoiceRole("g1", {
      id: "vr1",
      channelId: "vc1",
      roleId: "role1",
    });

    expect(record.id).toBe("vr1");
    expect(await storage.getVoiceRoles("g1")).toEqual([record]);
    expect(await storage.getVoiceRolesForChannel("g1", "vc1")).toEqual([
      record,
    ]);

    expect(await storage.removeVoiceRole("g1", "nonexistent")).toBe(false);
    expect(await storage.removeVoiceRole("g1", "vr1")).toBe(true);
    expect(await storage.getVoiceRoles("g1")).toEqual([]);
  });

  it("handles settings CRUD", async () => {
    const settings = await storage.getSettings("g1");
    expect(settings.maxGenerators).toBe(2);
    expect(await storage.isPremium("g1")).toBe(false);

    const updated = await storage.updateSettings("g1", { isPremium: true });
    expect(updated.isPremium).toBe(true);
    expect(await storage.isPremium("g1")).toBe(true);
  });
});
