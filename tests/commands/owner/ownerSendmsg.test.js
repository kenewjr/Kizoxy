const sendmsg = require("../src/commands/slash/owner/sendmsg");

describe("owner sendmsg command", () => {
  let mockClient;
  let mockInteraction;
  let mockGuild;
  let mockChannel;

  beforeEach(() => {
    mockChannel = {
      isTextBased: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue({ id: "msg1" }),
      name: "general",
    };

    mockGuild = {
      name: "Test Guild",
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
    };

    mockClient = {
      config: {
        OWNER_ID: "owner-123",
      },
      guilds: {
        fetch: jest.fn().mockResolvedValue(mockGuild),
      },
    };

    mockInteraction = {
      user: { id: "owner-123", tag: "Owner#0001" },
      options: {
        getString: jest.fn((name) => {
          if (name === "guild_id") return "guild-123";
          if (name === "channel_id") return "channel-123";
          if (name === "message") return "Hello world!";
          return null;
        }),
      },
      replied: false,
      deferred: false,
      reply: jest.fn().mockImplementation(function () {
        this.replied = true;
        return Promise.resolve();
      }),
      deferReply: jest.fn().mockImplementation(function () {
        this.deferred = true;
        return Promise.resolve();
      }),
      editReply: jest.fn().mockResolvedValue(),
    };
  });

  test("rejects non-owner execution", async () => {
    mockInteraction.user.id = "not-owner";
    await sendmsg.run(mockClient, mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalled();
    const callArg = mockInteraction.reply.mock.calls[0][0];
    const embed = callArg.embeds[0];
    const desc = embed.data?.description || embed.description;
    expect(desc).toContain("do not have permission");
  });

  test("rejects unknown guild", async () => {
    mockClient.guilds.fetch.mockResolvedValue(null);
    await sendmsg.run(mockClient, mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArg = mockInteraction.editReply.mock.calls[0][0];
    const embed = callArg.embeds[0];
    const desc = embed.data?.description || embed.description;
    expect(desc).toContain("Could not find server");
  });

  test("rejects unknown channel", async () => {
    mockGuild.channels.fetch.mockResolvedValue(null);
    await sendmsg.run(mockClient, mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArg = mockInteraction.editReply.mock.calls[0][0];
    const embed = callArg.embeds[0];
    const desc = embed.data?.description || embed.description;
    expect(desc).toContain("Could not find channel");
  });

  test("rejects non-text channel", async () => {
    mockChannel.isTextBased.mockReturnValue(false);
    await sendmsg.run(mockClient, mockInteraction);
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArg = mockInteraction.editReply.mock.calls[0][0];
    const embed = callArg.embeds[0];
    const desc = embed.data?.description || embed.description;
    expect(desc).toContain("not a text channel");
  });

  test("sends message successfully to valid text channel", async () => {
    await sendmsg.run(mockClient, mockInteraction);
    expect(mockChannel.send).toHaveBeenCalledWith("Hello world!");
    expect(mockInteraction.editReply).toHaveBeenCalled();
    const callArg = mockInteraction.editReply.mock.calls[0][0];
    const embed = callArg.embeds[0];
    const desc = embed.data?.description || embed.description;
    expect(desc).toContain("Message successfully sent");
  });
});
