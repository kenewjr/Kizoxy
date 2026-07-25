const fs = require("fs");
const LogStorage = require("../../src/persistence/logStorage");

jest.mock("fs");

describe("LogStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ "guild-1": "channel-1" }));
  });

  it("loads data on init", () => {
    const storage = new LogStorage();
    expect(storage.getChannel("guild-1")).toBe("channel-1");
  });

  it("sets and saves new channels", () => {
    const storage = new LogStorage();
    storage.setChannel("guild-2", "channel-2");
    expect(storage.getChannel("guild-2")).toBe("channel-2");
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("removes channel", () => {
    const storage = new LogStorage();
    expect(storage.removeChannel("guild-1")).toBe(true);
    expect(storage.getChannel("guild-1")).toBeUndefined();
    expect(storage.removeChannel("guild-nonexistent")).toBe(false);
  });
});
