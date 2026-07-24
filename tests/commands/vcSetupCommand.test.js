const {
  createMockClient,
  createMockInteraction,
} = require("../helpers/mockFactory");
const vcSetup = require("../../src/commands/slash/tempvoice/vcSetup");
const tempVcStorage = require("../../src/persistence/tempVcStorage");

jest.mock("../../src/persistence/tempVcStorage", () => ({
  getTempChannel: jest.fn(),
  getGenerator: jest.fn(),
  getSettings: jest.fn(),
  getAllGenerators: jest.fn(),
  addGenerator: jest.fn(),
  removeGenerator: jest.fn(),
}));

describe("vcsetup Command Tests", () => {
  let client;
  let interaction;

  beforeEach(() => {
    client = createMockClient();
    interaction = createMockInteraction();
    interaction.guildId = "guild-1";
    interaction.memberPermissions = {
      has: () => true,
    };
    jest.clearAllMocks();
  });

  it("fails if user does not have permission", async () => {
    interaction.memberPermissions.has = () => false;
    await vcSetup.run(client, interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Manage Server"),
      }),
    );
  });

  it("handles generator add successfully", async () => {
    interaction.options.getSubcommandGroup = jest
      .fn()
      .mockReturnValue("generator");
    interaction.options.getSubcommand = jest.fn().mockReturnValue("add");

    const mockVoiceChannel = {
      id: "vc-1",
      type: 2, // GuildVoice
      parentId: "cat-1",
      bitrate: 64000,
      toString: () => "<#vc-1>",
    };
    interaction.options.getChannel = jest.fn().mockImplementation((name) => {
      if (name === "channel") return mockVoiceChannel;
      return null;
    });
    interaction.options.getString = jest.fn().mockReturnValue(null);
    interaction.options.getInteger = jest.fn().mockReturnValue(null);

    tempVcStorage.getTempChannel.mockResolvedValue(null);
    tempVcStorage.getGenerator.mockResolvedValue(null);
    tempVcStorage.getSettings.mockResolvedValue({
      isPremium: false,
      maxGenerators: 3,
    });
    tempVcStorage.getAllGenerators.mockResolvedValue([]);
    tempVcStorage.addGenerator.mockResolvedValue({
      id: "vc-1",
      categoryId: "cat-1",
      defaultName: "{username}'s Channel",
      defaultLimit: 0,
      bitrate: 64,
      rtcRegion: "auto",
    });

    await vcSetup.run(client, interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.editReply.mock.calls[0][0].embeds[0].data.title).toBe(
      "Generator added",
    );
  });

  it("handles generator add channel type validation", async () => {
    interaction.options.getSubcommandGroup = jest
      .fn()
      .mockReturnValue("generator");
    interaction.options.getSubcommand = jest.fn().mockReturnValue("add");

    const mockTextChannel = {
      id: "text-1",
      type: 0, // GuildText
      toString: () => "<#text-1>",
    };
    interaction.options.getChannel = jest.fn().mockReturnValue(mockTextChannel);

    await vcSetup.run(client, interaction);
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.editReply.mock.calls[0][0].embeds[0].data.title).toBe(
      "Invalid channel",
    );
  });

  it("handles generator remove successfully", async () => {
    interaction.options.getSubcommandGroup = jest
      .fn()
      .mockReturnValue("generator");
    interaction.options.getSubcommand = jest.fn().mockReturnValue("remove");

    const mockVoiceChannel = {
      id: "vc-1",
      type: 2,
      toString: () => "<#vc-1>",
    };
    interaction.options.getChannel = jest
      .fn()
      .mockReturnValue(mockVoiceChannel);

    tempVcStorage.getGenerator.mockResolvedValue({ id: "vc-1" });

    await vcSetup.run(client, interaction);
    expect(tempVcStorage.removeGenerator).toHaveBeenCalledWith(
      "guild-1",
      "vc-1",
    );
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.editReply.mock.calls[0][0].embeds[0].data.title).toBe(
      "Generator removed",
    );
  });

  it("handles generator remove not registered warning", async () => {
    interaction.options.getSubcommandGroup = jest
      .fn()
      .mockReturnValue("generator");
    interaction.options.getSubcommand = jest.fn().mockReturnValue("remove");

    const mockVoiceChannel = {
      id: "vc-1",
      type: 2,
      toString: () => "<#vc-1>",
    };
    interaction.options.getChannel = jest
      .fn()
      .mockReturnValue(mockVoiceChannel);

    tempVcStorage.getGenerator.mockResolvedValue(null);

    await vcSetup.run(client, interaction);
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.editReply.mock.calls[0][0].embeds[0].data.title).toBe(
      "Not a generator",
    );
  });

  it("lists generators successfully", async () => {
    interaction.options.getSubcommandGroup = jest
      .fn()
      .mockReturnValue("generator");
    interaction.options.getSubcommand = jest.fn().mockReturnValue("list");

    tempVcStorage.getAllGenerators.mockResolvedValue([
      {
        id: "vc-1",
        categoryId: "cat-1",
        defaultName: "Voice 1",
        defaultLimit: 0,
        defaultBitrate: 64000,
      },
    ]);
    tempVcStorage.getSettings.mockResolvedValue({
      isPremium: true,
      maxGenerators: 10,
    });

    await vcSetup.run(client, interaction);
    expect(interaction.editReply).toHaveBeenCalled();
    expect(
      interaction.editReply.mock.calls[0][0].embeds[0].data.title,
    ).toContain("Generators");
  });
});
