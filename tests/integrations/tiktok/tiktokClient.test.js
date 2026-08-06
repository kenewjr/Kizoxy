const tiktokClient = require("../../../src/integrations/tiktok/client");

describe("TikTok Client Scraper Tests", () => {
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

  it("isConfigured is always true", () => {
    expect(tiktokClient.isConfigured()).toBe(true);
  });

  describe("TikWM Scraper Strategies", () => {
    it("fetches and normalizes video posts successfully via Strategy 1 (TikWM Search)", async () => {
      const mockRaw = {
        code: 0,
        msg: "success",
        data: {
          videos: [
            {
              video_id: "888123",
              title: "Awesome TikTok Video",
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
      expect(profile.user.avatar).toBe("http://avatar.jpg");
      expect(profile.videos[0].id).toBe("888123");
      expect(profile.videos[0].type).toBe("video");
      expect(profile.videos[0].url).toBe("https://www.tiktok.com/@therock/video/888123");
    });

    it("fetches and normalizes photo / reels slide posts successfully", async () => {
      const mockRaw = {
        code: 0,
        msg: "success",
        data: {
          videos: [
            {
              video_id: "777456",
              title: "Cool Photo Slide",
              create_time: 1600000500,
              images: ["http://img1.jpg", "http://img2.jpg"],
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
      expect(profile.videos[0].id).toBe("777456");
      expect(profile.videos[0].type).toBe("photo");
      expect(profile.videos[0].url).toBe("https://www.tiktok.com/@therock/photo/777456");
      expect(profile.videos[0].images).toEqual(["http://img1.jpg", "http://img2.jpg"]);
    });

    it("throws TiktokAccountNotFoundError if user not found", async () => {
      // Mock Strategy 1 (Search returns no matching user videos)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, msg: "success", data: { videos: [] } }),
      });
      // Mock Strategy 2 (User posts returns code -1 User not found)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: -1, msg: "User not found" }),
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        tiktokClient.TiktokAccountNotFoundError,
      );
    });

    it("throws general Error if all strategies fail", async () => {
      // Mock all strategy fetch failures
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, msg: "success", data: { videos: [] } }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: -1, msg: "Rate limit reached" }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(tiktokClient.fetchProfile("therock")).rejects.toThrow(
        "All TikTok fetch strategies failed for @therock",
      );
    });

    it("falls back to HTML scraper if Strategy 1 & 2 fail", async () => {
      // 1. TikWM Search fails with network error
      global.fetch.mockRejectedValueOnce(new Error("Network Error"));
      // 2. TikWM Posts fails with network error
      global.fetch.mockRejectedValueOnce(new Error("Network Error"));

      // 3. HTML fallback succeeds
      const htmlData = `
        <html>
          <body>
            <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
              {
                "__DEFAULT_SCOPE__": {
                  "webapp.user-detail": {
                    "userInfo": {
                      "user": {
                        "id": "55555",
                        "uniqueId": "therock",
                        "avatarThumb": "http://avatar_html.jpg",
                        "roomStatus": 1,
                        "roomId": "999888"
                      }
                    },
                    "itemList": [
                      {
                        "id": "111222",
                        "desc": "HTML Scraped Video",
                        "createTime": 1600000000,
                        "video": { "cover": "http://cover.jpg" }
                      }
                    ]
                  }
                }
              }
            </script>
          </body>
        </html>
      `;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => htmlData,
      });

      const profile = await tiktokClient.fetchProfile("therock");
      expect(profile.user.id).toBe("55555");
      expect(profile.user.live).toBe(true);
      expect(profile.user.liveId).toBe("999888");
      expect(profile.videos[0].id).toBe("111222");
      expect(profile.videos[0].title).toBe("HTML Scraped Video");
    });
  });
});
