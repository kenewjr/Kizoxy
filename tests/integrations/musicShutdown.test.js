const indexModulePath = "../../src/index";
let musicSessionStorage;

jest.mock("../../src/persistence/musicSessionStorage");

describe("gracefulShutdown Music Snapshot Tests", () => {
  let client, gracefulShutdown;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    musicSessionStorage = require("../../src/persistence/musicSessionStorage");

    // Import index.js (require.main !== module so it won't start bot)
    const indexModule = require(indexModulePath);
    client = indexModule.client;
    gracefulShutdown = indexModule.gracefulShutdown;

    // Mock client storage objects and their flush methods to prevent actual disk flush
    const mockStorage = { flush: jest.fn().mockResolvedValue(true) };
    client.alarmStorage = mockStorage;
    client.levelStorage = mockStorage;
    client.fixembedStorage = mockStorage;
    client.youtubeStorage = mockStorage;
    client.youtubeStateStorage = mockStorage;
    client.tiktokStorage = mockStorage;
    client.tiktokStateStorage = mockStorage;
    client.commandStorage = mockStorage;
  });

  it("snapshots only active players and handles failures gracefully", async () => {
    const activePlayer = {
      voiceId: "v1",
      textId: "t1",
      position: 12000,
      volume: 100,
      loop: "none",
      queue: Object.assign(
        [{ uri: "q-uri", title: "Q Song", requester: { id: "user2" } }],
        {
          current: {
            uri: "curr-uri",
            title: "Curr Song",
            requester: { id: "user1" },
          },
        },
      ),
    };

    const idlePlayer = {
      queue: { current: null },
    };

    const failingPlayer = {
      voiceId: "v2",
      textId: "t2",
      position: 5000,
      volume: 80,
      loop: "track",
      queue: Object.assign([], {
        current: {
          uri: "fail-uri",
          title: "Fail Song",
          requester: { id: "user3" },
        },
      }),
    };

    client.manager = {
      players: new Map([
        ["guild-active", activePlayer],
        ["guild-idle", idlePlayer],
        ["guild-failing", failingPlayer],
      ]),
    };

    // Make saving fail for the failing player
    musicSessionStorage.saveSession.mockImplementation((guildId) => {
      if (guildId === "guild-failing") {
        throw new Error("Disk Write Failure");
      }
      return Promise.resolve();
    });

    await gracefulShutdown("SIGINT");

    // active player is saved
    expect(musicSessionStorage.saveSession).toHaveBeenCalledWith(
      "guild-active",
      expect.objectContaining({
        guildId: "guild-active",
        voiceChannelId: "v1",
        textChannelId: "t1",
        positionMs: 12000,
        volume: 100,
        loopMode: "none",
        currentTrack: {
          uri: "curr-uri",
          title: "Curr Song",
          requesterId: "user1",
        },
        queue: [{ uri: "q-uri", title: "Q Song", requesterId: "user2" }],
      }),
    );

    // idle player with no active track is not saved
    expect(musicSessionStorage.saveSession).not.toHaveBeenCalledWith(
      "guild-idle",
      expect.any(Object),
    );

    // failing player was attempted
    expect(musicSessionStorage.saveSession).toHaveBeenCalledWith(
      "guild-failing",
      expect.any(Object),
    );
  });
});
