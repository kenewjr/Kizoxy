const { createMockClient } = require("../../helpers/mockFactory");

const mockInfo = jest.fn();
const mockSuccess = jest.fn();
const mockWarning = jest.fn();
const mockError = jest.fn();
const mockDebug = jest.fn();

jest.mock("../../../src/lib/logger", () => {
  return jest.fn().mockImplementation(() => ({
    info: mockInfo,
    success: mockSuccess,
    warning: mockWarning,
    error: mockError,
    debug: mockDebug,
  }));
});

const mockSearchLyrics = jest.fn();
jest.mock("../../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: mockSearchLyrics,
}));

const mockBuildMusicControlRow = jest.fn().mockReturnValue({});
const mockBuildNowPlayingEmbed = jest.fn().mockReturnValue({ data: {} });
const mockFetchNowPlayingMessage = jest.fn();

jest.mock("../../../src/features/music/musicHelper", () => ({
  buildMusicControlRow: mockBuildMusicControlRow,
  buildNowPlayingEmbed: mockBuildNowPlayingEmbed,
  fetchNowPlayingMessage: mockFetchNowPlayingMessage,
}));

const playerEmpty = require("../../../src/events/track/playerEmpty");
const playerEnd = require("../../../src/events/track/playerEnd");
const playerMoved = require("../../../src/events/track/playerMoved");
const playerStart = require("../../../src/events/track/playerStart");
const queueEnd = require("../../../src/events/track/queueEnd");
const trackEnd = require("../../../src/events/track/trackEnd");
const playerException = require("../../../src/events/track/playerException");
const playerStuck = require("../../../src/events/track/playerStuck");

