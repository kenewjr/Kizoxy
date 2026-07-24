const tiktokClient = require("../../../src/integrations/tiktok/client");
const config = require("../../../src/config/config");

jest.mock("../../../src/config/config", () => ({
  TIKTOK_API_BASE: null,
  TIKTOK_API_KEY: null,
}));

describe("TikTok Client Tests", () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    config.TIKTOK_API_BASE = null;
    config.TIKTOK_API_KEY = null;
  });

  it("isConfigured is always true", () => {
    expect(tiktokClient.isConfigured()).toBe(true);
  });

  describe("Custom API Provider", () => {
    beforeEach(() => {
      config.TIKTOK_API_BASE = "https://custom.tiktok.api";
      config.TIKTOK_API_KEY = "token123";
    });

    it("fetches and normalizes user profile successfully", async () => {
      const mockRaw = {
        user: {
          id: 12345,
          username: "therock",
          avatar: "http://avatar.jpg",
          live: true,
          liveId: 999,
        },
        videos: [
          {
            id: 888,
            url: "http://video.url",
            title: "Video title",
            createTime: 1600000000,
            isLive: false,
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRaw,
      });

      const profile = await tiktokClient.fetchProfile("therock");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://custom.tiktok.api/user/therock",
        expect.objectContaining({
          headers: { Authorization: "Bearer token123" },
        }),
      );
      expect(profile.user.id).toBe("12345");
      expect(profile.user.live).toBe(true);
      expect(profile.videos[0].id).toBe("888");
    });

    it("throws TiktokAccountNotFoundError on 404 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        tiktokClient.TiktokAccountNotFoundError,
      );
    });

    it("throws general Error on other HTTP error statuses", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "HTTP 500",
      );
    });
  });

  describe("TikWM Scraper Fallback", () => {
    beforeEach(() => {
      config.TIKTOK_API_BASE = null;
    });

    it("fetches and normalizes from TikWM API successfully", async () => {
      const mockRaw = {
        code: 0,
        msg: "success",
        data: {
          videos: [
            {
              video_id: "888",
              title: "Video title",
              create_time: 1600000000,
              author: {
                id: 12345,
                unique_id: "therock",
                avatar: "http://avatar.jpg",
              },
            },
          ],
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRaw,
      });

      const profile = await tiktokClient.fetchProfile("therock");
      expect(profile.user.id).toBe("12345");
      expect(profile.user.username).toBe("therock");
      expect(profile.videos[0].id).toBe("888");
    });

    it("throws TiktokAccountNotFoundError if user not found via TikWM", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: -1, msg: "User not found" }),
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        tiktokClient.TiktokAccountNotFoundError,
      );
    });

    it("throws general Error if TikWM returns other error codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: -1, msg: "Rate limit reached" }),
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "TikWM error code -1: Rate limit reached",
      );
    });

    it("throws error if TikWM response data is missing", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, msg: "success" }),
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "Empty response from TikWM API",
      );
    });

    it("throws HTTP error on scraper response failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "HTTP 403",
      );
    });
  });
});
