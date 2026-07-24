const youtubeClient = require("../../../src/integrations/youtube/client");
const youtubeFormatter = require("../../../src/integrations/youtube/formatter");

describe("YouTube Client and Formatter Tests", () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe("Formatter Tests", () => {
    it("formats embed correct for all BADGES types", () => {
      const mockClient = {
        user: {
          username: "Kizoxy",
          displayAvatarURL: () => "https://avatar.url",
        },
      };
      const videoItem = {
        id: "vid-123",
        snippet: {
          title: "New Video title",
          channelTitle: "Lofi Girl",
          thumbnails: {
            maxres: { url: "https://max.url" },
          },
        },
      };

      const embedLive = youtubeFormatter.buildAnnouncementEmbed(mockClient, {
        videoItem,
        type: "live",
        channelTitle: "Lofi Live",
      });
      expect(embedLive.data.title).toBe("New Video title");
      expect(embedLive.data.url).toBe(
        "https://www.youtube.com/watch?v=vid-123",
      );
      expect(embedLive.data.description).toContain("Lofi Girl");

      const embedUpcoming = youtubeFormatter.buildAnnouncementEmbed(
        mockClient,
        { videoItem, type: "upcoming" },
      );
      expect(embedUpcoming.data.title).toBe("New Video title");

      const embedShort = youtubeFormatter.buildAnnouncementEmbed(mockClient, {
        videoItem,
        type: "short",
      });
      expect(embedShort.data.title).toBe("New Video title");
    });

    it("builds Watch Row action correctly", () => {
      const row = youtubeFormatter.buildWatchRow("vid-123");
      expect(row.components[0].data.url).toBe(
        "https://www.youtube.com/watch?v=vid-123",
      );
    });
  });

  describe("Client Tests", () => {
    it("fetches latest feed entry successfully", async () => {
      const xmlFeed = `
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
          <entry>
            <yt:videoId>vid-123</yt:videoId>
            <title>Video title</title>
            <published>2026-07-18T10:00:00Z</published>
          </entry>
        </feed>
      `;

      global.fetch.mockResolvedValue({
        ok: true,
        text: async () => xmlFeed,
      });

      const entry = await youtubeClient.fetchLatestFeedEntry("channel-123");
      expect(entry).toEqual({
        videoId: "vid-123",
        title: "Video title",
        publishedAt: "2026-07-18T10:00:00Z",
      });
    });

    it("returns null if feed entry does not exist", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: async () => `<feed></feed>`,
      });
      const entry = await youtubeClient.fetchLatestFeedEntry("channel-123");
      expect(entry).toBeNull();
    });

    it("throws error if feed fetch returns non-ok HTTP status", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });
      await expect(
        youtubeClient.fetchLatestFeedEntry("channel-123"),
      ).rejects.toThrow("HTTP 404");
    });

    it("fetches video details successfully", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ id: "vid-123", snippet: { title: "Title" } }],
        }),
      });

      const details = await youtubeClient.fetchVideoDetails("vid-123");
      expect(details.id).toBe("vid-123");
    });

    it("returns null if videos.list returns empty items", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const details = await youtubeClient.fetchVideoDetails("vid-123");
      expect(details).toBeNull();
    });

    it("throws error if fetchVideoDetails returns non-ok HTTP status", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
      });
      await expect(youtubeClient.fetchVideoDetails("vid-123")).rejects.toThrow(
        "HTTP 403",
      );
    });

    it("handles fetchLatestFeedEntry timeout and aborts", async () => {
      jest.useFakeTimers();
      global.fetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }
        });
      });
      const promise = youtubeClient.fetchLatestFeedEntry("channel-123");
      jest.advanceTimersByTime(10000);
      await expect(promise).rejects.toThrow("aborted");
      jest.useRealTimers();
    });

    it("handles fetchVideoDetails timeout and aborts", async () => {
      jest.useFakeTimers();
      global.fetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }
        });
      });
      const promise = youtubeClient.fetchVideoDetails("vid-123");
      jest.advanceTimersByTime(10000);
      await expect(promise).rejects.toThrow("aborted");
      jest.useRealTimers();
    });
  });
});
