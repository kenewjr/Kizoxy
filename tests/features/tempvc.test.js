const {
  createMockInteraction,
  createMockVoiceChannel,
} = require("../helpers/mockFactory");
const {
  applyLockState,
  applyHideState,
  validateOwner,
} = require("../../src/features/tempvc/tempVcHelper");
const tempVcStorage = require("../../src/persistence/tempVcStorage");

jest.mock("../../src/persistence/tempVcStorage", () => ({
  getTempChannel: jest.fn(),
}));

describe("TempVC Feature Helper Tests", () => {
  let guild, channel;

  beforeEach(() => {
    guild = {
      roles: {
        everyone: { id: "everyone-role-id" },
      },
    };
    channel = createMockVoiceChannel();
  });

  describe("applyLockState", () => {
    it("sets Connect permission overwrite to false when locked is true", async () => {
      await applyLockState(guild, channel, true);
      expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith(
        "everyone-role-id",
        {
          Connect: false,
        },
      );
    });

    it("sets Connect permission overwrite to null when locked is false", async () => {
      await applyLockState(guild, channel, false);
      expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith(
        "everyone-role-id",
        {
          Connect: null,
        },
      );
    });
  });

  describe("applyHideState", () => {
    it("sets ViewChannel permission overwrite to false when hidden is true", async () => {
      await applyHideState(guild, channel, true);
      expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith(
        "everyone-role-id",
        {
          ViewChannel: false,
        },
      );
    });
  });

  describe("validateOwner", () => {
    it("returns null and replies with error if user is not in a VC", async () => {
      const interaction = createMockInteraction();
      interaction.member.voice.channel = null;

      const res = await validateOwner(interaction);
      expect(res).toBeNull();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        }),
      );
    });

    it("validates correctly when user is the owner of temp VC", async () => {
      const interaction = createMockInteraction();
      interaction.member.voice.channel = channel;
      interaction.guildId = "guild-1";
      interaction.user.id = "owner-1";

      tempVcStorage.getTempChannel.mockResolvedValueOnce({
        id: channel.id,
        ownerId: "owner-1",
      });

      const res = await validateOwner(interaction);
      expect(res).not.toBeNull();
      expect(res.tempRecord.ownerId).toBe("owner-1");
    });
  });
});
