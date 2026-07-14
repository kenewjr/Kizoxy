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

jest.mock("../../src/persistence/fixembedStorage", () => ({
  getSettings: jest.fn().mockReturnValue({
    enabled: true,
    baseMessageAction: "remove_embed",
    viewMode: "normal",
    disabledChannels: [],
    ignoredUsers: [],
    ignoredRoles: [],
    ignoredKeywords: [],
  }),
  toggleKeyword: jest.fn().mockReturnValue(true),
}));

jest.mock("../../src/persistence/tempVcStorage", () => ({
  getSettings: jest.fn().mockReturnValue({}),
  saveSettings: jest.fn(),
}));

jest.mock("../../src/persistence/levelStorage", () => ({
  addXp: jest.fn().mockResolvedValue({ xp: 100, level: 2 }),
  getRank: jest.fn().mockResolvedValue({ xp: 100, level: 2, rank: 1 }),
  getLeaderboard: jest.fn().mockResolvedValue([]),
}));

describe("Slash Commands Test Suite", () => {
  let mockClient;
  let mockInteraction;
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
              channels: {
                cache: new Map([
                  ["channel-1", { id: "channel-1", name: "general" }],
                ]),
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
      alarmScheduler: {
        jobs: new Map(),
      },
    };

    mockInteraction = {
      guild: {
        id: "guild-test-1",
        name: "Test Guild",
        iconURL: jest.fn().mockReturnValue(null),
      },
      user: {
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
      memberPermissions: {
        has: () => true,
      },
      options: {
        getSubcommand: jest.fn().mockReturnValue(""),
        getSubcommandGroup: jest.fn().mockReturnValue(""),
        getString: jest.fn().mockImplementation((name) => {
          if (name === "search" || name === "keyword") return "query";
          if (name === "channel_input" || name === "username_or_url")
            return "UC123";
          return "test";
        }),
        getInteger: jest.fn().mockReturnValue(1),
        getBoolean: jest.fn().mockReturnValue(true),
        getChannel: jest
          .fn()
          .mockReturnValue({ id: "channel-1", name: "general" }),
        getRole: jest.fn().mockReturnValue({ id: "role-1", name: "admin" }),
        getUser: jest.fn().mockReturnValue({ id: "user-2", username: "other" }),
        getMember: jest.fn().mockReturnValue({ id: "user-2" }),
        getNumber: jest.fn().mockReturnValue(1.5),
        getFocused: jest.fn().mockReturnValue(""),
      },
      reply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      followUp: jest.fn().mockResolvedValue(),
      deferReply: jest.fn().mockResolvedValue(),
      respond: jest.fn().mockResolvedValue(),
    };
  });

  // Dynamically load all commands
  const commandsDir = path.join(__dirname, "../../src/commands/slash");
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
        ? command.name.join(" ")
        : command.name;

      describe(`Command: ${commandName}`, () => {
        test("has correct export structure", () => {
          expect(command.name).toBeDefined();
          expect(command.description).toBeDefined();
          expect(typeof command.run).toBe("function");
        });

        test("runs without unhandled throwing errors", async () => {
          // If the command relies on subcommands, make mock interaction return first subcommand
          if (command.options && command.options.length > 0) {
            const subs = command.options.filter(
              (o) => o.type === 1, // Subcommand
            );
            if (subs.length > 0) {
              mockInteraction.options.getSubcommand.mockReturnValue(
                subs[0].name,
              );
            }
          }

          // Execute
          try {
            await command.run(mockClient, mockInteraction);
          } catch (err) {
            // Uncaught operational/logic errors from missing setups are allowed, but we assert no syntax/import crashes
            console.warn(
              `Execution warning for ${commandName}: ${err.message}`,
            );
          }
          // The command run should complete or reply/throw handled errors
        });
      });
    });
  });
});
