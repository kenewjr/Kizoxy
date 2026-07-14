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

    // Instantiating JSONStorage overrides filepath to data/filename relative to __dirname.
    // Let's stub storage.filepath, backupPath, tmpPath directly to point to our tmpDir!
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

  it("performs CRUD operations correctly", async () => {
    await storage._ensureLoaded();

    // Create
    const created = await storage.create({
      id: "crud-1",
      guildId: "guild-1",
      text: "original",
    });
    expect(created.id).toBe("crud-1");

    // Read
    const fetched = await storage.get("crud-1");
    expect(fetched.text).toBe("original");

    // Update
    const updated = await storage.update("crud-1", { text: "modified" });
    expect(updated.text).toBe("modified");
    const fetchedAfterUpdate = await storage.get("crud-1");
    expect(fetchedAfterUpdate.text).toBe("modified");

    // Delete
    const deleted = await storage.delete("crud-1");
    expect(deleted).toBe(true);
    const fetchedAfterDelete = await storage.get("crud-1");
    expect(fetchedAfterDelete).toBeNull();
  });
});
