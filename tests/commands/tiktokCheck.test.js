jest.mock("../../src/integrations/tiktok/client", () => ({
  fetchProfile: jest.fn(),
  isValidTikTokId: jest.requireActual("../../src/integrations/tiktok/client")
    .isValidTikTokId,
  TiktokAccountNotFoundError: class extends Error {},
}));

jest.mock("../../src/integrations/scraperService/client", () => ({
  checkHealth: jest.fn(),
  getServiceStatus: jest.fn(() => ({ status: "Online" })),
  BASE_URL: "http://127.0.0.1:8100",
}));

jest.mock("../../src/integrations/tiktok/notifier", () => ({}));

const tiktokClient = require("../../src/integrations/tiktok/client");
const tiktokCommand = require("../../src/commands/slash/tiktok/tiktok");
const { createMockInteraction } = require("../helpers/mockFactory");

describe("/tiktok check", () => {
  it("adds the scraper diagnostic to the embed for an empty profile", async () => {
    tiktokClient.fetchProfile.mockResolvedValue({
      user: {
        username: "restricteduser",
        live: false,
        liveUrl: "https://www.tiktok.com/@restricteduser/live",
      },
      videos: [],
      source: "browser",
      diagnostic: "TikTok status 10221 (likely banned/restricted)",
    });
    const interaction = createMockInteraction({
      _options: { _subcommand: "check", username: "@restricteduser" },
      user: { tag: "tester#0001" },
    });

    await tiktokCommand.run({}, interaction);

    const reply = interaction.editReply.mock.calls[0][0];
    const fields = reply.embeds[0].toJSON().fields;
    expect(fields).toContainEqual({
      name: "Diagnostic",
      value: "TikTok status 10221 (likely banned/restricted)",
      inline: false,
    });
  });
});