describe("Track Events Hardening", () => {
  let client, player, channel, mockMessage;

  beforeEach(() => {
    jest.useFakeTimers();
    mockInfo.mockClear();
    mockSuccess.mockClear();
    mockWarning.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
    mockSearchLyrics.mockReset();
    mockFetchNowPlayingMessage.mockReset();

    mockMessage = {
      id: "msg-123",
      edit: jest.fn().mockResolvedValue({ id: "msg-123" }),
      components: [],
    };

    channel = {
      send: jest.fn().mockResolvedValue(mockMessage),
    };

    client = createMockClient();
    client.channels = {
      cache: new Map([["channel-1", channel]]),
    };

    player = {
      guildId: "guild-1",
      textId: "channel-1",
      playing: true,
      paused: false,
      lyricsEnabled: false,
      destroy: jest.fn().mockResolvedValue({}),
      skip: jest.fn().mockResolvedValue({}),
      play: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue({ tracks: [] }),
      queue: Object.assign([], {
        current: {
          title: "Track Current",
          length: 100000,
          requester: "user",
          uri: "uri",
        },
        size: 0,
        length: 0,
        durationLength: 0,
        add: jest.fn(),
      }),
      data: new Map(),
    };

    // Helper functions for player.data Map
    player.data.get = (key) => player.data[key];
    player.data.set = (key, val) => {
      player.data[key] = val;
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("playerEmpty.js", () => {
    it("stops and cleans interval, does not destroy if stay is active", async () => {
      const spyClear = jest.spyOn(global, "clearInterval");
      const testInterval = setInterval(() => {}, 1000);
      player.data._watcherInterval = testInterval;
      player.data.set("stay", true);
      await playerEmpty(client, player);
      expect(player.destroy).not.toHaveBeenCalled();
      expect(spyClear).toHaveBeenCalledWith(testInterval);
      spyClear.mockRestore();
    });

    it("sends notice and destroys if stay is inactive", async () => {
      player.data.set("stay", false);
      await playerEmpty(client, player);
      expect(channel.send).toHaveBeenCalled();
      expect(player.destroy).toHaveBeenCalledTimes(1);
    });

    it("returns early if channel does not exist", async () => {
      client.channels.cache.clear();
      await playerEmpty(client, player);
      expect(player.destroy).not.toHaveBeenCalled();
    });
  });

  describe("playerEnd.js", () => {
    it("does nothing if autoplay is false", async () => {
      player.data.set("autoplay", false);
      await playerEnd(client, player);
      expect(player.search).not.toHaveBeenCalled();
    });

    it("searches and enqueues third autoplay track if autoplay is true", async () => {
      player.data.set("autoplay", true);
      player.data.set("identifier", "abc");
      player.data.set("requester", "user");
      player.search.mockResolvedValue({
        tracks: ["t0", "t1", "t2", "t3"],
      });
      await playerEnd(client, player);
      expect(player.search).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=abc&list=RDabc",
        { requester: "user" },
      );
      expect(player.queue.add).toHaveBeenCalledWith("t2");
    });
  });

  describe("playerMoved.js", () => {
    it("destroys player", async () => {
      await playerMoved(client, player);
      expect(player.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("playerEnd.js", () => {
    it("does nothing if autoplay is false", async () => {
      player.data.set("autoplay", false);
      await playerEnd(client, player);
      expect(player.search).not.toHaveBeenCalled();
    });

    it("searches and enqueues third autoplay track if autoplay is true", async () => {
      player.data.set("autoplay", true);
      player.data.set("identifier", "abc");
      player.data.set("requester", "user");
      player.search.mockResolvedValue({
        tracks: ["t0", "t1", "t2", "t3"],
      });
      await playerEnd(client, player);
      expect(player.search).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=abc&list=RDabc",
        { requester: "user" },
      );
      expect(player.queue.add).toHaveBeenCalledWith("t2");
    });

    it("does nothing if autoplay search returns no tracks", async () => {
      player.data.set("autoplay", true);
      player.data.set("identifier", "abc");
      player.data.set("requester", "user");
      player.search.mockResolvedValue({
        tracks: [],
      });
      await playerEnd(client, player);
      expect(player.queue.add).not.toHaveBeenCalled();
    });
  });

  describe("playerStart.js", () => {
    it("sends a new Now Playing message and configures watcher", async () => {
      const track = { title: "Song 1" };
      await playerStart(client, player, track);

      expect(player.data.nowPlayingEmbed).toBeDefined();
      expect(player.data.nowPlayingMessage).toBe(mockMessage);
      expect(channel.send).toHaveBeenCalled();

      // Advancing timer does nothing because queue size has not changed
      jest.advanceTimersByTime(3000);
      expect(mockMessage.edit).not.toHaveBeenCalled();

      // Trigger size change and advance timer
      player.queue.size = 2;
      mockFetchNowPlayingMessage.mockResolvedValue(mockMessage);
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); // flush microtasks
      expect(mockMessage.edit).toHaveBeenCalled();
    });

    it("edits previous Now Playing message if present", async () => {
      const track = { title: "Song 1" };
      player.data._prevNowPlayingMessage = mockMessage;
      await playerStart(client, player, track);
      expect(mockMessage.edit).toHaveBeenCalled();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it("sends new message if editing previous message fails", async () => {
      const track = { title: "Song 1" };
      mockMessage.edit.mockRejectedValueOnce(new Error("Edit failed"));
      player.data._prevNowPlayingMessage = mockMessage;
      await playerStart(client, player, track);
      expect(channel.send).toHaveBeenCalled();
    });

    it("catches outer send error gracefully", async () => {
      const track = { title: "Song 1" };
      channel.send.mockRejectedValueOnce(new Error("Network Down"));
      await expect(playerStart(client, player, track)).resolves.not.toThrow();
    });

    it("watcher: stops if watched message ID changes", async () => {
      const track = { title: "Song 1" };
      await playerStart(client, player, track);

      // Change nowPlayingMessage ID
      player.data.nowPlayingMessage = { id: "msg-different" };
      player.queue.size = 2;
      jest.advanceTimersByTime(3000);
      expect(player.data._watcherInterval).toBeNull();
    });

    it("watcher: stops if fetchNowPlayingMessage returns null", async () => {
      const track = { title: "Song 1" };
      await playerStart(client, player, track);

      player.queue.size = 2;
      mockFetchNowPlayingMessage.mockResolvedValue(null);
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(player.data._watcherInterval).toBeNull();
    });

    it("watcher: handles error on edit failure", async () => {
      const track = { title: "Song 1" };
      await playerStart(client, player, track);

      player.queue.size = 2;
      mockFetchNowPlayingMessage.mockResolvedValue(mockMessage);
      mockMessage.edit.mockRejectedValueOnce(new Error("Watcher edit failed"));
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      // Should log warning and not crash/stop watcher
      expect(player.data._watcherInterval).not.toBeNull();
    });

    it("searches lyrics automatically if lyricsEnabled is true", async () => {
      player.lyricsEnabled = true;
      const track = { title: "Song 1" };
      const mockLyricsEmbed = { title: "Lyrics" };
      mockSearchLyrics.mockResolvedValue(mockLyricsEmbed);

      await playerStart(client, player, track);
      // Run pending timers/setImmediate
      jest.runOnlyPendingTimers();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [player.data.nowPlayingEmbed, mockLyricsEmbed],
        }),
      );
    });

    it("autoFetchLyrics: cleans loading embed if lyrics not found", async () => {
      player.lyricsEnabled = true;
      const track = { title: "Song 1" };
      mockSearchLyrics.mockResolvedValue(null);

      await playerStart(client, player, track);
      jest.runOnlyPendingTimers();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [player.data.nowPlayingEmbed],
        }),
      );
    });

    it("autoFetchLyrics: handles searchLyrics exceptions", async () => {
      player.lyricsEnabled = true;
      const track = { title: "Song 1" };
      mockSearchLyrics.mockRejectedValue(new Error("lyrics crash"));

      await playerStart(client, player, track);
      jest.runOnlyPendingTimers();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [player.data.nowPlayingEmbed],
        }),
      );
    });
  });

  describe("queueEnd.js", () => {
    it("starts lofi if lofi mode is active", async () => {
      player.data.set("lofi", true);
      player.data.set("lofiUrl", "lofi-stream-url");
      player.playing = false;
      player.paused = false;
      player.search.mockResolvedValue({ tracks: ["lofi-track"] });

      await queueEnd(client, player);
      expect(player.search).toHaveBeenCalledWith("lofi-stream-url", {
        requester: client.user,
      });
      expect(player.queue.add).toHaveBeenCalledWith("lofi-track");
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("handles lofi auto-restart search failure", async () => {
      player.data.set("lofi", true);
      player.data.set("lofiUrl", "lofi-stream-url");
      player.search.mockRejectedValue(new Error("Lavalink offline"));
      await expect(queueEnd(client, player)).resolves.not.toThrow();
    });

    it("returns early if channel does not exist and lofi is inactive", async () => {
      client.channels.cache.clear();
      await queueEnd(client, player);
      expect(player.destroy).not.toHaveBeenCalled();
    });

    it("sends 24/7 notice and keeps alive if stay is active", async () => {
      player.data.set("stay", true);
      await queueEnd(client, player);
      expect(channel.send).toHaveBeenCalled();
      expect(player.destroy).not.toHaveBeenCalled();
    });

    it("handles error on sending 24/7 notice", async () => {
      player.data.set("stay", true);
      channel.send.mockRejectedValueOnce(new Error("Send failed"));
      await expect(queueEnd(client, player)).resolves.not.toThrow();
    });

    it("destroys player if normal end", async () => {
      await queueEnd(client, player);
      expect(channel.send).toHaveBeenCalled();
      expect(player.destroy).toHaveBeenCalledTimes(1);
    });

    it("handles error on sending normal end notice", async () => {
      channel.send.mockRejectedValueOnce(new Error("Send failed"));
      await expect(queueEnd(client, player)).resolves.not.toThrow();
    });
  });

  describe("trackEnd.js", () => {
    it("does nothing if lofi mode is disabled", async () => {
      player.data.set("lofi", false);
      await trackEnd(client, player, {}, {});
      expect(player.search).not.toHaveBeenCalled();
    });

    it("does nothing if stopped or replaced", async () => {
      player.data.set("lofi", true);
      await trackEnd(client, player, {}, { reason: "stopped" });
      await trackEnd(client, player, {}, { reason: "replaced" });
      expect(player.search).not.toHaveBeenCalled();
    });

    it("re-searches and plays lofi stream on interruption", async () => {
      player.data.set("lofi", true);
      player.data.set("lofiUrl", "url");
      player.playing = false;
      player.paused = false;
      player.search.mockResolvedValue({ tracks: ["lofi"] });

      await trackEnd(
        client,
        player,
        { requester: "user", uri: "url" },
        { reason: "finished" },
      );
      expect(player.search).toHaveBeenCalledWith("url", { requester: "user" });
      expect(player.queue.add).toHaveBeenCalledWith("lofi");
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("logs error if lofi auto-restart returns no tracks", async () => {
      player.data.set("lofi", true);
      player.data.set("lofiUrl", "url");
      player.search.mockResolvedValue({ tracks: [] });
      await trackEnd(
        client,
        player,
        { requester: "user", uri: "url" },
        { reason: "finished" },
      );
      expect(player.queue.add).not.toHaveBeenCalled();
    });

    it("handles search exception during lofi auto-restart", async () => {
      player.data.set("lofi", true);
      player.data.set("lofiUrl", "url");
      player.search.mockRejectedValue(new Error("Lavalink offline"));
      await expect(
        trackEnd(
          client,
          player,
          { requester: "user", uri: "url" },
          { reason: "finished" },
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("playerException.js", () => {
    it("sends notice without stopping the track a second time", async () => {
      await playerException(client, player, {
        exception: { message: "Error 403" },
      });
      expect(channel.send).toHaveBeenCalled();
      expect(player.skip).not.toHaveBeenCalled();
    });

    it("logs safely when channel and payload are missing", async () => {
      client.channels.cache.clear();
      await expect(playerException(client, player)).resolves.not.toThrow();
      expect(player.skip).not.toHaveBeenCalled();
    });

    it("uses the current queue track in the notice", async () => {
      player.queue.current = { title: "Bad Song", uri: "http" };
      await playerException(client, player, {
        exception: { message: "Error 403" },
      });
      expect(channel.send).toHaveBeenCalledTimes(1);
      expect(player.skip).not.toHaveBeenCalled();
    });
  });

  describe("playerStuck.js", () => {
    it("sends a buffering notice without stopping the current track", async () => {
      await playerStuck(client, player, { thresholdMs: 5000 });
      expect(channel.send).toHaveBeenCalled();
      expect(player.skip).not.toHaveBeenCalled();
    });

    it("does not stop the current track when the notice channel is unavailable", async () => {
      client.channels.cache.clear();
      await playerStuck(client, player, { thresholdMs: 5000 });
      expect(player.skip).not.toHaveBeenCalled();
    });

    it("handles a missing current track without stopping the queue", async () => {
      player.queue.current = null;
      await playerStuck(client, player, { thresholdMs: 5000 });
      expect(player.skip).not.toHaveBeenCalled();
    });
  });
});
