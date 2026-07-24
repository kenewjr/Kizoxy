const { searchLRCLIB } = require("../../../src/features/lyrics/lrclibClient");

describe("LRCLIB Client Tests", () => {
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

  it("handles exact GET match successfully", async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        trackName: "Hello",
        artistName: "Adele",
        duration: 295,
        plainLyrics: "Hello from the other side",
        syncedLyrics:
          "[00:10.50] Hello from the other side\n[00:15.00] instrumental",
      }),
    });

    const res = await searchLRCLIB({
      cleanedTitle: "Hello",
      cleanedAuthor: "Adele",
      duration: 295,
    });

    expect(res).toBeDefined();
    expect(res.source).toBe("lrclib");
    expect(res.hasSyncedLyrics).toBe(true);
    expect(res.lines.length).toBe(1);
    expect(res.lines[0].line).toBe("Hello from the other side");
  });

  it("falls back to SEARCH if GET match fails", async () => {
    // First GET call returns null / 404
    global.fetch.mockResolvedValueOnce({
      status: 404,
      json: async () => null,
    });

    // Second SEARCH call returns list
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => [
        {
          id: 12345,
          trackName: "Hello",
          artistName: "Adele",
          duration: 295,
          plainLyrics: "Hello from the other side",
        },
      ],
    });

    const res = await searchLRCLIB({
      cleanedTitle: "Hello",
      cleanedAuthor: "Adele",
      duration: 295,
    });

    expect(res).toBeDefined();
    expect(res.text).toContain("Hello from the other side");
  });

  it("returns null if no lyrics are found", async () => {
    global.fetch.mockResolvedValue({
      status: 404,
      json: async () => null,
    });

    const res = await searchLRCLIB({
      cleanedTitle: "Unknown Song",
      cleanedAuthor: "Unknown Artist",
      duration: 180,
    });

    expect(res).toBeNull();
  });
});
