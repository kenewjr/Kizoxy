const loadMusicResume = require("../../src/loaders/loadMusicResume");
const musicSessionStorage = require("../../src/persistence/musicSessionStorage");
const {
  createMockClient,
  createMockGuild,
  createMockTextChannel,
  createMockVoiceChannel,
} = require("../helpers/mockFactory");

jest.mock("../../src/persistence/musicSessionStorage");

describe("loadMusicResume Loader Tests", () => {
  let client, mockPlayer;

  beforeEach(() => {
    jest.clearAllMocks();

    musicSessionStorage.deleteSession.mockResolvedValue(undefined);
    musicSessionStorage.saveSession.mockResolvedValue(undefined);
    musicSessionStorage.getAllSessions.mockResolvedValue([]);

    mockPlayer = {
      guildId: "123",
      playing: false,
      paused: false,
      volume: 100,
      loop: "none",
      queue: Object.assign([], {
        current: null,
        add: jest.fn(function (track) {
          this.push(track);
          if (!this.current) this.current = track;
        }),
      }),
      setVolume: jest.fn().mockImplementation(function (vol) {
        this.volume = vol;
      }),
      setLoop: jest.fn().mockImplementation(function (loop) {
        this.loop = loop;
      }),
      play: jest.fn().mockResolvedValue(true),
      seek: jest.fn().mockResolvedValue(true),
      destroy: jest.fn().mockResolvedValue(true),
    };

    client = createMockClient();
    client.manager = {
      createPlayer: jest.fn().mockResolvedValue(mockPlayer),
      search: jest.fn().mockImplementation(async (query) => {
        if (query === "fail-url") return { tracks: [] };
        return {
          tracks: [
            {
              title: `Mock: ${query}`,
              uri: query,
              requester: { id: "requester-id" },
            },
          ],
        };
      }),
      players: new Map(),
      off: jest.fn(),
      on: jest.fn(),
    };
  });

  it("restores valid session when guild and channels exist", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
      currentTrack: {
        uri: "current-url",
        title: "Current Title",
        requesterId: "u1",
      },
      positionMs: 3000,
      queue: [{ uri: "queue-url", title: "Queue Title", requesterId: "u1" }],
      volume: 80,
      loopMode: "queue",
      savedAt: Date.now(),
    };

    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1", shardId: 1 });
    const voiceChannel = createMockVoiceChannel({ id: "v1" });
    const textChannel = createMockTextChannel({ id: "t1" });

    guild.channels.cache.set("v1", voiceChannel);
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    await loadMusicResume(client);

    expect(client.manager.createPlayer).toHaveBeenCalledWith({
      guildId: "g1",
      textId: "t1",
      voiceId: "v1",
      shardId: 1,
    });

    expect(mockPlayer.queue.add).toHaveBeenCalledTimes(2);
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(80);
    expect(mockPlayer.setLoop).toHaveBeenCalledWith("queue");
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(textChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Resumed"),
      }),
    );
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("skips and deletes session if guild does not exist", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
    };
    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    await loadMusicResume(client);

    expect(client.manager.createPlayer).not.toHaveBeenCalled();
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("skips and deletes session if voice channel does not exist", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
    };
    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1" });
    const textChannel = createMockTextChannel({ id: "t1" });
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    await loadMusicResume(client);

    expect(client.manager.createPlayer).not.toHaveBeenCalled();
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("skips track and continues when queue track fails resolution", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
      currentTrack: {
        uri: "current-url",
        title: "Current Title",
        requesterId: "u1",
      },
      queue: [{ uri: "fail-url", title: "Failed Track", requesterId: "u1" }],
      savedAt: Date.now(),
    };

    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1" });
    const voiceChannel = createMockVoiceChannel({ id: "v1" });
    const textChannel = createMockTextChannel({ id: "t1" });
    guild.channels.cache.set("v1", voiceChannel);
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    await loadMusicResume(client);

    expect(mockPlayer.queue.add).toHaveBeenCalledTimes(1); // Only current resolved
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("falls through to next track if current track fails to resolve", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
      currentTrack: {
        uri: "fail-url",
        title: "Failed Current Track",
        requesterId: "u1",
      },
      queue: [{ uri: "queue-url", title: "Queue Track", requesterId: "u1" }],
      savedAt: Date.now(),
    };

    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1" });
    const voiceChannel = createMockVoiceChannel({ id: "v1" });
    const textChannel = createMockTextChannel({ id: "t1" });
    guild.channels.cache.set("v1", voiceChannel);
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    await loadMusicResume(client);

    expect(mockPlayer.queue.add).toHaveBeenCalledTimes(1); // Only queue resolved
    expect(mockPlayer.queue.current.uri).toBe("queue-url");
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("aborts and deletes session if no tracks resolved at all", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
      currentTrack: {
        uri: "fail-url",
        title: "Failed Current Track",
        requesterId: "u1",
      },
      queue: [],
      savedAt: Date.now(),
    };

    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1" });
    const voiceChannel = createMockVoiceChannel({ id: "v1" });
    const textChannel = createMockTextChannel({ id: "t1" });
    guild.channels.cache.set("v1", voiceChannel);
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    await loadMusicResume(client);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.destroy).toHaveBeenCalled();
    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("handles createPlayer throwing permissions error gracefully", async () => {
    const session = {
      guildId: "g1",
      voiceChannelId: "v1",
      textChannelId: "t1",
      currentTrack: {
        uri: "current-url",
        title: "Current Title",
        requesterId: "u1",
      },
      queue: [],
      savedAt: Date.now(),
    };

    musicSessionStorage.getAllSessions.mockResolvedValue([session]);

    const guild = createMockGuild({ id: "g1" });
    const voiceChannel = createMockVoiceChannel({ id: "v1" });
    const textChannel = createMockTextChannel({ id: "t1" });
    guild.channels.cache.set("v1", voiceChannel);
    guild.channels.cache.set("t1", textChannel);
    client.guilds.cache.set("g1", guild);

    client.manager.createPlayer.mockRejectedValue(
      new Error("Permissions Denied"),
    );

    await loadMusicResume(client);

    expect(musicSessionStorage.deleteSession).toHaveBeenCalledWith("g1");
  });

  it("handles getAllSessions throwing database error gracefully", async () => {
    musicSessionStorage.getAllSessions.mockRejectedValue(
      new Error("DB Connection Error"),
    );
    await expect(loadMusicResume(client)).resolves.not.toThrow();
  });
});
