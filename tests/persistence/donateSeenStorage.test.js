const fs = require("fs");
const path = require("path");

describe("donateSeenStorage Persistence Tests", () => {
  let storage, filepath;

  beforeAll(() => {
    filepath = path.join(__dirname, "../../data/donate_seen.json");
  });

  beforeEach(() => {
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }

    jest.resetModules();
    storage = require("../../src/persistence/donateSeenStorage");
  });

  afterEach(async () => {
    if (storage && typeof storage.flush === "function") {
      await storage.flush();
    }
  });

  it("manages seen donation users correctly", () => {
    expect(storage.getSeenCount()).toBe(0);
    expect(storage.hasSeen("user-1")).toBe(false);

    storage.markSeen("user-1");
    expect(storage.hasSeen("user-1")).toBe(true);
    expect(storage.getSeenCount()).toBe(1);
  });
});
