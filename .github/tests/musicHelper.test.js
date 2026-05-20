// Tests for utils/helpers/musicHelper.js
const {
  EPHEMERAL_TTL_MS,
  EPHEMERAL_ERROR_TTL_MS,
  validateMusicContext,
  scheduleAutoDelete,
  buildMusicControlRow,
} = require("../../utils/helpers/musicHelper");

describe("musicHelper", () => {
  describe("constants", () => {
    test("ephemeral TTLs are sensible defaults", () => {
      expect(EPHEMERAL_TTL_MS).toBe(3000);
      expect(EPHEMERAL_ERROR_TTL_MS).toBe(5000);
      expect(EPHEMERAL_ERROR_TTL_MS).toBeGreaterThan(EPHEMERAL_TTL_MS);
    });
  });

  describe("validateMusicContext", () => {
    const baseClient = (player) => ({
      manager: { players: new Map(player ? [["g1", player]] : []) },
    });

    test("returns error when no player is loaded", () => {
      const interaction = { guild: { id: "g1" }, member: {} };
      expect(validateMusicContext(baseClient(null), interaction)).toEqual({
        error: expect.stringContaining("No music"),
      });
    });

    test("returns error when user is not in the same voice channel", () => {
      const player = { voiceId: "vc1" };
      const interaction = {
        guild: { id: "g1" },
        member: { voice: { channel: { id: "vc2" } } },
      };
      expect(validateMusicContext(baseClient(player), interaction)).toEqual({
        error: expect.stringContaining("same voice channel"),
      });
    });

    test("returns { player, voiceChannel } on success", () => {
      const player = { voiceId: "vc1" };
      const channel = { id: "vc1" };
      const interaction = {
        guild: { id: "g1" },
        member: { voice: { channel } },
      };
      const result = validateMusicContext(baseClient(player), interaction);
      expect(result.player).toBe(player);
      expect(result.voiceChannel).toBe(channel);
      expect(result.error).toBeUndefined();
    });

    test("returns error when user has no voice state at all", () => {
      const player = { voiceId: "vc1" };
      const interaction = { guild: { id: "g1" }, member: {} };
      expect(validateMusicContext(baseClient(player), interaction).error).toBe(
        "❌ You must be in the same voice channel as the bot.",
      );
    });
  });

  describe("scheduleAutoDelete", () => {
    jest.useFakeTimers();

    test("calls deleteReply after the default TTL", () => {
      const interaction = { deleteReply: jest.fn().mockResolvedValue() };
      scheduleAutoDelete(interaction);
      jest.advanceTimersByTime(EPHEMERAL_TTL_MS);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });

    test("respects a custom TTL", () => {
      const interaction = { deleteReply: jest.fn().mockResolvedValue() };
      scheduleAutoDelete(interaction, 1234);
      jest.advanceTimersByTime(1233);
      expect(interaction.deleteReply).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(interaction.deleteReply).toHaveBeenCalledTimes(1);
    });

    test("swallows deleteReply rejections without throwing", () => {
      const interaction = {
        deleteReply: jest.fn().mockRejectedValue(new Error("nope")),
      };
      expect(() => {
        scheduleAutoDelete(interaction);
        jest.advanceTimersByTime(EPHEMERAL_TTL_MS);
      }).not.toThrow();
    });
  });

  describe("buildMusicControlRow", () => {
    test("returns 5 buttons", () => {
      const row = buildMusicControlRow();
      expect(row.toJSON().components).toHaveLength(5);
    });

    test("first button shows Pause label by default", () => {
      const row = buildMusicControlRow(false);
      const first = row.toJSON().components[0];
      expect(first.label).toBe("Pause");
      expect(first.custom_id).toBe("music-pause");
    });

    test("first button shows Resume label when isPaused=true", () => {
      const row = buildMusicControlRow(true);
      const first = row.toJSON().components[0];
      expect(first.label).toBe("Resume");
    });

    test("custom IDs match what the button handlers expect", () => {
      const ids = buildMusicControlRow()
        .toJSON()
        .components.map((c) => c.custom_id);
      expect(ids).toEqual([
        "music-pause",
        "music-skip",
        "music-stop",
        "music-lyrics",
        "music-shuffle",
      ]);
    });
  });
});
