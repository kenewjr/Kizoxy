const TiktokScheduler = require("../../../src/integrations/tiktok/scheduler");
const { backoffMs } = TiktokScheduler;
const tiktokClient = require("../../../src/integrations/tiktok/client");
const { _normalize } = require("../../../src/integrations/tiktok/client");
const notifier = require("../../../src/integrations/tiktok/notifier");
const {
  TIKTOK_BACKOFF_BASE_MS,
  TIKTOK_BACKOFF_MAX_MS,
} = require("../../../src/config/constants");

jest.mock("../../../src/integrations/tiktok/client", () => ({
  ...jest.requireActual("../../../src/integrations/tiktok/client"),
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
    expect(stateStorage.setState).toHaveBeenCalledWith(
      "therock",
      expect.objectContaining({
        lastVideoId: "video-1",
        isLive: false,
      }),
    );
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

// ---------------------------------------------------------------------------
// _normalize — consolidated from tiktokScheduler.test.js (stale file deleted)
// ---------------------------------------------------------------------------
describe("_normalize", () => {
  test("maps internal shape onto the contract", () => {
    const out = _normalize("creator", {
      user: { id: 42, username: "Creator", avatar: "a.png", live: true, liveId: 7 },
      videos: [
        { id: 100, url: "u1", cover: "c1", title: "t1", createTime: 123, isLive: false },
        { id: 101 },
      ],
    });
    expect(out.user.id).toBe("42");
    expect(out.user.live).toBe(true);
    expect(out.user.liveId).toBe("7");
    expect(out.videos).toHaveLength(2);
    expect(out.videos[0].id).toBe("100");
    expect(out.videos[1].url).toContain("/@creator/video/101");
  });

  test("drops videos without an id and tolerates missing fields", () => {
    const out = _normalize("creator", {
      user: {},
      videos: [{ url: "no-id" }, { id: 5 }],
    });
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0].id).toBe("5");
    expect(out.user.live).toBe(false);
    expect(out.user.username).toBe("creator");
  });

  test("handles a totally empty response", () => {
    const out = _normalize("creator", {});
    expect(out.videos).toEqual([]);
    expect(out.user.id).toBeNull();
  });

  test("maps TikWM scraper shape onto the internal contract", () => {
    const tikwmData = {
      code: 0,
      msg: "success",
      data: {
        videos: [{
          video_id: "7651447222449556767",
          title: "At least he got the last one 😅",
          create_time: 1782232293,
          cover: "https://p16-common-sign.tiktokcdn-eu.com/cover.jpeg",
          author: {
            id: "6614519312189947909",
            unique_id: "mrbeast",
            nickname: "MrBeast",
            avatar: "https://p19-common-sign.tiktokcdn-eu.com/avatar.webp",
          },
        }],
      },
    };

    const out = _normalize("mrbeast", tikwmData);
    expect(out.user.id).toBe("6614519312189947909");
    expect(out.user.username).toBe("mrbeast");
    expect(out.user.avatar).toBe("https://p19-common-sign.tiktokcdn-eu.com/avatar.webp");
    expect(out.user.live).toBe(false);
    expect(out.videos).toHaveLength(1);
    expect(out.videos[0].id).toBe("7651447222449556767");
    expect(out.videos[0].createTime).toBe(1782232293);
    expect(out.videos[0].url).toContain("/@mrbeast/video/7651447222449556767");
  });
});

// ---------------------------------------------------------------------------
// backoff constants — consolidated from tiktokScheduler.test.js
// ---------------------------------------------------------------------------
describe("backoffMs — constant-based", () => {
  test("no failures = no wait", () => {
    expect(backoffMs(0)).toBe(0);
  });

  test("grows exponentially from the base", () => {
    expect(backoffMs(1)).toBe(TIKTOK_BACKOFF_BASE_MS);
    expect(backoffMs(2)).toBe(TIKTOK_BACKOFF_BASE_MS * 2);
    expect(backoffMs(3)).toBe(TIKTOK_BACKOFF_BASE_MS * 4);
  });

  test("is capped at the max", () => {
    expect(backoffMs(50)).toBe(TIKTOK_BACKOFF_MAX_MS);
  });
});
