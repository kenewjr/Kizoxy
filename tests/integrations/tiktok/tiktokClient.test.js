jest.mock("../../../src/integrations/scraperService/client");

const scraperService = require("../../../src/integrations/scraperService/client");
const tiktokClient = require("../../../src/integrations/tiktok/client");

describe("TikTok Client (kizoxy-scraper backed)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("isConfigured always returns true", () => {
    expect(tiktokClient.isConfigured()).toBe(true);
  });

  describe("isValidTikTokId", () => {
    it("accepts 15-22 digit numeric snowflake IDs", () => {
      expect(tiktokClient.isValidTikTokId("7653055317907131656")).toBe(true);
      expect(tiktokClient.isValidTikTokId("123456789012345")).toBe(true);
    });

    it("rejects non-numeric, too-short, too-long, or empty IDs", () => {
      expect(tiktokClient.isValidTikTokId("")).toBe(false);
      expect(tiktokClient.isValidTikTokId(null)).toBe(false);
      expect(tiktokClient.isValidTikTokId("abc123")).toBe(false);
      expect(tiktokClient.isValidTikTokId("123")).toBe(false);
      expect(tiktokClient.isValidTikTokId("1".repeat(23))).toBe(false);
    });
  });

  describe("fetchProfile() — happy path", () => {
    it("maps posts from the scraper service and reports live status", async () => {
      scraperService.getTiktokPosts.mockResolvedValue({
        success: true,
        source: "fast",
        diagnostic: "browser captured 0 items across 2 API responses",
        data: [
          {
            id: "7653055317907131656",
            desc: "Newest",
            create_time: 1781865900,
            cover_url: "http://cover1.jpg",
          },
          {
            id: "7653055317907131600",
            desc: "Older",
            create_time: 1781865800,
            cover_url: "http://cover2.jpg",
          },
        ],
      });
      scraperService.getTiktokLiveStatus.mockResolvedValue({
        success: true,
        source: "fast",
        data: { is_live: true, video_id: "999888" },
      });

      const profile = await tiktokClient.fetchProfile("@TestUser");

      expect(profile.user.username).toBe("testuser");
      expect(profile.user.live).toBe(true);
      expect(profile.user.liveId).toBe("999888");
      expect(profile.videos).toHaveLength(2);
      // Sorted newest-first by createTime.
      expect(profile.videos[0].id).toBe("7653055317907131656");
      expect(profile.videos[0].url).toBe(
        "https://www.tiktok.com/@testuser/video/7653055317907131656",
      );
      expect(profile.source).toBe("fast");
      expect(profile.diagnostic).toBe(
        "browser captured 0 items across 2 API responses",
      );
    });

    it("strips a leading @ and lowercases to match normalizeUsername()", () => {
      scraperService.getTiktokPosts.mockResolvedValue({
        success: true,
        data: [],
      });
      scraperService.getTiktokLiveStatus.mockResolvedValue({
        success: true,
        data: {},
      });

      return tiktokClient.fetchProfile("@Foo.Bar").then((profile) => {
        expect(scraperService.getTiktokPosts).toHaveBeenCalledWith("foo.bar");
        expect(profile.diagnostic).toBeNull();
      });
    });

    it("filters out reposts and videos with invalid (non-snowflake) IDs", async () => {
      scraperService.getTiktokPosts.mockResolvedValue({
        success: true,
        data: [
          {
            id: "7653055317907131656",
            desc: "Real video",
            create_time: 1781865900,
          },
          {
            id: "7653055317907131600",
            desc: "Reposted",
            create_time: 1781865800,
            is_repost: true,
          },
          {
            id: "not-a-snowflake",
            desc: "Garbage ID",
            create_time: 1781865700,
          },
        ],
      });
      scraperService.getTiktokLiveStatus.mockResolvedValue({
        success: true,
        data: {},
      });

      const profile = await tiktokClient.fetchProfile("someone");

      expect(profile.videos).toHaveLength(1);
      expect(profile.videos[0].id).toBe("7653055317907131656");
    });

    it("still returns posts if the live-status call fails (Promise.allSettled isolation)", async () => {
      scraperService.getTiktokPosts.mockResolvedValue({
        success: true,
        data: [
          { id: "7653055317907131656", desc: "Video", create_time: 1781865900 },
        ],
      });
      scraperService.getTiktokLiveStatus.mockRejectedValue(
        new Error("live check timed out"),
      );

      const profile = await tiktokClient.fetchProfile("someone");

      expect(profile.videos).toHaveLength(1);
      expect(profile.user.live).toBe(false);
    });
  });

  describe("fetchProfile() — error handling", () => {
    it("throws TiktokAccountNotFoundError on a 404-coded failure", async () => {
      const err = new Error("Not found");
      err.code = "NOT_FOUND";
      scraperService.getTiktokPosts.mockRejectedValue(err);
      scraperService.getTiktokLiveStatus.mockResolvedValue({
        success: true,
        data: {},
      });

      await expect(tiktokClient.fetchProfile("ghost")).rejects.toThrow(
        tiktokClient.TiktokAccountNotFoundError,
      );
    });

    // Regression test for the bug fixed 2026-08-15: fetchProfile() used to
    // swallow every non-404 failure and resolve with a fake "successful"
    // empty profile instead of rejecting. That meant TiktokScheduler's
    // exponential backoff (which only engages when fetchProfile() throws)
    // never kicked in during a kizoxy-scraper outage — the scheduler kept
    // retrying every account at full frequency forever, and manual
    // "check"/"test-send" surfaces reported "0 videos found" instead of
    // the real error. fetchProfile() must now reject so callers' existing
    // try/catch blocks (which all already expect this) can react correctly.
    it("throws (does not silently return an empty profile) when the scraper service errors", async () => {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:8100");
      scraperService.getTiktokPosts.mockRejectedValue(err);
      scraperService.getTiktokLiveStatus.mockRejectedValue(err);

      await expect(tiktokClient.fetchProfile("someone")).rejects.toThrow(
        /connect ECONNREFUSED/,
      );
    });

    it("throws when the scraper service returns POOL_EXHAUSTED", async () => {
      const err = new Error("No browser instance available within 25s");
      err.code = "POOL_EXHAUSTED";
      err.status = undefined;
      scraperService.getTiktokPosts.mockRejectedValue(err);
      scraperService.getTiktokLiveStatus.mockRejectedValue(err);

      await expect(tiktokClient.fetchProfile("someone")).rejects.toThrow(
        /No browser instance available/,
      );
    });
  });

  describe("checkLiveStatus()", () => {
    it("returns live status from the scraper service", async () => {
      scraperService.getTiktokLiveStatus.mockResolvedValue({
        success: true,
        source: "browser",
        data: { is_live: true, video_id: "12345" },
      });

      const result = await tiktokClient.checkLiveStatus("someone");

      expect(result.live).toBe(true);
      expect(result.liveId).toBe("12345");
      expect(result.source).toBe("browser");
    });

    it("fails safe (live: false) instead of throwing when the scraper service errors", async () => {
      scraperService.getTiktokLiveStatus.mockRejectedValue(new Error("boom"));

      const result = await tiktokClient.checkLiveStatus("someone");

      expect(result.live).toBe(false);
      expect(result.liveId).toBeNull();
    });
  });

  describe("getStrategyStats()", () => {
    it("returns the stats shape the dashboard/status command expects", () => {
      scraperService.getServiceStatus.mockReturnValue({ status: "Online" });
      const stats = tiktokClient.getStrategyStats();

      expect(stats).toHaveProperty("window");
      expect(stats).toHaveProperty("total_recorded");
      expect(stats).toHaveProperty("primary_strategy", "kizoxy-scraper");
      expect(stats).toHaveProperty("service_status");
      expect(stats).toHaveProperty("primary_healthy");
      expect(stats).toHaveProperty("breakdown");
    });

    it("flags unhealthy when the underlying service is Offline", () => {
      scraperService.getServiceStatus.mockReturnValue({ status: "Offline" });
      const stats = tiktokClient.getStrategyStats();
      expect(stats.primary_healthy).toBe(false);
      expect(stats.warning_banner).toMatch(/Offline/);
    });
  });
});
