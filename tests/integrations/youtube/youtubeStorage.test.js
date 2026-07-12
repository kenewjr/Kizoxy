const fs = require("fs");
const path = require("path");

// JSONStorage emits init/recovery diagnostics via Logger (console.warn). The
// spy must be installed BEFORE the require below.
const _warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

const { YoutubeStorage } = require("../src/persistence/youtubeStorage");

const TEST_FILENAME = `youtube.test.${process.pid}.${Date.now()}.json`;
const TEST_FILEPATH = path.join(__dirname, "..", "data", TEST_FILENAME);

describe("youtubeStorage", () => {
  let storage;

  beforeAll(() => {
    storage = new YoutubeStorage(TEST_FILENAME);
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

  const guildA = "guild-A";
  const guildB = "guild-B";
  const channelId = "UCchannel0000000000000000";

  test("addSubscription stores normalized fields with an id", async () => {
    const rec = await storage.addSubscription(guildA, {
      youtubeChannelId: channelId,
      youtubeChannelTitle: "Test Channel",
      youtubeChannelUrl: `https://www.youtube.com/channel/${channelId}`,
      announceChannelId: "111",
      mentionRoleId: null,
    });
    expect(rec.id).toBeTruthy();
    expect(rec.notifyVideos).toBe(true);
    expect(rec.notifyShorts).toBe(true);
    expect(rec.notifyLive).toBe(true);
    expect(rec.createdAt).toBeTruthy();
  });

  test("listSubscriptions returns the guild's subscriptions", async () => {
    const list = await storage.listSubscriptions(guildA);
    expect(list).toHaveLength(1);
    expect(list[0].youtubeChannelId).toBe(channelId);
  });

  test("findByYoutubeChannel locates an existing subscription", async () => {
    const found = await storage.findByYoutubeChannel(guildA, channelId);
    expect(found).not.toBeNull();
    const missing = await storage.findByYoutubeChannel(guildA, "UCnope");
    expect(missing).toBeNull();
  });

  test("toggles can be disabled at creation", async () => {
    const rec = await storage.addSubscription(guildA, {
      youtubeChannelId: "UCsecond000000000000000000",
      youtubeChannelTitle: "Second",
      youtubeChannelUrl: "x",
      announceChannelId: "222",
      notifyShorts: false,
      notifyLive: false,
    });
    expect(rec.notifyVideos).toBe(true);
    expect(rec.notifyShorts).toBe(false);
    expect(rec.notifyLive).toBe(false);
  });

  test("multiple guilds can subscribe to the same youtubeChannelId", async () => {
    await storage.addSubscription(guildB, {
      youtubeChannelId: channelId,
      youtubeChannelTitle: "Test Channel",
      youtubeChannelUrl: "x",
      announceChannelId: "333",
    });
    const map = await storage.getChannelSubscriberMap();
    const subscribers = map.get(channelId);
    expect(subscribers).toHaveLength(2);
    const guildIds = subscribers.map((s) => s.guildId).sort();
    expect(guildIds).toEqual([guildA, guildB]);
  });

  test("removeSubscription deletes by id and returns the record", async () => {
    const list = await storage.listSubscriptions(guildA);
    const target = list.find((s) => s.youtubeChannelId === channelId);
    const removed = await storage.removeSubscription(guildA, target.id);
    expect(removed.id).toBe(target.id);
    const after = await storage.findByYoutubeChannel(guildA, channelId);
    expect(after).toBeNull();
  });

  test("removeSubscription returns null for an unknown id", async () => {
    const removed = await storage.removeSubscription(guildA, "does-not-exist");
    expect(removed).toBeNull();
  });
});
