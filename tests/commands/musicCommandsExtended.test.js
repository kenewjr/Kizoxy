const {
  createMockInteraction,
  createMockClient,
} = require("../helpers/mockFactory");

const filterCmd = require("../../src/commands/slash/music/filter");
const searchCmd = require("../../src/commands/slash/music/search");
const queueCmd = require("../../src/commands/slash/music/queue");
const removeCmd = require("../../src/commands/slash/music/remove");
const lofiCmd = require("../../src/commands/slash/music/lofi");
const lyricsCmd = require("../../src/commands/slash/music/lyrics");
const stayCmd = require("../../src/commands/slash/music/twentyfourseven");
const leaveCmd = require("../../src/commands/slash/music/leave");
const shuffleCmd = require("../../src/commands/slash/music/shuffle");
const forwardCmd = require("../../src/commands/slash/music/forward");
const volumeCmd = require("../../src/commands/slash/music/volume");

jest.mock("../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: jest.fn(),
  validatePlayerForLyrics: jest.fn(),
}));

jest.mock("../../src/features/music/musicHelper", () => ({
  scheduleAutoDelete: jest.fn(),
  EPHEMERAL_ERROR_TTL_MS: 5000,
  addLyricsToNowPlaying: jest.fn().mockResolvedValue(true),
  removeLyricsFromNowPlaying: jest.fn().mockResolvedValue(true),
  buildMusicControlRow: jest.fn().mockReturnValue({}),
  swapNowPlayingComponents: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/lib/PageQueue", () => ({
  NormalPage: jest.fn(),
}));

