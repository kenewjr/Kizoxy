const {
  createMockMessage,
  createMockClient,
  createMockPlayer,
} = require("../helpers/mockFactory");

const skipCmd = require("../../src/commands/prefix/music/skip");
const pauseCmd = require("../../src/commands/prefix/music/pause");
const resumeCmd = require("../../src/commands/prefix/music/resume");
const queueCmd = require("../../src/commands/prefix/music/queue");
const removeCmd = require("../../src/commands/prefix/music/remove");
const lyricsCmd = require("../../src/commands/prefix/music/lyrics");

jest.mock("../../src/features/music/musicHelper", () => {
  const actual = jest.requireActual("../../src/features/music/musicHelper");
  return {
    ...actual,
    validateMusicContextMessage: jest.fn(),
  };
});

jest.mock("../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: jest.fn(),
}));

const musicHelper = require("../../src/features/music/musicHelper");
const lyricsService = require("../../src/features/lyrics/lyricsService");

describe("Music Prefix Commands Hardening", () => {
  let client, message, player, voiceChannel;

  beforeEach(() => {
    client = createMockClient();
    player = createMockPlayer();
    voiceChannel = { id: "vc-1", name: "Voice Room" };

    message = createMockMessage();
    message.guild = {
      id: "guild-1",
      iconURL: () => "https://example.com/icon.png",
      members: {
        me: {
          voice: {
            channel: voiceChannel,
          },
        },
      },
    };
    message.member.voice.channel = voiceChannel;
    message.channel = {
      send: jest.fn().mockResolvedValue({
        edit: jest.fn().mockResolvedValue({}),
        createMessageComponentCollector: jest.fn().mockReturnValue({
          on: jest.fn(),
        }),
      }),
    };

    musicHelper.validateMusicContextMessage.mockReturnValue({ player });
  });

  describe("skip.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await skipCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("catches skip throws gracefully", async () => {
      player.skip.mockRejectedValue(new Error("Skip failed"));
      await skipCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith(
        "❌ Failed to skip the track.",
      );
    });
  });

  describe("pause.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await pauseCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("no-ops if already paused", async () => {
      player.paused = true;
      await pauseCmd.run(client, message);
      expect(player.pause).not.toHaveBeenCalled();
      expect(message.reply).toHaveBeenCalledWith(
        "❌ Playback is already paused.",
      );
    });

    it("catches pause throws gracefully", async () => {
      player.paused = false;
      player.pause.mockRejectedValue(new Error("Pause error"));
      await pauseCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("❌ Failed to pause.");
    });
  });

  describe("resume.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await resumeCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("no-ops if not paused", async () => {
      player.paused = false;
      await resumeCmd.run(client, message);
      expect(player.pause).not.toHaveBeenCalled();
      expect(message.channel.send).toHaveBeenCalledWith("▶ Already playing.");
    });

    it("catches resume throws gracefully", async () => {
      player.paused = true;
      player.pause.mockRejectedValue(new Error("Resume error"));
      await resumeCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("❌ Failed to resume.");
    });
  });

  describe("queue.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await queueCmd.run(client, message, []);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("parses page from args and clamps it", async () => {
      player.queue.length = 0;
      for (let i = 0; i < 15; i++) {
        player.queue.push({
          title: `Track ${i + 1}`,
          length: 100000,
          uri: "https://youtube.com",
          requester: "testuser",
        });
      }
      player.queue.durationLength = 1400000;
      await queueCmd.run(client, message, ["5"]); // Request page 5 when only 2 pages exist
      expect(message.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              data: expect.objectContaining({
                footer: expect.objectContaining({
                  text: expect.stringContaining("Page • 2/2"),
                }),
              }),
            }),
          ],
        }),
      );
    });

    it("replies error if nothing is playing", async () => {
      player.queue.current = null;
      await queueCmd.run(client, message, []);
      expect(message.channel.send).toHaveBeenCalledWith(
        "❌ Nothing is playing.",
      );
    });

    it("catches errors and replies user-friendly message", async () => {
      message.channel.send.mockRejectedValueOnce(new Error("Database offline"));
      await expect(queueCmd.run(client, message, [])).rejects.toThrow(
        "Database offline",
      );
    });

    it("interacts with page buttons", async () => {
      player.queue.length = 0;
      for (let i = 0; i < 15; i++) {
        player.queue.push({
          title: `Track ${i + 1}`,
          length: 100000,
          uri: "https://youtube.com",
          requester: "testuser",
        });
      }
      player.queue.durationLength = 1400000;

      let collectCallback;
      const mockCollector = {
        on: jest.fn().mockImplementation((event, cb) => {
          if (event === "collect") collectCallback = cb;
        }),
      };

      let filterFn;
      const editMock = jest.fn().mockResolvedValue({});
      const sentMessageMock = {
        edit: editMock,
        components: [],
        createMessageComponentCollector: jest
          .fn()
          .mockImplementation((opts) => {
            filterFn = opts.filter;
            return mockCollector;
          }),
      };

      message.channel.send.mockResolvedValue(sentMessageMock);

      await queueCmd.run(client, message, []);

      // Verify collector filter
      expect(filterFn).toBeDefined();
      expect(filterFn({ user: { id: message.author.id } })).toBe(true);
      expect(filterFn({ user: { id: "other-user" } })).toBe(false);

      // Trigger button clicks: first, next, last, prev
      const fakeInteraction = {
        user: { id: message.author.id },
        update: jest.fn().mockResolvedValue({}),
        customId: "kqueue:next",
      };

      await collectCallback({ ...fakeInteraction, customId: "kqueue:next" });
      expect(fakeInteraction.update).toHaveBeenCalled();

      await collectCallback({ ...fakeInteraction, customId: "kqueue:last" });
      await collectCallback({ ...fakeInteraction, customId: "kqueue:first" });
      await collectCallback({ ...fakeInteraction, customId: "kqueue:prev" });
    });
  });

  describe("remove.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await removeCmd.run(client, message, []);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("replies error if queue is empty when clearing", async () => {
      player.queue.size = 0;
      await removeCmd.run(client, message, ["clear"]);
      expect(message.channel.send).toHaveBeenCalledWith(
        "❌ The queue is already empty.",
      );
    });

    it("clears the queue successfully", async () => {
      player.queue.size = 2;
      await removeCmd.run(client, message, ["clear"]);
      expect(player.queue.clear).toHaveBeenCalled();
      expect(message.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              data: expect.objectContaining({
                description: expect.stringContaining("Cleared"),
              }),
            }),
          ],
        }),
      );
    });

    it("replies error if position is invalid", async () => {
      await removeCmd.run(client, message, ["invalid"]);
      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "Please specify the position of the song to remove",
        ),
      );
    });

    it("replies error if no arguments are provided", async () => {
      await removeCmd.run(client, message, []);
      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "Please specify the position of the song to remove",
        ),
      );
    });

    it("replies error if position is out of bounds", async () => {
      player.queue.size = 2;
      await removeCmd.run(client, message, ["5"]);
      expect(message.channel.send).toHaveBeenCalledWith(
        expect.stringContaining(
          "❌ Song not found. The queue only has 2 song(s).",
        ),
      );
    });

    it("removes song successfully from queue", async () => {
      player.queue.size = 2;
      player.queue[0] = {
        title: "Song 1",
        length: 1000,
        requester: "test",
        uri: "http",
      };
      player.queue.splice = jest.fn().mockResolvedValue([]);
      await removeCmd.run(client, message, ["1"]);
      expect(player.queue.splice).toHaveBeenCalledWith(0, 1);
      expect(message.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              data: expect.objectContaining({
                description: expect.stringContaining("Removed"),
              }),
            }),
          ],
        }),
      );
    });

    it("catches errors and replies user-friendly message", async () => {
      player.queue.size = 2;
      player.queue[0] = {
        title: "Song 1",
        length: 1000,
        requester: "test",
        uri: "http",
      };
      player.queue.splice = jest.fn().mockImplementation(() => {
        throw new Error("Splice error");
      });
      await removeCmd.run(client, message, ["1"]);
      expect(message.reply).toHaveBeenCalledWith("❌ Failed to remove song.");
    });
  });

  describe("lyrics.js", () => {
    it("handles validate failure", async () => {
      musicHelper.validateMusicContextMessage.mockReturnValue({
        error: "Context error",
      });
      await lyricsCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith("Context error");
    });

    it("replies error if no track is loaded", async () => {
      player.queue.current = null;
      await lyricsCmd.run(client, message);
      expect(message.channel.send).toHaveBeenCalledWith(
        "❌ No track is currently loaded.",
      );
    });

    it("handles lyrics search not found", async () => {
      lyricsService.searchLyrics.mockResolvedValue(null);
      const loadingMock = {
        edit: jest.fn().mockResolvedValue({}),
      };
      message.channel.send.mockResolvedValueOnce(loadingMock);
      await lyricsCmd.run(client, message);
      expect(loadingMock.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Lyrics not found"),
        }),
      );
    });

    it("catches search lyrics exceptions", async () => {
      lyricsService.searchLyrics.mockRejectedValue(new Error("Service error"));
      await lyricsCmd.run(client, message);
      expect(message.reply).toHaveBeenCalledWith(
        "❌ An error occurred while fetching lyrics.",
      );
    });
  });
});
