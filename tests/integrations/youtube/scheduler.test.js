const YoutubeScheduler = require("../../../src/integrations/youtube/scheduler");
const youtubeClient = require("../../../src/integrations/youtube/client");
const classifier = require("../../../src/integrations/youtube/classifier");

jest.mock("../../../src/integrations/youtube/client", () => ({
  fetchLatestFeedEntry: jest.fn(),
  fetchVideoDetails: jest.fn(),
}));

jest.mock("../../../src/integrations/youtube/classifier", () => ({
  classify: jest.fn().mockResolvedValue("video"),
}));

jest.mock("../../../src/integrations/youtube/formatter", () => ({
  buildAnnouncementEmbed: jest.fn().mockReturnValue({}),
  buildWatchRow: jest.fn().mockReturnValue({}),
}));

describe("YoutubeScheduler Tests", () => {
  let scheduler, client, subStorage, stateStorage;

  beforeEach(() => {
    client = {
      channels: {
        fetch: jest.fn().mockResolvedValue({
          send: jest.fn().mockResolvedValue({ id: "announce-1" }),
          permissionsFor: () => ({
            has: () => true,
          }),
        }),
      },
    };

    subStorage = {
      getChannelSubscriberMap: jest.fn().mockResolvedValue(new Map()),
    };

    stateStorage = {
      getState: jest.fn().mockResolvedValue(null),
      setState: jest.fn(),
      touch: jest.fn(),
    };

    scheduler = new YoutubeScheduler(client, { subStorage, stateStorage });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("registers polling timer on start and handles interval trigger", async () => {
    jest.useFakeTimers();
    scheduler.start();
    expect(scheduler._interval).toBeDefined();

    // Trigger interval
    await jest.advanceTimersByTimeAsync(60000);

    scheduler.stop();
    expect(scheduler._interval).toBeNull();
  });

  it("skips polling if map is empty", async () => {
    await scheduler.pollOnce();
    expect(youtubeClient.fetchLatestFeedEntry).not.toHaveBeenCalled();
  });

  it("handles feed failure and logs warning or debug", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { announceChannelId: "chan-1" } },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    // Permanent error (e.g. 404)
    const permanentErr = new Error("Not Found");
    permanentErr.response = { status: 404 };
    youtubeClient.fetchLatestFeedEntry.mockRejectedValueOnce(permanentErr);

    await scheduler.pollOnce();
    expect(stateStorage.setState).not.toHaveBeenCalled();

    // Transient error
    const transientErr = new Error("Timeout");
    youtubeClient.fetchLatestFeedEntry.mockRejectedValueOnce(transientErr);
    await scheduler.pollOnce();
    expect(stateStorage.setState).not.toHaveBeenCalled();
  });

  it("records latest video without announcing if first time seen", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { announceChannelId: "chan-1" } },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
    });
    stateStorage.getState.mockResolvedValue(null); // First time seen

    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("lofi-chan-id", {
      lastVideoId: "video-1",
    });
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("touches state if videoId is unchanged", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { announceChannelId: "chan-1" } },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
    });
    stateStorage.getState.mockResolvedValue({ lastVideoId: "video-1" });

    await scheduler.pollOnce();
    expect(stateStorage.touch).toHaveBeenCalledWith("lofi-chan-id");
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("polls and fires notification if new video found (video, live, upcoming, short)", async () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: {
          announceChannelId: "chan-1",
          notifyVideos: true,
          notifyLive: true,
          notifyUpcoming: true,
          notifyShorts: true,
          youtubeChannelTitle: "Lofi Girl",
        },
      },
    ];

    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
      title: "New Lofi Beats",
      link: "https://youtube.com/watch?v=video-1",
      updated: new Date().toISOString(),
    });

    youtubeClient.fetchVideoDetails.mockResolvedValue({
      id: "video-1",
      snippet: { title: "New Lofi Beats" },
      isLive: false,
      isUpcoming: false,
      durationSec: 180,
    });

    stateStorage.getState.mockResolvedValue({
      lastVideoId: "old-video",
    });

    // Test Video Type
    classifier.classify.mockResolvedValueOnce("video");
    await scheduler.pollOnce();
    expect(client.channels.fetch).toHaveBeenCalledWith("chan-1");

    // Test Live Type
    classifier.classify.mockResolvedValueOnce("live");
    await scheduler.pollOnce();

    // Test Upcoming Type
    classifier.classify.mockResolvedValueOnce("upcoming");
    await scheduler.pollOnce();

    // Test Short Type
    classifier.classify.mockResolvedValueOnce("short");
    await scheduler.pollOnce();
  });

  it("handles video detail fetch failure", async () => {
    const subscribers = [
      { guildId: "guild-1", subscription: { announceChannelId: "chan-1" } },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
    });
    stateStorage.getState.mockResolvedValue({ lastVideoId: "old-video" });
    youtubeClient.fetchVideoDetails.mockRejectedValueOnce(
      new Error("API limits"),
    );

    await scheduler.pollOnce();
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("skips announcement if channel fetch returns null (channel deleted)", async () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: { announceChannelId: "chan-deleted" },
      },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
    });
    stateStorage.getState.mockResolvedValue({ lastVideoId: "old-video" });
    youtubeClient.fetchVideoDetails.mockResolvedValue({
      id: "video-1",
      snippet: { title: "Title" },
    });
    client.channels.fetch.mockResolvedValue(null);

    await scheduler.pollOnce();
    expect(stateStorage.setState).toHaveBeenCalledWith("lofi-chan-id", {
      lastVideoId: "video-1",
    });
  });

  it("handles catch errors when channel.fetch rejects or send rejects", async () => {
    const subscribers = [
      {
        guildId: "guild-1",
        subscription: { announceChannelId: "chan-reject" },
      },
    ];
    subStorage.getChannelSubscriberMap.mockResolvedValue(
      new Map([["lofi-chan-id", subscribers]]),
    );

    youtubeClient.fetchLatestFeedEntry.mockResolvedValue({
      videoId: "video-1",
    });
    stateStorage.getState.mockResolvedValue({ lastVideoId: "old-video" });
    youtubeClient.fetchVideoDetails.mockResolvedValue({
      id: "video-1",
      snippet: { title: "Title" },
    });

    // 1. fetch rejects
    client.channels.fetch.mockRejectedValueOnce(new Error("Fetch failed"));
    await scheduler.pollOnce();

    // 2. send rejects
    const mockChannel = {
      send: jest.fn().mockRejectedValueOnce(new Error("Send failed")),
    };
    client.channels.fetch.mockResolvedValueOnce(mockChannel);
    await scheduler.pollOnce();
  });
});
