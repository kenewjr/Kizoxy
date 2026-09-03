const { Constants } = require("shoukaku");

// Mock shoukaku before requiring playLogic so the `require("shoukaku")` inside
// playLogic picks up the mock's Constants object.
jest.mock("shoukaku", () => ({
  Constants: { State: { CONNECTED: 2, CONNECTING: 1, DISCONNECTED: 0 } },
}));

jest.mock("../../../src/integrations/spotify/oembed", () => ({
  getSpotifyOembedTitle: jest.fn(),
}));

jest.mock("../../../src/lib/logger", () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

const {
  getSpotifyOembedTitle,
} = require("../../../src/integrations/spotify/oembed");
const playLogic = require("../../../src/features/music/playLogic");

const CONNECTED = Constants.State.CONNECTED;
const CONNECTING = Constants.State.CONNECTING;

const mockNode = (state) => ({ state });

const mockManager = (nodeStates, players = new Map()) => ({
  shoukaku: {
    nodes: new Map(nodeStates.map((s, i) => [`node${i}`, mockNode(s)])),
  },
  players,
  search: jest.fn(),
  createPlayer: jest.fn().mockResolvedValue({
    voiceId: "vc1",
    queue: { add: jest.fn() },
    playing: false,
    paused: false,
    play: jest.fn().mockResolvedValue(),
  }),
});

const makeCtx = (overrides = {}) => ({
  isChatInputCommand: () => false,
  member: { voice: { channel: { id: "vc1" } } },
  guild: {
    id: "g1",
    members: { me: { voice: { channelId: null } } },
  },
  channel: { id: "ch1", send: jest.fn().mockResolvedValue() },
  author: { id: "u1" },
  ...overrides,
});

const singleTrackResult = {
  type: "TRACK",
  tracks: [{ title: "Test Song" }],
};

const playlistResult = {
  type: "PLAYLIST",
  playlistName: "Test Playlist",
  tracks: [{ title: "A" }, { title: "B" }, { title: "C" }],
};

const emptyResult = { type: "SEARCH", tracks: [] };

describe("playLogicReadiness", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getSpotifyOembedTitle.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // covers: Cold start success
  test("cold start success — no existing player, node becomes ready within timeout, search returns tracks", async () => {
    const mgr = mockManager([CONNECTING]);
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["test query"];

    // Node starts CONNECTING, transitions to CONNECTED after 400ms
    setTimeout(() => {
      mgr.shoukaku.nodes.get("node0").state = CONNECTED;
    }, 400);

    const promise = playLogic(client, ctx, args);
    // Advance timers past the polling interval and the node-ready delay
    await jest.advanceTimersByTimeAsync(600);
    await promise;

    expect(mgr.search).toHaveBeenCalledWith("test query", {
      requester: ctx.author,
    });
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  // covers: Cold start timeout
  test("cold start timeout — no ready node within timeout, returns starting-up error, not 'no results'", async () => {
    const mgr = mockManager([CONNECTING]);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["test query"];

    const promise = playLogic(client, ctx, args);
    // Advance past the NODE_READY_TIMEOUT_MS (10000ms)
    await jest.advanceTimersByTimeAsync(11000);
    await promise;

    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("still connecting"),
    );
    // Must NOT say "No results found"
    expect(ctx.channel.send).not.toHaveBeenCalledWith(
      expect.stringContaining("No results"),
    );
    // Search should never have been called
    expect(mgr.search).not.toHaveBeenCalled();
  });

  // covers: Warm start (existing player)
  test("warm start — existing player for guild, readiness gate is skipped entirely", async () => {
    const existingPlayer = {
      voiceId: "vc1",
      queue: { add: jest.fn() },
      playing: false,
      paused: false,
      play: jest.fn().mockResolvedValue(),
    };
    // All nodes CONNECTING — would fail the gate if it ran
    const mgr = mockManager([CONNECTING], new Map([["g1", existingPlayer]]));
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["warm query"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    // Search should succeed immediately — gate was skipped
    expect(mgr.search).toHaveBeenCalled();
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
    // createPlayer should NOT have been called since player already exists
    expect(mgr.createPlayer).not.toHaveBeenCalled();
  });

  // covers: Empty-result retry success
  test("empty-result retry success — first search empty, second returns tracks, exactly 2 search calls", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["retry query"];

    const promise = playLogic(client, ctx, args);
    // Advance past SEARCH_RETRY_DELAY_MS (600ms)
    await jest.advanceTimersByTimeAsync(700);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(2);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  // covers: Empty-result retry exhausted
  test("empty-result retry exhausted — all searches empty, exactly 4 calls, normal 'no results' message", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["nonexistent song"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(5200); // 600 + 1500 + 3000 + 100
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(4);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("No results found"),
    );
    // Player should not have been created for a failed search
    expect(mgr.createPlayer).not.toHaveBeenCalled();
  });

  // covers: Single track URL
  test("single track URL — gate/retry logic does not change the single-track success shape", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["https://youtube.com/watch?v=dQw4w9WgXcQ"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(mgr.createPlayer).toHaveBeenCalled();
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  // covers: Playlist URL
  test("playlist URL — gate/retry logic does not change the playlist success shape", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(playlistResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = [
      "https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    ];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Playlist"),
    );
    expect(ctx.channel.send).toHaveBeenCalledWith(expect.stringContaining("3"));
  });

  test("Spotify track direct failure falls back to YouTube search using oEmbed title", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(singleTrackResult);
    getSpotifyOembedTitle.mockResolvedValue("Never Gonna Give You Up");
    const client = { manager: mgr };
    const ctx = makeCtx();
    const spotifyUrl =
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";

    const promise = playLogic(client, ctx, [spotifyUrl]);
    await jest.advanceTimersByTimeAsync(5200);
    await promise;

    expect(getSpotifyOembedTitle).toHaveBeenCalledWith(spotifyUrl);
    expect(mgr.search).toHaveBeenNthCalledWith(5, "Never Gonna Give You Up", {
      requester: ctx.author,
      engine: "youtube",
    });
    expect(mgr.createPlayer).toHaveBeenCalled();
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  test("Spotify playlist failure skips retries/oEmbed and shows Lavalink-side guidance", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    const client = { manager: mgr };
    const ctx = makeCtx();

    await playLogic(client, ctx, [
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    ]);

    expect(getSpotifyOembedTitle).not.toHaveBeenCalled();
    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Lavalink-side fix"),
    );
  });

  test("Spotify oEmbed failure falls through to direct YouTube guidance", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    getSpotifyOembedTitle.mockResolvedValue(null);
    const client = { manager: mgr };
    const ctx = makeCtx();

    const promise = playLogic(client, ctx, [
      "https://open.spotify.com/album/6DEjYFkNZh67HP7R9PSZvv",
    ]);
    await jest.advanceTimersByTimeAsync(5200);
    await promise;

    expect(getSpotifyOembedTitle).toHaveBeenCalledTimes(1);
    expect(mgr.search).toHaveBeenCalledTimes(4);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("direct YouTube link or search"),
    );
  });

  test("empty YouTube fallback returns useful Spotify failure message", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    getSpotifyOembedTitle.mockResolvedValue("Unfindable Artist");
    const client = { manager: mgr };
    const ctx = makeCtx();

    const promise = playLogic(client, ctx, [
      "https://open.spotify.com/artist/0LyfQWJT6nXafLPZqxe9Of",
    ]);
    await jest.advanceTimersByTimeAsync(10400);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(8);
    expect(mgr.search).toHaveBeenLastCalledWith("Unfindable Artist", {
      requester: ctx.author,
      engine: "youtube",
    });
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("direct YouTube link or search"),
    );
  });

  // covers: Playlist cold start with longer retry delay (KI #73)
  test("cold start + playlist URL — retry uses longer PLAYLIST_RETRY_DELAY_MS", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(playlistResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = [
      "https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    ];

    const promise = playLogic(client, ctx, args);
    // PLAYLIST_RETRY_DELAY_MS is 2000ms — advance past it
    await jest.advanceTimersByTimeAsync(2100);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(2);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Playlist"),
    );
  });

  // covers: Playlist cold start where all retries fail
  test("cold start + playlist URL — all retries empty, shows no results", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = [
      "https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    ];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(9100); // 2000 + 3000 + 4000 + 100
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(4);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("No results found"),
    );
  });

  // covers: Searching placeholder sent before search (prefix context)
  test("prefix context — searching placeholder sent before search call", async () => {
    const mgr = mockManager([CONNECTED]);
    let searchCalledAt = null;
    let placeholderSentAt = null;
    const sendMock = jest.fn().mockImplementation((msg) => {
      if (msg === "🔍 Searching...") {
        placeholderSentAt = Date.now();
        return Promise.resolve({ delete: jest.fn().mockResolvedValue() });
      }
      return Promise.resolve();
    });
    mgr.search.mockImplementation(async () => {
      searchCalledAt = Date.now();
      return singleTrackResult;
    });
    const client = { manager: mgr };
    const ctx = makeCtx({ channel: { id: "ch1", send: sendMock } });
    const args = ["test query"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(sendMock).toHaveBeenCalledWith("🔍 Searching...");
    expect(placeholderSentAt).not.toBeNull();
    expect(searchCalledAt).not.toBeNull();
    // Placeholder must be sent before search (or at same tick)
    expect(placeholderSentAt).toBeLessThanOrEqual(searchCalledAt);
  });

  // covers: Searching placeholder for slash context
  test("slash context — searching placeholder sent via editReply before search", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const editReply = jest.fn().mockResolvedValue();
    const ctx = makeCtx({
      isChatInputCommand: () => true,
      deferred: true,
      replied: false,
      deferReply: jest.fn().mockResolvedValue(),
      editReply,
      options: { getString: () => "test query" },
      user: { id: "u1" },
    });

    const promise = playLogic(client, ctx, []);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    // First editReply should be the searching placeholder
    expect(editReply.mock.calls[0][0]).toEqual({ content: "🔍 Searching..." });
  });

  test("Search succeeds on first try → no retry loop entered", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["instant success"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  test("Search empty on attempts 1-2, succeeds on attempt 3 → returns success", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["success on attempt 3"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(2200); // 600 + 1500 + 100
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(3);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });

  test("Playlist-looking query uses PLAYLIST_RETRY_DELAYS_MS, non-playlist uses SEARCH_RETRY_DELAYS_MS", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(emptyResult);
    const client = { manager: mgr };
    const ctx = makeCtx();

    // 1. Non-playlist
    let promise = playLogic(client, ctx, ["normal song"]);
    await jest.advanceTimersByTimeAsync(300);
    expect(mgr.search).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(400); // total 700ms
    expect(mgr.search).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(10000);
    await promise;

    mgr.search.mockClear();

    // 2. Playlist
    promise = playLogic(client, ctx, ["https://youtube.com/playlist?list=123"]);
    await jest.advanceTimersByTimeAsync(1000);
    expect(mgr.search).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1100); // total 2100ms
    expect(mgr.search).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(15000);
    await promise;
  });
});
