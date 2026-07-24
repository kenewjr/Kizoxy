const { createMockClient } = require("../helpers/mockFactory");

// Mock dependencies/storage
jest.mock("../../src/persistence/youtubeStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../src/persistence/tiktokStorage", () => ({
  listSubscriptions: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../src/features/lyrics/lyricsService", () => ({
  searchLyrics: jest.fn().mockResolvedValue({
    data: { description: "Mock lyrics" },
  }),
}));

describe("Prefix Music Commands Extended Tests", () => {
  let client;
  let player;
  let message;
  let voiceChannel;

  beforeEach(() => {
    client = createMockClient();

    player = {
      guildId: "guild-1",
      voiceId: "vc-1",
      playing: true,
      paused: false,
      loop: "none",
      volume: 100,
      position: 30000,
      filters: {},
      state: "CONNECTED",
      queue: Object.assign(
        [
          {
            title: "Song 2",
            author: "Artist 2",
            uri: "uri-2",
            length: 120000,
            requester: "user#1234",
          },
        ],
        {
          current: {
            title: "Song 1",
            author: "Artist 1",
            uri: "uri-1",
            length: 120000,
            requester: { id: "123", username: "user" },
          },
          size: 1,
          totalSize: 2,
          durationLength: 120000,
          clear: jest.fn(),
          add: jest.fn(),
          remove: jest.fn(),
          shuffle: jest.fn(),
        },
      ),
      data: new Map(),
      connect: jest.fn(),
      destroy: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      skip: jest.fn(),
      setVolume: jest.fn(),
      setPaused: jest.fn(),
      seekTo: jest.fn(),
      seek: jest.fn(),
      setLoop: jest.fn(),
      setFilters: jest.fn(),
      play: jest.fn(),
    };

    jest.spyOn(player.queue, "splice");

    client.manager = {
      players: {
        get: jest.fn().mockReturnValue(player),
      },
      createPlayer: jest.fn().mockResolvedValue(player),
      search: jest.fn().mockResolvedValue({
        tracks: [{ title: "Lofi Stream", uri: "uri", length: 999999 }],
      }),
    };

    voiceChannel = {
      id: "vc-1",
      name: "Voice Channel",
      permissionsFor: jest.fn().mockReturnValue({
        has: () => true,
      }),
    };

    message = {
      guild: {
        id: "guild-1",
        iconURL: jest.fn().mockReturnValue(null),
        members: {
          me: {
            voice: { channelId: null },
          },
        },
      },
      channel: {
        id: "chan-1",
        send: jest.fn().mockResolvedValue({
          id: "msg-123",
          edit: jest.fn().mockResolvedValue({}),
        }),
      },
      author: { id: "user-1", tag: "user#1234" },
      member: {
        voice: { channel: voiceChannel },
      },
      reply: jest.fn().mockResolvedValue({}),
    };
  });

  it("runs lofi command successfully", async () => {
    const lofi = require("../../src/commands/prefix/music/lofi");
    client.manager.search = jest.fn().mockResolvedValue({
      tracks: [{ title: "Lofi Stream", uri: "uri", length: 999999 }],
    });

    await lofi.run(client, message);
    expect(player.queue.add).toHaveBeenCalled();
  });

  it("handles lofi not in voice channel error", async () => {
    const lofi = require("../../src/commands/prefix/music/lofi");
    message.member.voice.channel = null;
    await lofi.run(client, message);
    expect(message.reply).toHaveBeenCalledWith(
      expect.stringContaining("You must be in a voice channel"),
    );
  });

  it("handles lofi bot already in another channel error", async () => {
    const lofi = require("../../src/commands/prefix/music/lofi");
    message.guild.members.me.voice.channelId = "vc-different";
    await lofi.run(client, message);
    expect(message.reply).toHaveBeenCalledWith(
      expect.stringContaining("another voice channel"),
    );
  });

  it("runs 247 command successfully", async () => {
    const twentyfourseven = require("../../src/commands/prefix/music/247");
    await twentyfourseven.run(client, message);
    expect(message.channel.send).toHaveBeenCalled();
  });

  it("runs forward command successfully", async () => {
    const forward = require("../../src/commands/prefix/music/forward");
    await forward.run(client, message, ["10"]);
    expect(player.seek).toHaveBeenCalled();
  });

  it("runs leave command successfully", async () => {
    const leave = require("../../src/commands/prefix/music/leave");
    await leave.run(client, message);
    expect(player.destroy).toHaveBeenCalled();
  });

  it("runs loop command successfully", async () => {
    const loop = require("../../src/commands/prefix/music/loop");
    await loop.run(client, message, ["queue"]);
    expect(player.setLoop).toHaveBeenCalledWith("queue");
  });

  it("runs lyrics command successfully", async () => {
    const lyrics = require("../../src/commands/prefix/music/lyrics");
    await lyrics.run(client, message, ["Adele"]);
    expect(message.channel.send).toHaveBeenCalled();
  });

  it("runs nowplaying command successfully", async () => {
    const np = require("../../src/commands/prefix/music/nowplaying");
    await np.run(client, message);
    expect(message.channel.send).toHaveBeenCalled();
  });

  it("runs pause and resume commands successfully", async () => {
    const pause = require("../../src/commands/prefix/music/pause");
    const resume = require("../../src/commands/prefix/music/resume");

    player.paused = false;
    await pause.run(client, message);
    expect(player.pause).toHaveBeenCalled();

    player.paused = true;
    await resume.run(client, message);
    expect(player.pause).toHaveBeenCalledWith(false);
  });

  it("runs queue command successfully", async () => {
    const queue = require("../../src/commands/prefix/music/queue");
    await queue.run(client, message);
    expect(message.channel.send).toHaveBeenCalled();
  });

  it("runs remove command successfully", async () => {
    const remove = require("../../src/commands/prefix/music/remove");
    await remove.run(client, message, ["1"]);
    expect(player.queue.splice).toHaveBeenCalled();
  });

  it("runs shuffle command successfully", async () => {
    const shuffle = require("../../src/commands/prefix/music/shuffle");
    await shuffle.run(client, message);
    expect(player.queue.shuffle).toHaveBeenCalled();
  });

  it("runs skip command successfully", async () => {
    const skip = require("../../src/commands/prefix/music/skip");
    await skip.run(client, message);
    expect(player.skip).toHaveBeenCalled();
  });

  it("runs stop command successfully", async () => {
    const stop = require("../../src/commands/prefix/music/stop");
    await stop.run(client, message);
    expect(player.destroy).toHaveBeenCalled();
  });

  it("runs volume command successfully", async () => {
    const volume = require("../../src/commands/prefix/music/volume");
    await volume.run(client, message, ["50"]);
    expect(player.setVolume).toHaveBeenCalledWith(50);
  });
});
