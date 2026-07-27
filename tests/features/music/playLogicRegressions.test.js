const { Constants } = require("shoukaku");
const playLogic = require("../../../src/features/music/playLogic");
const musicHelper = require("../../../src/features/music/musicHelper");
const donateSeenStorage = require("../../../src/persistence/donateSeenStorage");

jest.mock("../../../src/persistence/donateSeenStorage", () => ({
  hasSeen: jest.fn(),
  markSeen: jest.fn(),
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

describe("Music Playback Regression Tests", () => {
  let client, ctx, player;

  beforeEach(() => {
    jest.useFakeTimers();
    donateSeenStorage.hasSeen.mockReset();
    donateSeenStorage.markSeen.mockReset();

    player = {
      guildId: "g1",
      voiceId: "vc1",
      playing: false,
      paused: false,
      play: jest.fn().mockResolvedValue(),
      queue: Object.assign([], {
        current: { title: "Track", length: 100000 },
        add: jest.fn(),
      }),
      data: {
        get: function (key) {
          return this[key];
        },
        set: function (key, val) {
          this[key] = val;
        },
      },
    };

    client = {
      manager: {
        players: new Map([["g1", player]]),
        search: jest.fn().mockResolvedValue({
          tracks: [{ title: "Lofi Song", length: 100000 }],
        }),
        createPlayer: jest.fn().mockResolvedValue(player),
        shoukaku: {
          nodes: new Map([["node0", { state: Constants.State.CONNECTED }]]),
        },
      },
    };

    ctx = {
      isChatInputCommand: () => false,
      member: { voice: { channel: { id: "vc1" } } },
      guild: {
        id: "g1",
        members: { me: { voice: { channelId: null } } },
      },
      channel: {
        id: "ch1",
        send: jest.fn().mockResolvedValue({ delete: jest.fn() }),
      },
      author: { id: "u1" },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Cold-start node readiness & Bounded retry loop", () => {
    it("waits for connecting node to become connected, then searches and plays", async () => {
      // Clear players so existingPlayer is falsy, triggering cold start readiness gate
      client.manager.players.clear();

      // Set node to CONNECTING initially
      const node = { state: Constants.State.CONNECTING };
      client.manager.shoukaku.nodes.set("node0", node);

      // Trigger transition to CONNECTED after 400ms
      setTimeout(() => {
        node.state = Constants.State.CONNECTED;
      }, 400);

      const promise = playLogic(client, ctx, ["query"]);
      await jest.advanceTimersByTimeAsync(500);
      await promise;

      expect(client.manager.search).toHaveBeenCalledWith(
        "query",
        expect.any(Object),
      );
      expect(player.play).toHaveBeenCalled();
    });

    it("fails and returns error message if node does not become connected within timeout", async () => {
      // Clear players so existingPlayer is falsy
      client.manager.players.clear();

      const node = { state: Constants.State.CONNECTING };
      client.manager.shoukaku.nodes.set("node0", node);

      const promise = playLogic(client, ctx, ["query"]);
      await jest.advanceTimersByTimeAsync(11000); // Exceed 10000ms ready timeout
      await promise;

      expect(ctx.channel.send).toHaveBeenCalledWith(
        expect.stringContaining("Music server is still connecting"),
      );
      expect(client.manager.search).not.toHaveBeenCalled();
    });

    it("retries search if it initially returns empty/no tracks", async () => {
      // First search returns empty, second returns tracks
      client.manager.search
        .mockResolvedValueOnce({ tracks: [] })
        .mockResolvedValueOnce({
          tracks: [{ title: "Lofi Song", length: 100000 }],
        });

      const promise = playLogic(client, ctx, ["query"]);
      await jest.advanceTimersByTimeAsync(1000); // Delays are [600, 1500, 3000]
      await promise;

      expect(client.manager.search).toHaveBeenCalledTimes(2);
      expect(player.play).toHaveBeenCalled();
    });
  });

  describe("First-play donation message", () => {
    it("sends donation promo on first play if user has not seen it yet", async () => {
      donateSeenStorage.hasSeen.mockReturnValue(false);

      await playLogic(client, ctx, ["query"]);
      expect(donateSeenStorage.markSeen).toHaveBeenCalledWith("u1");
      expect(ctx.channel.send).toHaveBeenCalledWith(
        expect.stringContaining("donation helps keep it running"),
      );
    });

    it("sends donation promo on first play for slash command context", async () => {
      donateSeenStorage.hasSeen.mockReturnValue(false);

      const slashCtx = {
        isChatInputCommand: () => true,
        deferred: false,
        replied: false,
        deferReply: jest.fn().mockResolvedValue(),
        editReply: jest.fn().mockResolvedValue(),
        reply: jest.fn().mockResolvedValue(),
        options: { getString: () => "query" },
        user: { id: "u1" },
        member: { voice: { channel: { id: "vc1" } } },
        guild: {
          id: "g1",
          members: { me: { voice: { channelId: null } } },
        },
        channel: {
          id: "ch1",
          send: jest.fn().mockResolvedValue({ delete: jest.fn() }),
        },
      };

      await playLogic(client, slashCtx, []);
      expect(donateSeenStorage.markSeen).toHaveBeenCalledWith("u1");
      expect(slashCtx.channel.send).toHaveBeenCalledWith(
        expect.stringContaining("donation helps keep it running"),
      );
    });

    it("does not send donation promo if user has already seen it", async () => {
      donateSeenStorage.hasSeen.mockReturnValue(true);

      await playLogic(client, ctx, ["query"]);
      expect(donateSeenStorage.markSeen).not.toHaveBeenCalled();
      expect(ctx.channel.send).not.toHaveBeenCalledWith(
        expect.stringContaining("donation helps keep it running"),
      );
    });
  });

  describe("Ephemeral auto-delete double-schedule guard", () => {
    it("schedules auto-delete only once", () => {
      const mockInteraction = {
        id: "int-123",
        deleteReply: jest.fn().mockResolvedValue({}),
      };

      musicHelper.scheduleAutoDelete(mockInteraction);
      musicHelper.scheduleAutoDelete(mockInteraction);

      expect(mockInteraction._kizoxyAutoDeleteScheduled).toBe(true);

      jest.advanceTimersByTime(5000);
      expect(mockInteraction.deleteReply).toHaveBeenCalledTimes(1);
    });
  });

  describe("Now Playing message tracking & editing", () => {
    it("returns stored nowPlayingMessage directly from player data", async () => {
      const mockMsg = { id: "np-msg" };
      player.data.set("nowPlayingMessage", mockMsg);

      const msg = await musicHelper.fetchNowPlayingMessage(client, player);
      expect(msg).toBe(mockMsg);
    });

    it("addLyricsToNowPlaying edits the message with both embeds", async () => {
      const mockMsg = { edit: jest.fn().mockResolvedValue({}) };
      player.data.set("nowPlayingMessage", mockMsg);
      player.data.set("nowPlayingEmbed", { title: "Playing Now" });

      const success = await musicHelper.addLyricsToNowPlaying(client, player, {
        title: "Lyrics",
      });
      expect(success).toBe(true);
      expect(mockMsg.edit).toHaveBeenCalledWith({
        embeds: [{ title: "Playing Now" }, { title: "Lyrics" }],
        components: undefined,
      });
      expect(player.data.get("lyricsEmbed")).toEqual({ title: "Lyrics" });
    });

    it("removeLyricsFromNowPlaying edits the message back to only nowPlayingEmbed", async () => {
      const mockMsg = { edit: jest.fn().mockResolvedValue({}) };
      player.data.set("nowPlayingMessage", mockMsg);
      player.data.set("nowPlayingEmbed", { title: "Playing Now" });

      const success = await musicHelper.removeLyricsFromNowPlaying(
        client,
        player,
      );
      expect(success).toBe(true);
      expect(mockMsg.edit).toHaveBeenCalledWith({
        embeds: [{ title: "Playing Now" }],
        components: undefined,
      });
    });

    it("handles edit exception gracefully and returns false", async () => {
      const mockMsg = {
        edit: jest.fn().mockRejectedValue(new Error("Discord API down")),
      };
      player.data.set("nowPlayingMessage", mockMsg);
      player.data.set("nowPlayingEmbed", { title: "Playing" });

      const success = await musicHelper.addLyricsToNowPlaying(client, player, {
        title: "Lyrics",
      });
      expect(success).toBe(false);
    });
  });
});
