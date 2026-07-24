// config.YOUTUBE_API_KEY is read lazily via require inside the resolver.
process.env.YOUTUBE_API_KEY = "test-key";

const {
  resolveChannel,
  RESOLVE_ERROR,
} = require("../../../src/integrations/youtube/channelResolver");

describe("youtube channelResolver", () => {
  let originalFetch;
  beforeAll(() => {
    originalFetch = global.fetch;
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("bare UC... ID resolves without forHandle/forUsername lookups", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "UC1234567890123456789012", snippet: { title: "By ID" } },
        ],
      }),
    });
    const res = await resolveChannel("UC1234567890123456789012");
    expect(res.youtubeChannelId).toBe("UC1234567890123456789012");
    expect(res.youtubeChannelTitle).toBe("By ID");
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("id=UC1234567890123456789012");
  });

  test("/channel/UC... URL extracts the ID", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: "UCabcdefghijklmnopqrstuv", snippet: { title: "Chan" } }],
      }),
    });
    const res = await resolveChannel(
      "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    );
    expect(res.youtubeChannelId).toBe("UCabcdefghijklmnopqrstuv");
  });

  test("@handle in a URL uses forHandle", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "UChandle00000000000000000",
            snippet: { title: "Handle Chan" },
          },
        ],
      }),
    });
    const res = await resolveChannel("https://www.youtube.com/@SomeHandle");
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("forHandle=%40SomeHandle");
    expect(res.youtubeChannelTitle).toBe("Handle Chan");
  });

  test("bare @handle uses forHandle", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "UCbare0000000000000000000", snippet: { title: "Bare" } },
        ],
      }),
    });
    const res = await resolveChannel("@bareHandle");
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("forHandle=%40bareHandle");
    expect(res.youtubeChannelId).toBe("UCbare0000000000000000000");
  });

  test("/user/LegacyName uses forUsername", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { id: "UCuser0000000000000000000", snippet: { title: "Legacy" } },
        ],
      }),
    });
    const res = await resolveChannel("https://www.youtube.com/user/LegacyName");
    expect(res.youtubeChannelId).toBe("UCuser0000000000000000000");
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("forUsername=LegacyName");
  });

  test("/c/CustomName falls back to page HTML scrape", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          '<html>"channelId":"UCcustom00000000000000000"</html>',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: "UCcustom00000000000000000", snippet: { title: "Custom" } },
          ],
        }),
      });
    const res = await resolveChannel("https://www.youtube.com/c/CustomName");
    expect(res.youtubeChannelId).toBe("UCcustom00000000000000000");
    expect(res.youtubeChannelTitle).toBe("Custom");
  });

  test("nothing matched throws the friendly resolve error", async () => {
    await expect(resolveChannel("not a channel at all")).rejects.toThrow(
      RESOLVE_ERROR,
    );
  });

  test("empty input throws the friendly resolve error", async () => {
    await expect(resolveChannel("")).rejects.toThrow(RESOLVE_ERROR);
  });

  test("@handle falls back to HTML scrape when API throws (e.g. no key)", async () => {
    global.fetch
      .mockRejectedValueOnce(new Error("No YOUTUBE_API_KEY configured."))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          '<html>"externalId":"UChandle_scrape_000000000"<meta property="og:title" content="Scraped Channel - YouTube"></html>',
      })
      .mockRejectedValueOnce(new Error("No YOUTUBE_API_KEY configured."));
    const res = await resolveChannel("https://www.youtube.com/@NinjaZombieCh");
    expect(res.youtubeChannelId).toBe("UChandle_scrape_000000000");
    expect(res.youtubeChannelTitle).toBe("Scraped Channel");
  });

  test("all strategies exhausted — error message suggests pasting UC... ID", async () => {
    global.fetch
      .mockRejectedValueOnce(new Error("No YOUTUBE_API_KEY configured."))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "<html>no channel data here</html>",
      });
    await expect(
      resolveChannel("https://www.youtube.com/@NonexistentHandle"),
    ).rejects.toThrow(/Channel ID/);
  });

  test("handles channelsList fetch timeout aborts and returns fallback", async () => {
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
    const promise = resolveChannel("UC1234567890123456789012");
    jest.advanceTimersByTime(10000);
    jest.useRealTimers();
    const res = await promise;
    expect(res.youtubeChannelId).toBe("UC1234567890123456789012");
  });
});
