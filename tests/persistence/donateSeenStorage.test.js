const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "../data/donate_seen.json");

describe("Donate Seen Storage", () => {
  beforeEach(() => {
    if (fs.existsSync(FILE_PATH)) {
      try {
        fs.unlinkSync(FILE_PATH);
      } catch (_) {}
    }
    delete require.cache[
      require.resolve("../src/persistence/donateSeenStorage")
    ];
  });

  afterAll(() => {
    if (fs.existsSync(FILE_PATH)) {
      try {
        fs.unlinkSync(FILE_PATH);
      } catch (_) {}
    }
  });

  it("fail-safes correctly when file is missing", () => {
    const storage = require("../src/persistence/donateSeenStorage");
    expect(storage.hasSeen("user-1")).toBe(false);
    expect(storage.getSeenCount()).toBe(0);
  });

  it("marks user as seen and saves correctly", () => {
    const storage = require("../src/persistence/donateSeenStorage");
    storage.markSeen("user-1");
    expect(storage.hasSeen("user-1")).toBe(true);
    expect(storage.getSeenCount()).toBe(1);
  });

  it("saves immediately when batch size is reached", () => {
    const storage = require("../src/persistence/donateSeenStorage");
    storage.markSeen("user-1");
    storage.markSeen("user-2");
    storage.markSeen("user-3");
    storage.markSeen("user-4");

    expect(fs.existsSync(FILE_PATH)).toBe(false);

    storage.markSeen("user-5");
    expect(fs.existsSync(FILE_PATH)).toBe(true);
    const content = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    expect(content.seenUserIds).toContain("user-5");
    expect(storage.getSeenCount()).toBe(5);
  });
});
