const { getSpotifyOembedTitle } = require("../../../src/integrations/spotify/oembed");

describe("Spotify oEmbed", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns a trimmed title from a successful response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ title: "  Never Gonna Give You Up  " }),
    });
    const spotifyUrl =
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=a&x=b";

    await expect(getSpotifyOembedTitle(spotifyUrl)).resolves.toBe(
      "Never Gonna Give You Up",
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
      { signal: expect.any(AbortSignal) },
    );
  });

  it.each([
    ["non-200 response", { ok: false }],
    [
      "missing title",
      { ok: true, json: jest.fn().mockResolvedValue({ thumbnail_url: "image" }) },
    ],
    ["blank title", { ok: true, json: jest.fn().mockResolvedValue({ title: " " }) }],
  ])("returns null for %s", async (_label, response) => {
    global.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      getSpotifyOembedTitle("https://open.spotify.com/track/id"),
    ).resolves.toBeNull();
  });

  it("returns null when fetch rejects", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    await expect(
      getSpotifyOembedTitle("https://open.spotify.com/track/id"),
    ).resolves.toBeNull();
  });
});
