const TiktokScheduler = require("../../../src/integrations/tiktok/scheduler");
const { backoffMs } = TiktokScheduler;
const tiktokClient = require("../../../src/integrations/tiktok/client");
const notifier = require("../../../src/integrations/tiktok/notifier");

jest.mock("../../../src/integrations/tiktok/client", () => ({
  fetchProfile: jest.fn(),
  TiktokAccountNotFoundError: class extends Error {},
}));

jest.mock("../../../src/integrations/tiktok/notifier", () => ({
  send: jest.fn().mockResolvedValue(true),
  buildVideoEmbed: jest.fn(),
  buildLiveEmbed: jest.fn(),
  buildLinkRow: jest.fn(),
  mentionContent: jest.fn().mockReturnValue(""),
}));

describe("TiktokScheduler Tests", () => {
  let scheduler, client, subStorage, stateStorage;

  beforeEach(() => {
    client = {};

    subStorage = {
      getUserSubscriberMap: jest.fn().mockResolvedValue(new Map()),
    };

    stateStorage = {
      getState: jest.fn().mockResolvedValue(null),
      setState: jest.fn(),
      clearFailures: jest.fn(),
      recordFailure: jest.fn(),
    };

    scheduler = new TiktokScheduler(client, { subStorage, stateStorage });
    jest.clearAllMocks();
  });

  it("backoffs correctly based on consecutive failures", () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBeGreaterThan(0);
    expect(backoffMs(100)).toBe(30 * 60 * 1000); // capped at max
  });

  it("registers polling timer on start", () => {
    scheduler.start();
    expect(scheduler._interval).toBeDefined();
    scheduler.stop();
    expect(scheduler._interval).toBeNull();
  });

  it("skips polling if map is empty", async () => {
    await scheduler.pollOnce();
    expect(tiktokClient.fetchProfile).not.toHaveBeenCalled();
  });

  it("respects backoff checks and skips polling early", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { username: "therock" } },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    stateStorage.getState.mockResolvedValue({
      consecutiveFailures: 3,
      lastCheckedAt: new Date(Date.now() - 1000).toISOString(), // checked 1s ago
    });

    await scheduler.pollOnce();
    expect(tiktokClient.fetchProfile).not.toHaveBeenCalled();
  });

  it("handles TiktokAccountNotFoundError", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { username: "therock" } },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    tiktokClient.fetchProfile.mockRejectedValueOnce(
      new tiktokClient.TiktokAccountNotFoundError(),
    );

    await scheduler.pollOnce();
    expect(stateStorage.recordFailure).toHaveBeenCalledWith("therock");
  });

  it("records latest video without announcing if first time seen", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { username: "therock" } },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    tiktokClient.fetchProfile.mockResolvedValue({
      user: { username: "therock", live: false },
      videos: [{ id: "video-1", title: "Video" }],
    });

    stateStorage.getState.mockResolvedValue({}); // Empty state

    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("therock", {
      lastVideoId: "video-1",
      isLive: false,
    });
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("skips announcing if video id is unchanged", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { username: "therock" } },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    tiktokClient.fetchProfile.mockResolvedValue({
      user: { username: "therock", live: false },
      videos: [{ id: "video-1", title: "Video" }],
    });

    stateStorage.getState.mockResolvedValue({ lastVideoId: "video-1" });

    await scheduler.pollOnce();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("polls and fires notification if new video found", async () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: { username: "therock", notifyVideos: true },
      },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    tiktokClient.fetchProfile.mockResolvedValue({
      user: { username: "therock", live: false },
      videos: [{ id: "video-new", title: "New" }],
    });

    stateStorage.getState.mockResolvedValue({ lastVideoId: "video-old" });

    await scheduler.pollOnce();
    expect(notifier.send).toHaveBeenCalled();
  });

  it("handles live announcements rising edges and ends", async () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: { username: "therock", notifyLive: true },
      },
    ];
    subStorage.getUserSubscriberMap.mockResolvedValue(
      new Map([["therock", subscribers]]),
    );

    // Case 1: Goes live (rising edge)
    tiktokClient.fetchProfile.mockResolvedValue({
      user: {
        username: "therock",
        live: true,
        liveId: "live-session-1",
        liveUrl: "url",
      },
      videos: [{ id: "video-1" }],
    });
    stateStorage.getState.mockResolvedValue({
      lastVideoId: "video-1",
      isLive: false,
    });

    await scheduler.pollOnce();
    expect(notifier.send).toHaveBeenCalled();
    expect(stateStorage.setState).toHaveBeenCalledWith("therock", {
      isLive: true,
      lastLiveId: "live-session-1",
    });

    // Case 2: Already live, same session (no double announcement)
    notifier.send.mockClear();
    stateStorage.getState.mockResolvedValue({
      lastVideoId: "video-1",
      isLive: true,
      lastLiveId: "live-session-1",
    });
    await scheduler.pollOnce();
    expect(notifier.send).not.toHaveBeenCalled();

    // Case 3: Live ends
    tiktokClient.fetchProfile.mockResolvedValue({
      user: { username: "therock", live: false },
      videos: [{ id: "video-1" }],
    });
    stateStorage.setState.mockClear();
    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("therock", {
      isLive: false,
    });
  });
});
