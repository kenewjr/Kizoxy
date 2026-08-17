const TiktokScheduler = require("../../../src/integrations/tiktok/scheduler");
const { backoffMs, jitteredDelayMs } = TiktokScheduler;
const tiktokClient = require("../../../src/integrations/tiktok/client");
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
  let scheduler, client, subStorage, stateStorage, consoleLogSpy;

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
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("backoffs correctly based on consecutive failures", () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBeGreaterThan(0);
    expect(backoffMs(100)).toBe(30 * 60 * 1000); // capped at max
  });

  it("jitters delays within the requested range", () => {
    const randomSpy = jest
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1);

    const delays = Array.from({ length: 3 }, () => jitteredDelayMs(3000, 1500));

    expect(delays.every((delay) => delay >= 1500 && delay <= 4500)).toBe(true);
    expect(new Set(delays).size).toBeGreaterThan(1);
    randomSpy.mockRestore();
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

  it("logs the scraper diagnostic when a profile has no videos", async () => {
    await scheduler._handleVideos(
      "therock",
      { videos: [], diagnostic: "TikTok status 10221 (likely banned/restricted)" },
      {},
      [],
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[TIKTOK] [NO_VIDEOS] @therock has 0 uploaded videos — TikTok status 10221 (likely banned/restricted)",
      ),
    );
  });

  it("logs the session-ID hint when an empty profile has no diagnostic", async () => {
    await scheduler._handleVideos("therock", { videos: [] }, {}, []);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[TIKTOK] [NO_VIDEOS] @therock has 0 uploaded videos (Check TIKTOK_SESSION_ID in .env if restricted)",
      ),
    );
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
    expect(stateStorage.setState).toHaveBeenCalledWith(
      "therock",
      expect.objectContaining({
        isLive: true,
        lastLiveId: "live-session-1",
      }),
    );

    // Case 2: Already live, same session (no double announcement)
    notifier.send.mockClear();
    stateStorage.getState.mockResolvedValue({
      lastVideoId: "video-1",
      isLive: true,
      lastLiveId: "live-session-1",
    });
    await scheduler.pollOnce();
    expect(notifier.send).not.toHaveBeenCalled();

    // Case 3: Live ends - debounce step 1 (notLiveStreak = 1, isLive remains true)
    tiktokClient.fetchProfile.mockResolvedValue({
      user: { username: "therock", live: false },
      videos: [{ id: "video-1" }],
    });
    stateStorage.setState.mockClear();
    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("therock", {
      notLiveStreak: 1,
    });

    // Case 4: Live ends - step 2 (notLiveStreak >= 2, isLive resets to false)
    stateStorage.getState.mockResolvedValue({
      lastVideoId: "video-1",
      isLive: true,
      notLiveStreak: 1,
    });
    stateStorage.setState.mockClear();
    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("therock", {
      isLive: false,
      notLiveStreak: 0,
    });
  });

  describe("_handleLive rising-edge and debounce regression tests", () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: { username: "liveuser", notifyLive: true },
      },
    ];

    beforeEach(() => {
      subStorage.getUserSubscriberMap.mockResolvedValue(
        new Map([["liveuser", subscribers]]),
      );
    });

    it("live=true, state.isLive=false (fresh rising edge) -> announces, sets isLive:true, notLiveStreak:0", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: true, liveId: "room-100" },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: false,
      });

      await scheduler.pollOnce();
      expect(notifier.send).toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith(
        "liveuser",
        expect.objectContaining({
          isLive: true,
          lastLiveId: "room-100",
          notLiveStreak: 0,
        }),
      );
    });

    it("live=true, state.isLive=true, profile.user.liveId DIFFERENT from state.lastLiveId -> does NOT re-announce", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: true, liveId: "room-NEW-FLIPPED" },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: true,
        lastLiveId: "room-OLD",
      });

      await scheduler.pollOnce();
      expect(notifier.send).not.toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith(
        "liveuser",
        expect.objectContaining({
          isLive: true,
          lastLiveId: "room-NEW-FLIPPED",
          notLiveStreak: 0,
        }),
      );
    });

    it("live=true, state.isLive=true, profile.user.liveId is null -> does NOT re-announce", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: true, liveId: null },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: true,
        lastLiveId: "room-OLD",
      });

      await scheduler.pollOnce();
      expect(notifier.send).not.toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith(
        "liveuser",
        expect.objectContaining({
          isLive: true,
          lastLiveId: null,
          notLiveStreak: 0,
        }),
      );
    });

    it("live=false after being live once -> notLiveStreak increments, isLive stays true on FIRST not-live read (debounce)", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: false },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: true,
        notLiveStreak: 0,
      });

      await scheduler.pollOnce();
      expect(notifier.send).not.toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith("liveuser", {
        notLiveStreak: 1,
      });
    });

    it("live=false for TWO consecutive polls -> isLive clears to false, notLiveStreak resets", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: false },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: true,
        notLiveStreak: 1,
      });

      await scheduler.pollOnce();
      expect(notifier.send).not.toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith("liveuser", {
        isLive: false,
        notLiveStreak: 0,
      });
    });

    it("live=true again immediately after a single transient not-live read -> notLiveStreak resets to 0, does NOT re-announce", async () => {
      tiktokClient.fetchProfile.mockResolvedValue({
        user: { username: "liveuser", live: true, liveId: "room-100" },
        videos: [{ id: "v1" }],
      });
      stateStorage.getState.mockResolvedValue({
        lastVideoId: "v1",
        isLive: true,
        notLiveStreak: 1, // transient misread on previous poll
      });

      await scheduler.pollOnce();
      expect(notifier.send).not.toHaveBeenCalled();
      expect(stateStorage.setState).toHaveBeenCalledWith(
        "liveuser",
        expect.objectContaining({
          isLive: true,
          notLiveStreak: 0,
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------


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
