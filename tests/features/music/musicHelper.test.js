const {
  validateMusicContext,
  validateMusicContextMessage,
  scheduleAutoDelete,
  formatProgressBar,
  getSourceMeta,
  buildNowPlayingEmbed,
  buildMusicControlRow,
  fetchNowPlayingMessage,
  addLyricsToNowPlaying,
  removeLyricsFromNowPlaying,
  swapNowPlayingComponents,
} = require("../../../src/features/music/musicHelper");

describe("Music Helper Tests", () => {
  let client, interaction, message, player;

  beforeEach(() => {
    player = {
      voiceId: "vc-1",
      volume: 100,
      position: 1000,
      queue: {
        size: 2,
        durationLength: 200000,
      },
      data: {
        nowPlayingMessage: {
          components: [],
          edit: jest.fn().mockResolvedValue({}),
        },
        nowPlayingEmbed: {},
      },
    };
    client = {
      color: 0x5865f2,
      user: {
        displayAvatarURL: () => "https://example.com/avatar.png",
      },
      manager: {
        players: new Map([["guild-1", player]]),
      },
    };
    interaction = {
      guild: { id: "guild-1" },
      member: {
        voice: {
          channel: { id: "vc-1" },
        },
      },
      message: {
        edit: jest.fn().mockResolvedValue({}),
      },
      deleteReply: jest.fn().mockResolvedValue({}),
    };
    message = {
      guild: { id: "guild-1" },
      member: {
        voice: {
          channel: { id: "vc-1" },
        },
      },
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("validateMusicContext", () => {
    it("returns player when match is successful", () => {
      const res = validateMusicContext(client, interaction);
      expect(res.player).toBe(player);
    });

    it("returns error if player not found", () => {
      client.manager.players.clear();
      const res = validateMusicContext(client, interaction);
      expect(res.error).toContain("No music");
    });

    it("returns error if member in wrong VC", () => {
      interaction.member.voice.channel.id = "vc-wrong";
      const res = validateMusicContext(client, interaction);
      expect(res.error).toContain("same voice channel");
    });
  });

  describe("validateMusicContextMessage", () => {
    it("returns player when match is successful", () => {
      const res = validateMusicContextMessage(client, message);
      expect(res.player).toBe(player);
    });
  });

  describe("scheduleAutoDelete", () => {
    it("fires deleteReply after delay", async () => {
      scheduleAutoDelete(interaction, 1000);
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(interaction.deleteReply).toHaveBeenCalled();
    });
  });

  describe("formatProgressBar", () => {
    it("returns formatted bar", () => {
      expect(formatProgressBar(50, 100)).toContain("▰");
      expect(formatProgressBar(0, 0)).toBe("▱▱▱▱▱▱▱▱▱▱▱▱▱▱");
    });
  });

  describe("getSourceMeta", () => {
    it("resolves metadata for known platforms", () => {
      const meta = getSourceMeta("youtube");
      expect(meta.label).toBe("YouTube");
    });

    it("resolves default for unknown", () => {
      const meta = getSourceMeta("unknown");
      expect(meta.label).toBe("Unknown");
    });
  });

  describe("buildNowPlayingEmbed", () => {
    it("builds embed builder instance", () => {
      const track = {
        title: "Test Song",
        uri: "https://youtube.com/watch?v=123",
        author: "Singer",
        length: 200000,
        sourceName: "youtube",
      };
      const embed = buildNowPlayingEmbed(client, player, track);
      expect(embed).toBeDefined();
    });
  });

  describe("buildMusicControlRow", () => {
    it("builds ActionRowBuilder", () => {
      const row = buildMusicControlRow({ paused: false, queueLength: 2 });
      expect(row).toBeDefined();
    });
  });

  describe("fetchNowPlayingMessage", () => {
    it("fetches message directly from player data", async () => {
      const msg = await fetchNowPlayingMessage(client, player);
      expect(msg).toBe(player.data.nowPlayingMessage);
    });
  });

  describe("addLyricsToNowPlaying", () => {
    it("attaches lyrics embed to now playing message", async () => {
      const res = await addLyricsToNowPlaying(client, player, {});
      expect(res).toBe(true);
    });
  });

  describe("removeLyricsFromNowPlaying", () => {
    it("removes lyrics embed from now playing message", async () => {
      const res = await removeLyricsFromNowPlaying(client, player);
      expect(res).toBe(true);
    });
  });

  describe("swapNowPlayingComponents", () => {
    it("edits the interaction message components", async () => {
      const res = await swapNowPlayingComponents(interaction, []);
      expect(res).toBe(true);
    });
  });
});
