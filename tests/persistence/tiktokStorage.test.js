const fs = require("fs");
const path = require("path");
const os = require("os");
const { TiktokStorage } = require("../../src/persistence/tiktokStorage");

describe("TiktokStorage Persistence Tests", () => {
  let tmpDir, filename, storage;

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `tkstorage-test-${Math.random().toString(36).substring(2, 9)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    filename = "test-tiktok.json";

    storage = new TiktokStorage(filename);
    storage.filepath = path.join(tmpDir, filename);
    storage.backupPath = `${storage.filepath}.bak`;
    storage.tmpPath = `${storage.filepath}.tmp`;
    storage._saveDelayMs = 0;
  });

  afterEach(async () => {
    try {
      if (storage) await storage.flush();
    } catch (_) {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it("manages TikTok subscriptions correctly", async () => {
    await storage._ensureLoaded();

    // Add subscription
    const sub = await storage.addSubscription("guild-1", {
      username: "@testuser",
      profileUrl: "https://tiktok.com/@testuser",
      discordChannelId: "channel-123",
    });

    expect(sub.id).toBeDefined();
    expect(sub.username).toBe("testuser"); // normalized username

    // List subscriptions
    const subs = await storage.listSubscriptions("guild-1");
    expect(subs.length).toBe(1);

    // Find by username
    const found = await storage.findByUsername("guild-1", "testuser");
    expect(found.id).toBe(sub.id);

    // Update subscription
    const updated = await storage.updateSubscription("guild-1", sub.id, {
      customMessage: "New video!",
    });
    expect(updated.customMessage).toBe("New video!");

    // Get subscriber map
    const map = await storage.getUserSubscriberMap();
    expect(map.has("testuser")).toBe(true);
    expect(map.get("testuser")[0].guildId).toBe("guild-1");

    // Remove subscription
    const removed = await storage.removeSubscription("guild-1", sub.id);
    expect(removed.id).toBe(sub.id);
  });
});
