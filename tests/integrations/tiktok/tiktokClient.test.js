const tiktokClient = require("../../../src/integrations/tiktok/client");

describe("TikTok Client", () => {
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

  // Helper: returns true if any fetch call targeted a /live URL
  function liveFetchCalled() {
    return global.fetch.mock.calls.some(
      (args) => typeof args[0] === "string" && args[0].includes("/live"),
    );
  }

  it("isConfigured always returns true", () => {
    expect(tiktokClient.isConfigured()).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // _liveStatusKnown gating
  // ---------------------------------------------------------------------------
  describe("_liveStatusKnown gating in applyLiveAndSort", () => {
    it("Strategy 3 (Direct HTML) wins: _liveStatusKnown true, live true → preserved, no /live fetch", async () => {
      // S1 TikWM Search fails (2 queries)
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        // S2 TikWM User Posts fails
        .mockResolvedValueOnce({ ok: false, status: 403 })
        // S3 Direct HTML succeeds with live:true
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => `<html><body>
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              {"__DEFAULT_SCOPE__":{"webapp.user-detail":{"userInfo":{"user":{"id":"55555","uniqueId":"testuser","avatarThumb":"http://a.jpg","roomStatus":1,"roomId":"999888"}},"itemList":[]}}}
            </script></body></html>`,
        });

      const profile = await tiktokClient.fetchProfile("testuser");

      expect(profile.user.live).toBe(true);
      expect(profile.user.liveId).toBe("999888");
      // _liveStatusKnown:true → no extra /live fetch
      expect(liveFetchCalled()).toBe(false);
    });

    it("Strategy 3 (Direct HTML) wins: _liveStatusKnown true, live false → preserved as false, no /live fetch", async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => `<html><body>
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              {"__DEFAULT_SCOPE__":{"webapp.user-detail":{"userInfo":{"user":{"id":"55555","uniqueId":"testuser","avatarThumb":"http://a.jpg","roomStatus":0}},"itemList":[]}}}
            </script></body></html>`,
        });

      const profile = await tiktokClient.fetchProfile("testuser");

      expect(profile.user.live).toBe(false);
      // _liveStatusKnown:true even when live:false — must NOT fall back to /live fetch
      expect(liveFetchCalled()).toBe(false);
    });

    it("Strategy 1 (TikWM Search) wins: _liveStatusKnown false → /live fetch IS made", async () => {
      // S1 TikWM Search succeeds
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            msg: "success",
            data: {
              videos: [{
                video_id: "888123",
                title: "Test",
                create_time: 1600000000,
                author: { id: 12345, unique_id: "therock", avatar: "http://a.jpg" },
              }],
            },
          }),
        })
        // checkLiveStatus fetches /live page
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html></html>" });

      await tiktokClient.fetchProfile("therock");

      // _liveStatusKnown:false → checkLiveStatus fallback runs → /live fetch happens
      expect(liveFetchCalled()).toBe(true);
    });

    it("_liveStatusKnown flag is never present on the returned profile object", async () => {
      // S1 TikWM Search fails (2 queries), S2 fails, S3 Direct HTML wins
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => `<html><body>
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              {"__DEFAULT_SCOPE__":{"webapp.user-detail":{"userInfo":{"user":{"id":"1","uniqueId":"u","roomStatus":0}},"itemList":[]}}}
            </script></body></html>`,
        });

      const profile = await tiktokClient.fetchProfile("u");

      expect(profile.user).not.toHaveProperty("_liveStatusKnown");
    });

    it("checkLiveStatus /live page detecting live merges result when TikWM Search wins", async () => {
      // S1 TikWM Search makes 2 queries: @u and u — both need mocks
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            msg: "success",
            data: {
              videos: [{
                video_id: "111",
                title: "T",
                create_time: 1600000000,
                author: { id: 1, unique_id: "u", avatar: null },
              }],
            },
          }),
        })
        // second TikWM query (bare username)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ code: 0, msg: "success", data: { videos: [] } }),
        })
        // checkLiveStatus /live page — contains liveRoomStatus:1 signal
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<html><body>"liveRoomStatus":1</body></html>',
        });

      const profile = await tiktokClient.fetchProfile("u");

      expect(liveFetchCalled()).toBe(true);
      expect(profile.user.live).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Video fetching + normalization
  // ---------------------------------------------------------------------------
  describe("Strategy 1 (TikWM Search) — video fetching", () => {
    it("fetches and normalizes video posts", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          msg: "success",
          data: {
            videos: [{
              video_id: "888123",
              title: "Awesome TikTok Video",
              create_time: 1600000000,
              author: { id: 12345, unique_id: "therock", avatar: "http://avatar.jpg" },
            }],
          },
        }),
      });

      const profile = await tiktokClient.fetchProfile("therock");

      expect(profile.user.id).toBe("12345");
      expect(profile.user.username).toBe("therock");
      expect(profile.user.avatar).toBe("http://avatar.jpg");
      expect(profile.videos[0].id).toBe("888123");
      expect(profile.videos[0].type).toBe("video");
      expect(profile.videos[0].url).toBe("https://www.tiktok.com/@therock/video/888123");
    });

    it("fetches and normalizes photo slide posts", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          msg: "success",
          data: {
            videos: [{
              video_id: "777456",
              title: "Cool Photo Slide",
              create_time: 1600000500,
              images: ["http://img1.jpg", "http://img2.jpg"],
              author: { id: 12345, unique_id: "therock", avatar: "http://avatar.jpg" },
            }],
          },
        }),
      });

      const profile = await tiktokClient.fetchProfile("therock");

      expect(profile.videos[0].id).toBe("777456");
      expect(profile.videos[0].type).toBe("photo");
      expect(profile.videos[0].url).toBe("https://www.tiktok.com/@therock/photo/777456");
      expect(profile.videos[0].images).toEqual(["http://img1.jpg", "http://img2.jpg"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------
  describe("Error handling", () => {
    it("throws TiktokAccountNotFoundError when a strategy detects account not found", async () => {
      // S1: both queries return empty videos
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        // S2: TikWM Posts returns "User not found"
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: -1, msg: "User not found" }) });

      await expect(tiktokClient.fetchProfile("ghost")).rejects.toThrow(
        tiktokClient.TiktokAccountNotFoundError,
      );
    });

    it("throws aggregated error including all 5 strategy failure messages when every strategy fails", async () => {
      global.fetch
        // S1: two empty-video queries
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        // S2: rate limit (non-404 code so not AccountNotFound)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: -1, msg: "Rate limit reached" }) })
        // S3: 403
        .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" })
        // S4: 500
        .mockResolvedValueOnce({ ok: false, status: 500 })
        // S5: HTML fetch → no candidate IDs
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html><body>no ids here</body></html>" });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "All TikTok fetch strategies failed for @therock",
      );
    });

    it("falls back to Strategy 3 (Direct HTML) when Strategies 1 and 2 fail", async () => {
      // S1: network error on both queries
      global.fetch
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockRejectedValueOnce(new Error("Network Error"))
        // S2: network error
        .mockRejectedValueOnce(new Error("Network Error"))
        // S3: Direct HTML with live session
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => `<html><body>
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              {"__DEFAULT_SCOPE__":{"webapp.user-detail":{"userInfo":{"user":{"id":"55555","uniqueId":"therock","avatarThumb":"http://avatar_html.jpg","roomStatus":1,"roomId":"999888"}},"itemList":[{"id":"111222","desc":"HTML Scraped Video","createTime":1600000000,"video":{"cover":"http://cover.jpg"}}]}}}
            </script></body></html>`,
        });

      const profile = await tiktokClient.fetchProfile("therock");

      expect(profile.user.id).toBe("55555");
      expect(profile.user.live).toBe(true);
      expect(profile.user.liveId).toBe("999888");
      expect(profile.videos[0].id).toBe("111222");
      expect(profile.videos[0].title).toBe("HTML Scraped Video");
      // _liveStatusKnown:true → no /live fetch needed
      expect(liveFetchCalled()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Log messages reference correct strategy number/name (catches stale strings)
  // ---------------------------------------------------------------------------
  describe("Log message strategy labels", () => {
    let loggerWarnings;

    beforeEach(() => {
      loggerWarnings = [];
      // Capture logger.warning calls via the module's internal logger
      // by intercepting console output isn't reliable; instead verify via
      // the thrown aggregated error message which includes strategy labels
    });

    it("aggregated error message names strategies correctly (S1=TikWM Search, S2=TikWM Posts, S3=Direct HTML, S4=TikTok oEmbed, S5=HTML Extraction)", async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ code: 0, data: { videos: [] } }) })
        .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" })
        .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html></html>" });

      let err;
      try {
        await tiktokClient.fetchProfile("nobody");
      } catch (e) {
        err = e;
      }

      expect(err).toBeDefined();
      expect(err.message).toMatch(/TikWM Search/);
      expect(err.message).toMatch(/TikWM Posts/);
      expect(err.message).toMatch(/Direct HTML/);
      expect(err.message).toMatch(/TikTok oEmbed/);
      expect(err.message).toMatch(/HTML Extraction/);
    });
  });

  // ---------------------------------------------------------------------------
  // Strategy stats counter
  // ---------------------------------------------------------------------------
  describe("getStrategyStats", () => {
    it("returns stats object with expected shape", () => {
      const stats = tiktokClient.getStrategyStats();

      expect(stats).toHaveProperty("window");
      expect(stats).toHaveProperty("total_recorded");
      expect(stats).toHaveProperty("breakdown");
      expect(stats).toHaveProperty("tikwm_search_consecutive_failures");
      expect(stats).toHaveProperty("tikwm_search_health");
      expect(["ok", "degraded"]).toContain(stats.tikwm_search_health);
    });
  });
});
