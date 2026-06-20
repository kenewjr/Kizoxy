const { Constants } = require("shoukaku");

// Mock shoukaku before requiring playLogic so the `require("shoukaku")` inside
// playLogic picks up the mock's Constants object.
jest.mock("shoukaku", () => ({
  Constants: { State: { CONNECTED: 2, CONNECTING: 1, DISCONNECTED: 0 } },
}));

jest.mock("../src/lib/logger", () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
});

const playLogic = require("../src/features/music/playLogic");
const { waitForNodeReady } = playLogic;

const CONNECTED = Constants.State.CONNECTED;
const CONNECTING = Constants.State.CONNECTING;
const DISCONNECTED = Constants.State.DISCONNECTED;

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
  test("empty-result retry exhausted — both searches empty, exactly 2 calls, normal 'no results' message", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["nonexistent song"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(700);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(2);
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
    const args = ["https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Playlist"),
    );
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("3"),
    );
  });

  // covers: Spotify link (routed through ytsearch per KI #44 — Spotify support
  // dropped, so Spotify URLs are just passed as a raw query string to search().
  // No special code path exists in playLogic.js; the search engine handles
  // resolution. This test confirms the generic path still works for Spotify-shaped input.)
  test("Spotify link — treated as a generic search query, gate/retry logic works normally", async () => {
    const mgr = mockManager([CONNECTED]);
    mgr.search.mockResolvedValue(singleTrackResult);
    const client = { manager: mgr };
    const ctx = makeCtx();
    const args = ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"];

    const promise = playLogic(client, ctx, args);
    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(mgr.search).toHaveBeenCalledWith(
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      { requester: ctx.author },
    );
    expect(mgr.search).toHaveBeenCalledTimes(1);
    expect(ctx.channel.send).toHaveBeenCalledWith(
      expect.stringContaining("Test Song"),
    );
  });
});
