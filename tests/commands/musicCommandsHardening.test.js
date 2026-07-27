const {
  createMockInteraction,
  createMockClient,
  createMockPlayer,
} = require("../helpers/mockFactory");

const skipCmd = require("../../src/commands/slash/music/skip");
const pauseCmd = require("../../src/commands/slash/music/pause");
const resumeCmd = require("../../src/commands/slash/music/resume");
const queueCmd = require("../../src/commands/slash/music/queue");
const removeCmd = require("../../src/commands/slash/music/remove");
const lyricsCmd = require("../../src/commands/slash/music/lyrics");

jest.mock("../../src/features/music/musicHelper", () => {
  const actual = jest.requireActual("../../src/features/music/musicHelper");
  return {
    ...actual,
    scheduleAutoDelete: jest.fn(),
    addLyricsToNowPlaying: jest.fn().mockResolvedValue(true),
    removeLyricsFromNowPlaying: jest.fn().mockResolvedValue(true),
    swapNowPlayingComponents: jest.fn().mockResolvedValue(true),
  };
});

jest.mock("../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: jest.fn(),
  validatePlayerForLyrics: jest.fn(),
}));

const lyricsService = require("../../src/features/lyrics/lyricsService");

describe("Music Slash Commands Hardening", () => {
  let client, interaction, player, voiceChannel;

  beforeEach(() => {
    jest.useFakeTimers();
    client = createMockClient();
    player = createMockPlayer();
    voiceChannel = { id: "vc-1", name: "Voice Room" };

    client.manager = {
      players: new Map([["guild-1", player]]),
    };

    interaction = createMockInteraction();
    interaction.guild = {
      id: "guild-1",
      name: "Guild 1",
      iconURL: jest.fn().mockReturnValue("https://example.com/icon.png"),
      members: {
        me: {
          voice: {
            channel: voiceChannel,
          },
        },
      },
    };
    interaction.member.voice.channel = voiceChannel;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("skip.js", () => {
    it("returns error if no player exists", async () => {
      client.manager.players.clear();
      await skipCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "No playing in this guild!" }),
      );
    });

    it("returns error if member not in bot voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-different" };
      await skipCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "I'm not in the same voice channel as you!",
        }),
      );
    });

    it("fails if skip position is out of queue range", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(5);
      await skipCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining(
            "You can't skip to a song that doesn't exist!",
          ),
        }),
      );
    });

    it("skips to position 1", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(1);
      await skipCmd.run(client, interaction);
      expect(player.skip).toHaveBeenCalled();
    });

    it("skips and splices queue for position > 1", async () => {
      jest.spyOn(player.queue, "splice");
      player.queue.size = 5;
      player.queue[1] = { title: "Song 2", uri: "uri" };
      player.queue[2] = { title: "Song 3", uri: "uri" };
      interaction.options.getInteger = jest.fn().mockReturnValue(3);
      await skipCmd.run(client, interaction);
      expect(player.queue.splice).toHaveBeenCalledWith(0, 2);
      expect(player.skip).toHaveBeenCalled();
    });

    it("catches skip failure gracefully", async () => {
      player.skip.mockRejectedValue(new Error("Skip failed"));
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await skipCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Failed to skip the track." }),
      );
    });

    it("catches skip failure and follows up if already deferred", async () => {
      interaction.deferred = true;
      player.skip.mockRejectedValue(new Error("Skip failed"));
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await skipCmd.run(client, interaction);
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Failed to skip the track." }),
      );
    });

    it("deletes ephemeral reply on timeout", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await skipCmd.run(client, interaction);
      expect(interaction.deleteReply).not.toHaveBeenCalled();
      jest.advanceTimersByTime(3000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });

    it("handles deleteReply error gracefully", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      interaction.deleteReply.mockRejectedValueOnce(new Error("Delete failed"));
      await skipCmd.run(client, interaction);
      jest.advanceTimersByTime(3000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1); // should not crash
    });

    it("deletes ephemeral reply on out-of-range timeout", async () => {
      interaction.options.getInteger = jest.fn().mockReturnValue(5);
      await skipCmd.run(client, interaction);
      jest.advanceTimersByTime(3000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });
  });

  describe("pause.js", () => {
    it("fails when no player exists", async () => {
      client.manager.players.clear();
      await pauseCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "No playing in this guild!" }),
      );
    });

    it("returns error if member not in bot voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-different" };
      await pauseCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "I'm not in the same voice channel as you!",
        }),
      );
    });

    it("no-ops if already paused", async () => {
      player.paused = true;
      await pauseCmd.run(client, interaction);
      expect(player.pause).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Playback is already paused." }),
      );
    });

    it("pauses and catches error if pause throws", async () => {
      player.paused = false;
      player.pause.mockRejectedValue(new Error("Pause failed"));
      await pauseCmd.run(client, interaction);
      expect(player.pause).toHaveBeenCalledWith(true);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Failed to pause playback." }),
      );
    });

    it("deletes ephemeral reply on timeout", async () => {
      player.paused = false;
      await pauseCmd.run(client, interaction);
      expect(interaction.deleteReply).not.toHaveBeenCalled();
      jest.advanceTimersByTime(5000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });

    it("handles deleteReply error gracefully", async () => {
      player.paused = false;
      interaction.deleteReply.mockRejectedValueOnce(new Error("Delete failed"));
      await pauseCmd.run(client, interaction);
      jest.advanceTimersByTime(5000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });
  });

  describe("resume.js", () => {
    it("fails when no player exists", async () => {
      client.manager.players.clear();
      await resumeCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "No playing in this guild!" }),
      );
    });

    it("returns error if member not in bot voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-different" };
      await resumeCmd.run(client, interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "I'm not in the same voice channel as you!",
        }),
      );
    });

    it("no-ops if already playing", async () => {
      player.paused = false;
      await resumeCmd.run(client, interaction);
      expect(player.pause).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Playback is already playing." }),
      );
    });

    it("resumes and catches error if resume throws", async () => {
      player.paused = true;
      player.pause.mockRejectedValue(new Error("Resume failed"));
      await resumeCmd.run(client, interaction);
      expect(player.pause).toHaveBeenCalledWith(false);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ Failed to resume playback." }),
      );
    });

    it("deletes ephemeral reply on timeout", async () => {
      player.paused = true;
      await resumeCmd.run(client, interaction);
      expect(interaction.deleteReply).not.toHaveBeenCalled();
      jest.advanceTimersByTime(5000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });

    it("handles deleteReply error gracefully", async () => {
      player.paused = true;
      interaction.deleteReply.mockRejectedValueOnce(new Error("Delete failed"));
      await resumeCmd.run(client, interaction);
      jest.advanceTimersByTime(5000);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });
  });

  describe("queue.js", () => {
    it("returns error if nothing playing", async () => {
      player.queue.current = null;
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        "❌ Nothing is currently playing.",
      );
    });

    it("returns error if no player exists", async () => {
      client.manager.players.clear();
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        "No playing in this guild!",
      );
    });

    it("returns error if member not in same voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-different" };
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        "I'm not in the same voice channel as you!",
      );
    });

    it("shows queue thumbnail if present", async () => {
      player.queue.current = {
        title: "Track",
        length: 1000,
        requester: "test",
        thumbnail: "https://example.com/thumb.png",
      };
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("clamps requested page beyond limit", async () => {
      player.queue.length = 0;
      for (let i = 0; i < 15; i++) {
        player.queue.push({
          title: `Track ${i + 1}`,
          length: 100000,
          uri: "https://youtube.com",
          requester: "testuser",
        });
      }
      interaction.options.getInteger = jest.fn().mockReturnValue(5); // Request page 5 when only 2 pages exist
      await queueCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
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
  });

  describe("remove.js", () => {
    it("returns error if no player exists", async () => {
      client.manager.players.clear();
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "❌ No music is currently playing.",
        }),
      );
    });

    it("returns error if member not in same voice channel", async () => {
      interaction.member.voice.channel = { id: "vc-different" };
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "❌ You must be in the same voice channel as the bot.",
        }),
      );
    });

    it("returns error if position is not specified", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(null);
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "❌ Please specify the position of the song to remove.",
        }),
      );
    });

    it("returns error if position is out of queue range", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(999);
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("❌ Song not found."),
        }),
      );
    });

    it("successfully removes track from queue", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("remove");
      interaction.options.getInteger = jest.fn().mockReturnValue(1);
      jest.spyOn(player.queue, "splice");
      await removeCmd.run(client, interaction);
      expect(player.queue.splice).toHaveBeenCalledWith(0, 1);
      expect(interaction.editReply).toHaveBeenCalledWith(
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

    it("returns error if trying to clear an empty queue", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("clear");
      player.queue.size = 0;
      player.queue.length = 0;
      await removeCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "❌ The queue is already empty." }),
      );
    });
  });

  describe("lyrics.js", () => {
    it("aborts if validatePlayerForLyrics fails", async () => {
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        error: "No player",
      });
      await lyricsCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "No player" }),
      );
    });

    it("handles lyrics search not found", async () => {
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Test" },
      });
      lyricsService.searchLyrics.mockResolvedValue(null);
      player.lyricsEnabled = false; // Toggles to true
      await lyricsCmd.run(client, interaction);
      expect(player.lyricsEnabled).toBe(false);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "⚠️ Lyrics not found for **Test**.",
        }),
      );
    });

    it("logs warning when addLyricsToNowPlaying returns false", async () => {
      const musicHelper = require("../../src/features/music/musicHelper");
      musicHelper.addLyricsToNowPlaying.mockResolvedValueOnce(false);
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Test" },
      });
      lyricsService.searchLyrics.mockResolvedValue({ title: "Lyrics Embed" });
      player.lyricsEnabled = false;
      await lyricsCmd.run(client, interaction);
      // triggers line 63 warning logger
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "✅ Lyrics shown." }),
      );
    });

    it("deactivates and hides lyrics", async () => {
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Test" },
      });
      player.lyricsEnabled = true; // Toggles to false
      await lyricsCmd.run(client, interaction);
      expect(player.lyricsEnabled).toBe(false);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "✅ Lyrics hidden." }),
      );
    });

    it("handles lyrics search throws error", async () => {
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: { title: "Test" },
      });
      lyricsService.searchLyrics.mockRejectedValue(new Error("Network Error"));
      player.lyricsEnabled = false; // Toggles to true
      await lyricsCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "❌ An error occurred while fetching lyrics.",
        }),
      );
    });
  });
});
