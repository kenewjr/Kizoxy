const LevelStorage = require("../../src/persistence/levelStorage");
const path = require("path");
const fs = require("fs").promises;

describe("LevelStorage Tests", () => {
  let levelStorage, tempFilePath;

  beforeEach(async () => {
    tempFilePath = path.join(
      __dirname,
      `levels-${Date.now()}-${Math.random()}.json`,
    );
    levelStorage = new LevelStorage(path.basename(tempFilePath));
    // force local temp filepath on the same drive
    levelStorage.filepath = tempFilePath;
    levelStorage.tmpPath = `${tempFilePath}.tmp`;
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempFilePath);
    } catch {}
    try {
      await fs.unlink(`${tempFilePath}.tmp`);
    } catch {}
  });

  it("loads and saves empty data when file does not exist", async () => {
    const data = await levelStorage.load();
    expect(data).toEqual({});
    const exists = await fs
      .stat(tempFilePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("handles loading error gracefully", async () => {
    // Write invalid JSON
    await fs.writeFile(tempFilePath, "{invalid: json}", "utf8");
    const data = await levelStorage.load();
    expect(data).toEqual({});
  });

  it("converts old array structure to object structure", async () => {
    const oldArray = [
      { userId: "user-1", guildId: "guild-1", xp: 100, level: 1 },
      { userId: "user-2", guildId: "guild-1", xp: 150, level: 2 },
    ];
    await fs.writeFile(tempFilePath, JSON.stringify(oldArray), "utf8");

    const data = await levelStorage.load();
    expect(data["guild-1"]).toBeDefined();
    expect(data["guild-1"].users["user-1"].xp).toBe(100);
  });

  it("adds XP and handles leveling up", async () => {
    await levelStorage.load();
    // Level 0 -> needs 100 XP
    let res = await levelStorage.addXp("user-1", "guild-1", 50);
    expect(res.user.xp).toBe(50);
    expect(res.leveledUp).toBe(false);

    res = await levelStorage.addXp("user-1", "guild-1", 60);
    expect(res.user.xp).toBe(10); // 110 - 100
    expect(res.leveledUp).toBe(true);
    expect(res.user.level).toBe(1);
  });

  it("queries user XP data and rank successfully", async () => {
    await levelStorage.load();
    await levelStorage.addXp("user-1", "guild-1", 50);
    await levelStorage.addXp("user-2", "guild-1", 200); // user-2 will level up and be ahead

    const u1 = await levelStorage.getUser("user-1", "guild-1");
    expect(u1.xp).toBe(50);

    const rank = await levelStorage.getRank("user-1", "guild-1");
    expect(rank).toBe(2); // Behind user-2

    const missingRank = await levelStorage.getRank("nonexistent", "guild-1");
    expect(missingRank).toBeNull();
  });
});
