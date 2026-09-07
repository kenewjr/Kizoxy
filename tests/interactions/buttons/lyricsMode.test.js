const { createMockButtonInteraction } = require("../../helpers/mockFactory");

jest.mock("../../../src/features/lyrics/lyricsService", () => ({
  getCachedLyricsEmbed: jest.fn(),
  validatePlayerForLyrics: jest.fn(),
}));

const lyricsService = require("../../../src/features/lyrics/lyricsService");
const handler = require("../../../src/interactions/buttons/lyricsMode");

describe("lyrics mode button", () => {
  const ownerId = "777777777777777777";
  const cacheKey = "a".repeat(40);
  let interaction;

  beforeEach(() => {
    interaction = createMockButtonInteraction(
      `lyrics-mode:cmd:original:${ownerId}:${cacheKey}`,
    );
    interaction.deferred = true;
    interaction.user.id = ownerId;
    interaction.editReply = jest.fn().mockResolvedValue({});
  });

  test("switches message to original and exposes Romaji action", async () => {
    const embed = { title: "Original lyrics" };
    lyricsService.getCachedLyricsEmbed.mockReturnValue(embed);

    await handler.execute(interaction, {});

    expect(lyricsService.getCachedLyricsEmbed).toHaveBeenCalledWith(
      {},
      cacheKey,
      "original",
    );
    const payload = interaction.message.edit.mock.calls[0][0];
    expect(payload.embeds).toEqual([embed]);
    expect(payload.components[0].toJSON().components[0].label).toBe("Romaji");
  });

  test("switches back to Romaji", async () => {
    interaction.customId = `lyrics-mode:cmd:romaji:${ownerId}:${cacheKey}`;
    lyricsService.getCachedLyricsEmbed.mockReturnValue({ title: "Romaji lyrics" });

    await handler.execute(interaction, {});

    const row = interaction.message.edit.mock.calls[0][0].components[0].toJSON();
    expect(row.components[0].label).toBe("Original");
  });

  test("rejects another user without editing message", async () => {
    interaction.user.id = "another-user";

    await handler.execute(interaction, {});

    expect(interaction.message.edit).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("requester") }),
    );
  });

  test("rejects invalid or expired controls", async () => {
    interaction.customId = "lyrics-mode:invalid";
    await handler.execute(interaction, {});
    expect(interaction.message.edit).not.toHaveBeenCalled();

    interaction.customId = `lyrics-mode:cmd:original:${ownerId}:${cacheKey}`;
    lyricsService.getCachedLyricsEmbed.mockReturnValue(null);
    await handler.execute(interaction, {});
    expect(interaction.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.stringContaining("expired") }),
    );
  });
  test("reports message edit failures", async () => {
    lyricsService.getCachedLyricsEmbed.mockReturnValue({ title: "Lyrics" });
    interaction.message.edit.mockRejectedValue(new Error("Missing access"));

    await handler.execute(interaction, {});

    expect(interaction.editReply).toHaveBeenLastCalledWith({
      content: "❌ Failed to change lyrics mode.",
    });
  });

  describe("Now Playing scope", () => {
    let client, player;

    beforeEach(() => {
      interaction.customId = `lyrics-mode:np:original:${cacheKey}`;
      interaction.guild = { id: "guild-1" };
      interaction.member.voice.channel = { id: "voice-1" };
      interaction.message.id = "now-playing-1";
      player = {
        voiceId: "voice-1",
        lyricsEnabled: true,
        paused: false,
        queue: { current: { title: "Song" }, size: 0 },
        data: {
          nowPlayingMessage: { id: "now-playing-1" },
          nowPlayingEmbed: { title: "Now Playing" },
          lyricsEmbed: { title: "Romaji" },
          lyricsState: {
            cacheKey,
            canRomanize: true,
            mode: "romaji",
          },
        },
      };
      client = { manager: { players: new Map([["guild-1", player]]) } };
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        player,
        track: player.queue.current,
      });
    });

    test("switches the active Now Playing lyrics and preserves both embeds", async () => {
      const originalEmbed = { title: "Original" };
      lyricsService.getCachedLyricsEmbed.mockReturnValue(originalEmbed);

      await handler.execute(interaction, client);

      expect(player.data.lyricsState.mode).toBe("original");
      expect(player.data.lyricsEmbed).toBe(originalEmbed);
      const payload = interaction.message.edit.mock.calls[0][0];
      expect(payload.embeds).toEqual([player.data.nowPlayingEmbed, originalEmbed]);
      expect(payload.components).toHaveLength(2);
      expect(payload.components[1].toJSON().components[0]).toMatchObject({
        custom_id: `lyrics-mode:np:romaji:${cacheKey}`,
        label: "Romaji",
      });
    });

    test("returns voice validation error", async () => {
      lyricsService.validatePlayerForLyrics.mockReturnValue({
        error: "❌ You must be in the same voice channel as the bot.",
      });

      await handler.execute(interaction, client);

      expect(interaction.message.edit).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "❌ You must be in the same voice channel as the bot.",
      });
    });

    test.each([
      ["lyrics disabled", (current) => (current.lyricsEnabled = false)],
      [
        "old message",
        (current) => (current.data.nowPlayingMessage.id = "new-message"),
      ],
      [
        "stale cache key",
        (current) => (current.data.lyricsState.cacheKey = "new-key"),
      ],
    ])("rejects %s controls", async (_name, mutate) => {
      mutate(player);

      await handler.execute(interaction, client);

      expect(interaction.message.edit).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "⚠️ This lyrics control is no longer active.",
      });
    });
  });
});
