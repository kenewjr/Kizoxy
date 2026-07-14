const fs = require("fs");
const path = require("path");
const os = require("os");
const { YoutubeStorage } = require("../../src/persistence/youtubeStorage");

describe("YoutubeStorage Persistence Tests", () => {
  let tmpDir, filename, storage;

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `ytstorage-test-${Math.random().toString(36).substring(2, 9)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });
    filename = "test-youtube.json";

    storage = new YoutubeStorage(filename);
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

  it("manages YouTube subscriptions correctly", async () => {
    await storage._ensureLoaded();

    // Add subscription
    const sub = await storage.addSubscription("guild-1", {
      youtubeChannelId: "UCtest123",
      youtubeChannelTitle: "Test Channel",
      youtubeChannelUrl: "https://youtube.com/UCtest123",
      announceChannelId: "channel-123",
    });

    expect(sub.id).toBeDefined();
    expect(sub.youtubeChannelId).toBe("UCtest123");

    // List subscriptions
    const subs = await storage.listSubscriptions("guild-1");
    expect(subs.length).toBe(1);
    expect(subs[0].youtubeChannelId).toBe("UCtest123");

    // Find by youtube channel
    const found = await storage.findByYoutubeChannel("guild-1", "UCtest123");
    expect(found.id).toBe(sub.id);

    // Update subscription
    const updated = await storage.updateSubscription("guild-1", sub.id, {
      customMessage: "New video!",
    });
    expect(updated.customMessage).toBe("New video!");

    // Get subscriber map
    const map = await storage.getChannelSubscriberMap();
    expect(map.has("UCtest123")).toBe(true);
    expect(map.get("UCtest123")[0].guildId).toBe("guild-1");

    // Remove subscription
    const removed = await storage.removeSubscription("guild-1", sub.id);
    expect(removed.id).toBe(sub.id);
    const afterRemove = await storage.listSubscriptions("guild-1");
    expect(afterRemove.length).toBe(0);
  });
});
