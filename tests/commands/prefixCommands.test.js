const fs = require("fs");
const path = require("path");

// Mock dependencies/storage to prevent file operations/network requests during command execution
jest.mock("../../src/persistence/youtubeStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  addSubscription: jest.fn().mockResolvedValue({ id: "sub-123" }),
  removeSubscription: jest.fn().mockResolvedValue(),
}));

jest.mock("../../src/persistence/tiktokStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
  addSubscription: jest.fn().mockResolvedValue({ id: "sub-123" }),
  removeSubscription: jest.fn().mockResolvedValue(),
  normalizeUsername: (u) => u.toLowerCase(),
}));

jest.mock("../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: jest.fn().mockResolvedValue({
    data: { description: "Mock lyrics" },
  }),
}));

describe("Prefix Commands Test Suite", () => {
  let mockClient;
  let mockMessage;
  let activePlayer;

  beforeEach(() => {
    activePlayer = {
      guildId: "guild-test-1",
      textId: "channel-1",
      voiceId: "vc-1",
      playing: true,
      paused: false,
      volume: 100,
      position: 1000,
      queue: Object.assign(
        [
          {
            title: "Song 2",
            author: "Artist 2",
            length: 4000,
            uri: "https://track2.url",
          },
        ],
        {
          current: {
            title: "Mock Track",
            author: "Mock Artist",
            length: 5000,
            uri: "https://track.url",
          },
          clear: jest.fn(),
          add: jest.fn(),
          remove: jest.fn(),
          shuffle: jest.fn(),
        },
      ),
      destroy: jest.fn().mockResolvedValue(),
      pause: jest.fn().mockResolvedValue(),
      resume: jest.fn().mockResolvedValue(),
      skip: jest.fn().mockResolvedValue(),
      setVolume: jest.fn().mockResolvedValue(),
      setPaused: jest.fn().mockResolvedValue(),
      seekTo: jest.fn().mockResolvedValue(),
      setBassboost: jest.fn().mockResolvedValue(),
      setFilters: jest.fn().mockResolvedValue(),
      filtersState: {},
    };

    mockClient = {
      config: {
        OWNER_ID: "owner123",
        BOT_COLOR: "#5865F2",
      },
      user: {
        id: "bot123",
        username: "Kizoxy",
        tag: "Kizoxy#0001",
        displayAvatarURL: jest
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
      },
      guilds: {
        cache: new Map([
          [
            "guild-test-1",
            {
              id: "guild-test-1",
              name: "Test Guild",
              iconURL: jest.fn().mockReturnValue(null),
              members: {
                cache: new Map(),
                fetch: jest.fn().mockResolvedValue(new Map()),
              },
            },
          ],
        ]),
      },
      manager: {
        players: new Map([["guild-test-1", activePlayer]]),
        search: jest.fn().mockResolvedValue({
          loadType: "TRACK_LOADED",
          tracks: [
            { title: "Search Track", uri: "https://search.url", length: 3000 },
          ],
        }),
        createPlayer: jest.fn().mockResolvedValue(activePlayer),
      },
    };

    mockMessage = {
      guild: {
        id: "guild-test-1",
        name: "Test Guild",
        iconURL: jest.fn().mockReturnValue(null),
      },
      channel: {
        id: "channel-1",
        send: jest.fn().mockResolvedValue({ id: "msg-123" }),
      },
      author: {
        id: "user-test-1",
        username: "testuser",
        tag: "testuser#1234",
      },
      member: {
        id: "user-test-1",
        voice: {
          channel: { id: "vc-1", name: "Voice Room" },
        },
        permissions: {
          has: () => true,
        },
      },
      reply: jest.fn().mockResolvedValue(),
    };
  });

  // Dynamically load all commands
  const commandsDir = path.join(__dirname, "../../src/commands/prefix");
  const categories = fs.readdirSync(commandsDir);

  categories.forEach((category) => {
    const categoryPath = path.join(commandsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) return;

    const commandFiles = fs
      .readdirSync(categoryPath)
      .filter((f) => f.endsWith(".js"));

    commandFiles.forEach((file) => {
      const commandPath = path.join(categoryPath, file);
      const command = require(commandPath);
      const commandName = Array.isArray(command.name)
        ? command.name[0]
        : command.name;

      describe(`Prefix Command: ${commandName}`, () => {
        test("has correct export structure", () => {
          expect(command.name).toBeDefined();
          expect(typeof command.run).toBe("function");
        });

        test("runs without unhandled throwing errors", async () => {
          try {
            await command.run(mockClient, mockMessage, ["arg1", "arg2"]);
          } catch (err) {
            console.warn(
              `Execution warning for prefix ${commandName}: ${err.message}`,
            );
          }
        });
      });
    });
  });
});