describe("Extended Music Commands Tests", () => {
  let client, interaction, player, voiceChannel;

  beforeEach(() => {
    client = createMockClient();
    player = {
      guildId: "guild-1",
      playing: true,
      paused: false,
      volume: 50,
      position: 1000,
      connect: jest.fn(),
      play: jest.fn().mockResolvedValue({}),
      seek: jest.fn().mockResolvedValue({}),
      destroy: jest.fn().mockResolvedValue({}),
      setVolume: jest.fn().mockResolvedValue({}),
      shoukaku: {
        setFilters: jest.fn().mockResolvedValue({}),
      },
      queue: Object.assign([], {
        current: {
          title: "Current Song",
          length: 300000,
          uri: "uri",
          requester: "User",
        },
        length: 1,
        size: 1,
        durationLength: 300000,
        clear: jest.fn(),
        add: jest.fn(),
        shuffle: jest.fn().mockResolvedValue({}),
      }),
      data: new Map(),
    };
    player.queue[0] = {
      title: "Current Song",
      length: 300000,
      uri: "uri",
      requester: "User",
    };

    client.manager = {
      players: new Map([["guild-1", player]]),
      createPlayer: jest.fn().mockResolvedValue(player),
      search: jest.fn().mockResolvedValue({
        tracks: [{ title: "Lofi Track", uri: "lofi-url" }],
      }),
    };

    voiceChannel = {
      id: "vc-1",
      name: "Voice Channel",
      permissionsFor: () => ({
        has: () => true,
      }),
    };

    interaction = createMockInteraction();
    interaction.channel = { id: "channel-1" };
    interaction.guild = {
      id: "guild-1",
      name: "Guild 1",
      iconURL: () => "https://example.com/icon.png",
      members: {
        me: {
          voice: {
            channel: voiceChannel,
            channelId: "vc-1",
          },
        },
      },
    };
    interaction.member.voice.channel = voiceChannel;
  });

  describe("filter command", () => {
    it("handles reset action", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("reset");
      await filterCmd.run(client, interaction);
      expect(player.shoukaku.setFilters).toHaveBeenCalled();
    });

    it("handles 3d action", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("3d");
      await filterCmd.run(client, interaction);
      expect(player.shoukaku.setFilters).toHaveBeenCalled();
    });

    it("handles bassboost action with and without amount", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("bassboost");
      interaction.options.getInteger = jest.fn().mockReturnValue(5);
      await filterCmd.run(client, interaction);

      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await filterCmd.run(client, interaction);
      expect(player.shoukaku.setFilters).toHaveBeenCalled();
    });

    it("handles other filters (doubletime, karaoke, nightcore, vibrato)", async () => {
      const filters = [
        "doubletime",
        "karaoke",
        "nightcore",
        "slowmotion",
        "vibrato",
      ];
      for (const filter of filters) {
        interaction.options.getString = jest.fn().mockReturnValue(filter);
        await filterCmd.run(client, interaction);
      }
      expect(player.shoukaku.setFilters).toHaveBeenCalled();
    });

    it("handles missing player", async () => {
      client.manager.players.clear();
      await filterCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("No playing"),
      );
    });
  });

  describe("search command", () => {
    it("runs happy path search and selects button", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("test song");
      player.search = jest.fn().mockResolvedValue({
        type: "TRACK",
        tracks: [
          {
            title: "Result 1",
            uri: "uri-1",
            length: 120000,
            requester: "User",
          },
          {
            title: "Result 2",
            uri: "uri-2",
            length: 120000,
            requester: "User",
          },
          {
            title: "Result 3",
            uri: "uri-3",
            length: 120000,
            requester: "User",
          },
          {
            title: "Result 4",
            uri: "uri-4",
            length: 120000,
            requester: "User",
          },
          {
            title: "Result 5",
            uri: "uri-5",
            length: 120000,
            requester: "User",
          },
        ],
      });

      let collectCallback, endCallback;
      const mockCollector = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "collect") collectCallback = callback;
          if (event === "end") endCallback = callback;
        }),
      };
      const mockMsg = {
        edit: jest.fn().mockResolvedValue({}),
        createMessageComponentCollector: jest
          .fn()
          .mockReturnValue(mockCollector),
      };
      interaction.editReply = jest.fn().mockResolvedValue(mockMsg);

      await searchCmd.run(client, interaction);

      // Trigger collect
      await collectCallback({ customId: "one" });
      await collectCallback({ customId: "two" });
      await collectCallback({ customId: "three" });
      await collectCallback({ customId: "four" });
      await collectCallback({ customId: "five" });

      // Trigger end
      await endCallback(null, "time");
      expect(player.search).toHaveBeenCalled();
    });

    it("handles playlist type search results", async () => {
      interaction.options.getString = jest
        .fn()
        .mockReturnValue("playlist link");
      player.search = jest.fn().mockResolvedValue({
        type: "PLAYLIST",
        playlistName: "My List",
        tracks: [
          {
            title: "Result 1",
            uri: "uri-1",
            length: 120000,
            requester: "User",
          },
        ],
      });
      await searchCmd.run(client, interaction);
      expect(player.search).toHaveBeenCalled();
    });

    it("handles Connect permission error", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("test song");
      voiceChannel.permissionsFor = jest.fn().mockReturnValue({
        has: (flag) => flag !== 1048576n, // connective permission flag
      });
      await searchCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("permission to join"),
      );
    });

    it("handles Speak permission error", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("test song");
      voiceChannel.permissionsFor = jest.fn().mockReturnValue({
        has: (flag) => flag !== 2097152n, // speak permission flag
      });
      await searchCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("permission to speak"),
      );
    });

    it("handles zero search results", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("test song");
      player.search = jest.fn().mockResolvedValue({
        type: "TRACK",
        tracks: [],
      });
      await searchCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("No results"),
      );
    });
  });

  describe("lyrics command", () => {
    it("toggles and searches lyrics (happy path)", async () => {
      const lyricsService = require("../../src/features/lyrics/lyricsService");
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Track Title" },
      });
      lyricsService.searchLyrics.mockResolvedValue({});

      await lyricsCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("handles lyrics not found", async () => {
      const lyricsService = require("../../src/features/lyrics/lyricsService");
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Track Title" },
      });
      lyricsService.searchLyrics.mockResolvedValue(null);
      player.lyricsEnabled = false;

      await lyricsCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("handles deactivating/hiding lyrics", async () => {
      const lyricsService = require("../../src/features/lyrics/lyricsService");
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Track Title" },
      });
      player.lyricsEnabled = true; // start active so run toggles it off

      await lyricsCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  describe("twentyfourseven command", () => {
    it("toggles stay from false to true", async () => {
      player.data.set("stay", false);
      await stayCmd.run(client, interaction);
      expect(player.data.get("stay")).toBe(true);
    });

    it("toggles stay from true to false", async () => {
      player.data.set("stay", true);
      await stayCmd.run(client, interaction);
      expect(player.data.get("stay")).toBe(false);
    });
  });

  describe("shuffle command", () => {
    it("shuffles queue", async () => {
      await shuffleCmd.run(client, interaction);
      expect(player.queue.shuffle).toHaveBeenCalled();
    });

    it("handles missing player", async () => {
      client.manager.players.clear();
      await shuffleCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("No playing"),
        }),
      );
    });

    it("handles wrong voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-wrong" };
      await shuffleCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("same voice channel"),
        }),
      );
    });
  });

  describe("leave command", () => {
    it("leaves voice channel", async () => {
      await leaveCmd.run(client, interaction);
      expect(player.destroy).toHaveBeenCalled();
    });

    it("handles missing player", async () => {
      client.manager.players.clear();
      await leaveCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("No playing"),
        }),
      );
    });

    it("handles wrong voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-wrong" };
      await leaveCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("same voice channel"),
        }),
      );
    });
  });

  describe("lofi command", () => {
    it("starts continuous lofi radio (happy path)", async () => {
      player.state = "CONNECTED";
      await lofiCmd.run(client, interaction);
      expect(client.manager.search).toHaveBeenCalled();
    });

    it("connects player if not connected", async () => {
      player.state = "DISCONNECTED";
      await lofiCmd.run(client, interaction);
      expect(player.connect).toHaveBeenCalled();
    });

    it("handles user not in voice channel", async () => {
      interaction.member.voice.channel = null;
      await lofiCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("You need to be in a voice channel"),
        }),
      );
    });

    it("handles bot already in another voice channel", async () => {
      interaction.guild.members.me.voice.channelId = "vc-other";
      await lofiCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("already playing in another"),
        }),
      );
    });

    it("handles empty search results", async () => {
      client.manager.search.mockResolvedValue({ tracks: [] });
      await lofiCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load Lofi"),
      );
    });
  });

  describe("forward command", () => {
    it("forwards within duration using custom seconds", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(10);
      await forwardCmd.run(client, interaction);
      expect(player.seek).toHaveBeenCalled();
    });

    it("fails if forwarding exceeds track length", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(500);
      await forwardCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("can't forward more"),
      );
    });

    it("forwards using default seconds (10s)", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await forwardCmd.run(client, interaction);
      expect(player.seek).toHaveBeenCalled();
    });
  });

  describe("volume command", () => {
    it("sets custom volume successfully", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(80);
      await volumeCmd.run(client, interaction);
      expect(player.setVolume).toHaveBeenCalledWith(80);
    });

    it("displays current volume if amount omitted", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await volumeCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("50%"),
      );
    });
  });

  describe("queue command", () => {
    it("renders page 1 without pagination helper if queue short", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("uses PageQueue pagination for long queues", async () => {
      player.queue.length = 15;
      for (let i = 0; i < 15; i++) {
        player.queue[i] = {
          title: `Song ${i + 1}`,
          length: 1000,
          requester: "User",
        };
      }
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await queueCmd.run(client, interaction);
      const { NormalPage } = require("../../src/lib/PageQueue");
      expect(NormalPage).toHaveBeenCalled();
    });

    it("handles explicit page request", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(1);
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("returns error for page out of bounds", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(99);
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("pages available"),
      );
    });
  });

  describe("remove command", () => {
    it("removes song at position", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(1);
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("fails remove if position out of bounds", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(5);
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Song not found"),
        }),
      );
    });

    it("fails remove if position not provided", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("specify the position"),
        }),
      );
    });

    it("clears the queue", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("clear");
      player.queue.size = 2;
      await removeCmd.run(client, interaction);
      expect(player.queue.clear).toHaveBeenCalled();
    });

    it("fails clear if queue already empty", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("clear");
      player.queue.size = 0;
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("already empty"),
        }),
      );
    });
  });
});
