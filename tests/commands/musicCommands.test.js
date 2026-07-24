const {
  createMockInteraction,
  createMockClient,
} = require("../helpers/mockFactory");
const playCmd = require("../../src/commands/slash/music/play");
const skipCmd = require("../../src/commands/slash/music/skip");
const pauseCmd = require("../../src/commands/slash/music/pause");
const resumeCmd = require("../../src/commands/slash/music/resume");
const loopCmd = require("../../src/commands/slash/music/loop");

describe("Music Slash Commands Tests", () => {
  let client, interaction, player;

  beforeEach(() => {
    client = createMockClient();
    player = {
      guildId: "guild-1",
      playing: true,
      paused: false,
      loop: "none",
      volume: 100,
      queue: {
        current: { title: "Song" },
        length: 1,
        size: 1,
      },
      skip: jest.fn().mockResolvedValue({}),
      pause: jest.fn().mockResolvedValue({}),
      resume: jest.fn().mockResolvedValue({}),
      setLoop: jest.fn().mockResolvedValue({}),
    };

    client.manager = {
      players: new Map([["guild-1", player]]),
      shoukaku: {
        nodes: new Map([
          [
            "node-1",
            {
              state: 2, // Connected state
            },
          ],
        ]),
      },
      search: jest.fn().mockResolvedValue({
        loadType: "TRACK_LOADED",
        tracks: [{ title: "New Track", uri: "url" }],
      }),
      createPlayer: jest.fn().mockResolvedValue(player),
    };

    const voiceChannel = { id: "vc-1", name: "Voice Room" };

    interaction = createMockInteraction();
    interaction.guild = {
      id: "guild-1",
      members: {
        me: {
          voice: {
            channel: voiceChannel,
          },
        },
      },
    };
    interaction.member.voice.channel = voiceChannel;
    interaction.options.getString = jest.fn().mockReturnValue("lofi");
    interaction.options.getInteger = jest.fn().mockReturnValue(null);
  });

  describe("/play command", () => {
    it("returns error if user not in voice channel", async () => {
      interaction.member.voice.channel = null;
      await playCmd.run(client, interaction);
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("plays track successfully if in same voice channel", async () => {
      await playCmd.run(client, interaction);
      expect(client.manager.search).toHaveBeenCalled();
    });
  });

  describe("/skip command", () => {
    it("skips currently playing track", async () => {
      await skipCmd.run(client, interaction);
      expect(player.skip).toHaveBeenCalled();
    });
  });

  describe("/pause command", () => {
    it("pauses active player", async () => {
      await pauseCmd.run(client, interaction);
      expect(player.pause).toHaveBeenCalledWith(true);
    });
  });

  describe("/resume command", () => {
    it("resumes paused player", async () => {
      player.paused = true;
      await resumeCmd.run(client, interaction);
      expect(player.pause).toHaveBeenCalled();
    });
  });

  describe("/loop command", () => {
    it("sets loop mode to track", async () => {
      interaction.options.getString = jest.fn().mockReturnValue("current");
      await loopCmd.run(client, interaction);
      expect(player.setLoop).toHaveBeenCalledWith("track");
    });
  });
});
