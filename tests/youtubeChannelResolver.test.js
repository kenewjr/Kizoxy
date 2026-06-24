jest.mock("axios");
const axios = require("axios");

// config.YOUTUBE_API_KEY is read lazily via require inside the resolver.
process.env.YOUTUBE_API_KEY = "test-key";

const {
  resolveChannel,
  RESOLVE_ERROR,
} = require("../src/integrations/youtube/channelResolver");

describe("youtube channelResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("bare UC... ID resolves without forHandle/forUsername lookups", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: "UC1234567890123456789012", snippet: { title: "By ID" } },
        ],
      },
    });
    const res = await resolveChannel("UC1234567890123456789012");
    expect(res.youtubeChannelId).toBe("UC1234567890123456789012");
    expect(res.youtubeChannelTitle).toBe("By ID");
    expect(axios.get.mock.calls[0][1].params.id).toBe(
      "UC1234567890123456789012",
    );
  });

  test("/channel/UC... URL extracts the ID", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [{ id: "UCabcdefghijklmnopqrstuv", snippet: { title: "Chan" } }],
      },
    });
    const res = await resolveChannel(
      "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    );
    expect(res.youtubeChannelId).toBe("UCabcdefghijklmnopqrstuv");
  });

  test("@handle in a URL uses forHandle", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "UChandle00000000000000000",
            snippet: { title: "Handle Chan" },
          },
        ],
      },
    });
    const res = await resolveChannel("https://www.youtube.com/@SomeHandle");
    expect(axios.get.mock.calls[0][1].params.forHandle).toBe("@SomeHandle");
    expect(res.youtubeChannelTitle).toBe("Handle Chan");
  });

  test("bare @handle uses forHandle", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: "UCbare0000000000000000000", snippet: { title: "Bare" } },
        ],
      },
    });
    const res = await resolveChannel("@bareHandle");
    expect(axios.get.mock.calls[0][1].params.forHandle).toBe("@bareHandle");
    expect(res.youtubeChannelId).toBe("UCbare0000000000000000000");
  });

  test("/user/LegacyName uses forUsername", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          { id: "UCuser0000000000000000000", snippet: { title: "Legacy" } },
        ],
      },
    });
    const res = await resolveChannel("https://www.youtube.com/user/LegacyName");
    expect(res.youtubeChannelId).toBe("UCuser0000000000000000000");
    expect(axios.get.mock.calls[0][1].params.forUsername).toBe("LegacyName");
  });

  test("/c/CustomName falls back to page HTML scrape", async () => {
    // First call: page HTML; second call: channels.list by scraped id.
    axios.get
      .mockResolvedValueOnce({
        data: '<html>"channelId":"UCcustom00000000000000000"</html>',
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: "UCcustom00000000000000000", snippet: { title: "Custom" } },
          ],
        },
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
});
