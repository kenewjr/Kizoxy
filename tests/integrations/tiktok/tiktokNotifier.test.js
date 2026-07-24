const tiktokNotifier = require("../../../src/integrations/tiktok/notifier");
const { createMockClient } = require("../../helpers/mockFactory");

describe("TikTok Notifier Tests", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("Embed and row building", () => {
    it("builds video embed correctly", () => {
      const embed = tiktokNotifier.buildVideoEmbed(mockClient, {
        username: "therock",
        video: {
          createTime: Math.floor(Date.now() / 1000),
          title: "New Video title",
          url: "https://tiktok.com/@therock/video/1",
          cover: "https://cover.url",
        },
        avatar: "https://avatar.url",
      });

      expect(embed.data.title).toBe("New Video title");
      expect(embed.data.url).toBe("https://tiktok.com/@therock/video/1");
      expect(embed.data.image.url).toBe("https://cover.url");
    });

    it("builds live embed correctly", () => {
      const embed = tiktokNotifier.buildLiveEmbed(mockClient, {
        username: "therock",
        liveUrl: "https://tiktok.com/@therock/live",
        avatar: "https://avatar.url",
      });

      expect(embed.data.title).toBe("@therock is now LIVE!");
      expect(embed.data.url).toBe("https://tiktok.com/@therock/live");
    });

    it("builds link row correctly", () => {
      const row = tiktokNotifier.buildLinkRow("Watch", "https://url.com");
      expect(row.components[0].data.url).toBe("https://url.com");
    });
  });

  describe("Send announcements", () => {
    it("returns false if channel fetch fails (deleted channel)", async () => {
      mockClient.channels = {
        fetch: jest.fn().mockRejectedValue(new Error("Unknown Channel")),
      };

      const result = await tiktokNotifier.send(
        mockClient,
        { discordChannelId: "chan-123" },
        {},
      );
      expect(result).toBe(false);
    });

    it("sends message successfully if channel is found", async () => {
      const mockChannel = {
        send: jest.fn().mockResolvedValue({}),
      };
      mockClient.channels = {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      };

      const result = await tiktokNotifier.send(
        mockClient,
        { discordChannelId: "chan-123" },
        { embed: {}, row: {}, content: "Hey!" },
      );
      expect(result).toBe(true);
      expect(mockChannel.send).toHaveBeenCalled();
    });
  });

  describe("mentionContent", () => {
    it("returns role mention content", () => {
      const sub = { mentionRoleId: "role-123" };
      expect(tiktokNotifier.mentionContent(sub, "prefix")).toBe(
        "<@&role-123> prefix",
      );
      expect(tiktokNotifier.mentionContent({}, "prefix")).toBeUndefined();
    });
  });
});
