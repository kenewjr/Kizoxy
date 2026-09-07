const { createMockButtonInteraction } = require("../../helpers/mockFactory");

jest.mock("../../../src/features/lyrics/lyricsService", () => ({
  searchLyricsForNowPlaying: jest.fn(),
  validatePlayerForLyrics: jest.fn(),
}));

jest.mock("../../../src/features/music/musicHelper", () => ({
  scheduleAutoDelete: jest.fn(),
  EPHEMERAL_ERROR_TTL_MS: 5000,
  buildNowPlayingComponents: jest.fn().mockReturnValue(["controls", "mode"]),
}));

const lyricsService = require("../../../src/features/lyrics/lyricsService");
const musicHelper = require("../../../src/features/music/musicHelper");
const handler = require("../../../src/interactions/buttons/lyrics");

describe("Now Playing lyrics button", () => {
  let interaction, client, player, track, nowPlayingMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    interaction = createMockButtonInteraction("music-lyrics");
    interaction.deferred = true;
    interaction.guild = { id: "guild-1" };
    interaction.member.voice.channel = { id: "voice-1" };
    interaction.message.id = "now-playing-1";

    track = { title: "Song" };
    nowPlayingMessage = {
      id: "now-playing-1",
      edit: jest.fn().mockResolvedValue({}),
    };
    player = {
      voiceId: "voice-1",
      lyricsEnabled: false,
      queue: { current: track, size: 0 },
      data: {
        nowPlayingMessage,
        nowPlayingEmbed: { title: "Now Playing" },
        lyricsEmbed: null,
        lyricsState: null,
      },
    };
    client = { manager: { players: new Map([["guild-1", player]]) } };
    lyricsService.validatePlayerForLyrics.mockReturnValue({ player, track });
  });

  test("shows Romaji and mode controls after Lyrics is enabled", async () => {
    const lyricsEmbed = { title: "Romaji" };
    lyricsService.searchLyricsForNowPlaying.mockResolvedValue({
      cacheKey: "track-key",
      canRomanize: true,
      embed: lyricsEmbed,
    });

    await handler.execute(interaction, client);

    expect(player.lyricsEnabled).toBe(true);
    expect(player.data.lyricsState).toEqual({
      cacheKey: "track-key",
      canRomanize: true,
      mode: "romaji",
    });
    expect(nowPlayingMessage.edit).toHaveBeenCalledWith({
      embeds: [player.data.nowPlayingEmbed, lyricsEmbed],
      components: ["controls", "mode"],
    });
  });

  test("hides lyrics and removes mode state", async () => {
    player.lyricsEnabled = true;
    player.data.lyricsState = {
      cacheKey: "track-key",
      canRomanize: true,
      mode: "original",
    };
    player.data.lyricsEmbed = { title: "Original" };
    musicHelper.buildNowPlayingComponents.mockReturnValue(["controls"]);

    await handler.execute(interaction, client);

    expect(player.lyricsEnabled).toBe(false);
    expect(player.data.lyricsState).toBeNull();
    expect(player.data.lyricsEmbed).toBeNull();
    expect(nowPlayingMessage.edit).toHaveBeenCalledWith({
      embeds: [player.data.nowPlayingEmbed],
      components: ["controls"],
    });
  });

  test("rejects controls from an old Now Playing message", async () => {
    player.data.nowPlayingMessage.id = "new-message";

    await handler.execute(interaction, client);

    expect(player.lyricsEnabled).toBe(false);
    expect(lyricsService.searchLyricsForNowPlaying).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "⚠️ This Now Playing message is no longer active.",
    });
  });

  test("ignores a fetch result after the track changes", async () => {
    let finishFetch;
    lyricsService.searchLyricsForNowPlaying.mockReturnValue(
      new Promise((resolve) => {
        finishFetch = resolve;
      }),
    );

    const running = handler.execute(interaction, client);
    player.queue.current = { title: "Next Song" };
    finishFetch({
      cacheKey: "old-key",
      canRomanize: true,
      embed: { title: "Old Lyrics" },
    });
    await running;

    expect(nowPlayingMessage.edit).not.toHaveBeenCalled();
    expect(player.data.lyricsState).toBeNull();
  });
});
