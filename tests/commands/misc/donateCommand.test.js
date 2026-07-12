const donateSlash = require("../src/commands/slash/misc/Donate");
const donatePrefix = require("../src/commands/prefix/misc/donate");

describe("donate command", () => {
  let mockClient;
  let mockInteraction;
  let mockMessage;

  beforeEach(() => {
    mockClient = {
      config: {
        BOT_COLOR: "#5865F2",
      },
      user: {
        username: "Kizoxy",
        displayAvatarURL: jest.fn().mockReturnValue("https://avatar.url"),
      },
    };

    mockInteraction = {
      reply: jest.fn().mockResolvedValue(),
    };

    mockMessage = {
      channel: {
        send: jest.fn().mockResolvedValue(),
      },
    };
  });

  test("slash command sends donation embed", async () => {
    await donateSlash.run(mockClient, mockInteraction);
    expect(mockInteraction.reply).toHaveBeenCalled();
    const arg = mockInteraction.reply.mock.calls[0][0];
    expect(arg.embeds).toBeDefined();
    const desc = arg.embeds[0].data?.description || arg.embeds[0].description;
    expect(desc).toContain("tako");
  });

  test("prefix command sends donation embed", async () => {
    await donatePrefix.run(mockClient, mockMessage, []);
    expect(mockMessage.channel.send).toHaveBeenCalled();
    const arg = mockMessage.channel.send.mock.calls[0][0];
    expect(arg.embeds).toBeDefined();
    const desc = arg.embeds[0].data?.description || arg.embeds[0].description;
    expect(desc).toContain("tako");
  });
});
