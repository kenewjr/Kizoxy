const fs = require("fs");
const path = require("path");
const os = require("os");
const JSONStorage = require("../../src/persistence/jsonStorage");

describe("JSONStorage Persistence Tests", () => {
  let tmpDir, filename, storage;

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `jsonstorage-test-${Math.random().toString(36).substring(2, 9)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    filename = "test-storage.json";

    storage = new JSONStorage(filename);
    storage.filepath = path.join(tmpDir, filename);
    storage.backupPath = `${storage.filepath}.bak`;
    storage.tmpPath = `${storage.filepath}.tmp`;
    storage._saveDelayMs = 0; // instantaneous save for testing
  });

  afterEach(async () => {
    try {
      if (storage) await storage.flush();
    } catch (_) {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it("initializes with empty data and creates new file on first save", async () => {
    await storage._ensureLoaded();
    expect(storage.data).toEqual({});

    await storage.create({ id: "item-1", guildId: "guild-1", value: "hello" });
    await storage.flush();

    expect(fs.existsSync(storage.filepath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(storage.filepath, "utf8"));
    expect(raw["guild-1"][0].value).toBe("hello");
  });

  it("loads existing data correctly", async () => {
    const testData = {
      "guild-1": [{ id: "item-1", guildId: "guild-1", value: "existing" }],
    };
    fs.writeFileSync(
      storage.filepath,
      JSON.stringify(testData, null, 2),
      "utf8",
    );

    await storage.load();
    expect(storage.data).toEqual(testData);
    const item = await storage.get("item-1");
    expect(item.value).toBe("existing");
  });

  it("recovers from backup file if primary file is corrupted", async () => {
    const goodData = {
      "guild-1": [{ id: "item-1", guildId: "guild-1", value: "recovered" }],
    };
    // Primary is corrupt, backup is good
    fs.writeFileSync(storage.filepath, "{ corrupt json...", "utf8");
    fs.writeFileSync(storage.backupPath, JSON.stringify(goodData), "utf8");

    await storage.load();
    expect(storage.data).toEqual(goodData);
    expect(fs.readFileSync(storage.filepath, "utf8")).toContain("recovered");
  });

  it("fails to recover if backup file is also corrupted", async () => {
    fs.writeFileSync(storage.filepath, "{ corrupt json...", "utf8");
    fs.writeFileSync(storage.backupPath, "{ corrupt json...", "utf8");
    await expect(storage.load()).rejects.toThrow();
  });

  it("performs CRUD operations correctly", async () => {
    await storage._ensureLoaded();

    // Create
    const created = await storage.create({
      id: "crud-1",
      guildId: "guild-1",
      text: "original",
      userId: "user-123",
    });
    expect(created.id).toBe("crud-1");

    // Read
    const fetched = await storage.get("crud-1");
    expect(fetched.text).toBe("original");

    // Find by user
    const userItems = await storage.findByUser("user-123");
    expect(userItems.length).toBe(1);

    // Update
    const updated = await storage.update("crud-1", { text: "modified" });
    expect(updated.text).toBe("modified");

    // Delete
    const deleted = await storage.delete("crud-1");
    expect(deleted).toBe(true);
  });

  it("handles missing guildId in create", async () => {
    await storage._ensureLoaded();
    await expect(storage.create({ id: "item-no-guild" })).rejects.toThrow();
  });

  it("handles get, findByGuild, findByUser, update, delete not found/errors", async () => {
    await storage._ensureLoaded();

    // 1. Not found tests
    expect(await storage.get("non-existent")).toBeNull();
    expect(await storage.update("non-existent", { val: 1 })).toBeNull();
    expect(await storage.delete("non-existent")).toBe(false);

    // 2. Exception/error flow tests
    storage.data = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("proxy error");
        },
        get() {
          throw new Error("proxy error");
        },
      },
    );

    expect(await storage.findByGuild("guild-1")).toEqual([]);
    expect(await storage.get("some-id")).toBeNull();
    expect(await storage.findByUser("user-1")).toEqual([]);
    await expect(storage.update("some-id", { val: 1 })).rejects.toThrow();
    await expect(storage.delete("some-id")).rejects.toThrow();
  });

  it("calls syncWithMessage successfully", async () => {
    await storage._ensureLoaded();
    await storage.create({ id: "alarm-1", guildId: "guild-1" });
    const updated = await storage.syncWithMessage(
      "alarm-1",
      "msg-123",
      "chan-456",
    );
    expect(updated.messageId).toBe("msg-123");
    expect(updated.embedChannelId).toBe("chan-456");
  });

  it("calls getAll successfully", async () => {
    await storage._ensureLoaded();
    await storage.create({ id: "alarm-1", guildId: "guild-1" });
    await storage.create({ id: "alarm-2", guildId: "guild-2" });
    const all = await storage.getAll();
    expect(all.length).toBe(2);
  });
});
