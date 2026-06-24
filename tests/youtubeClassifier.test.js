jest.mock("axios");
const axios = require("axios");

const {
  classify,
  parseIsoDurationToSeconds,
} = require("../src/integrations/youtube/classifier");

describe("youtube classifier", () => {
  beforeEach(() => jest.clearAllMocks());

  test("liveBroadcastContent live → live (no Shorts probe)", async () => {
    const item = { id: "v1", snippet: { liveBroadcastContent: "live" } };
    await expect(classify(item)).resolves.toBe("live");
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("liveBroadcastContent upcoming → upcoming", async () => {
    const item = { id: "v2", snippet: { liveBroadcastContent: "upcoming" } };
    await expect(classify(item)).resolves.toBe("upcoming");
  });

  test("Shorts probe resolving 200 → short", async () => {
    axios.get.mockResolvedValueOnce({ status: 200, headers: {} });
    const item = {
      id: "v3",
      snippet: { liveBroadcastContent: "none" },
      contentDetails: { duration: "PT30S" },
    };
    await expect(classify(item)).resolves.toBe("short");
  });

  test("Shorts probe redirect to /watch → video", async () => {
    axios.get.mockResolvedValueOnce({
      status: 303,
      headers: { location: "https://www.youtube.com/watch?v=v4" },
    });
    const item = {
      id: "v4",
      snippet: { liveBroadcastContent: "none" },
      contentDetails: { duration: "PT30S" },
    };
    await expect(classify(item)).resolves.toBe("video");
  });

  test("inconclusive probe + short duration → short (fallback)", async () => {
    axios.get.mockRejectedValueOnce(new Error("network"));
    const item = {
      id: "v5",
      snippet: { liveBroadcastContent: "none" },
      contentDetails: { duration: "PT2M30S" },
    };
    await expect(classify(item)).resolves.toBe("short");
  });

  test("inconclusive probe + long duration → video (fallback)", async () => {
    axios.get.mockRejectedValueOnce(new Error("network"));
    const item = {
      id: "v6",
      snippet: { liveBroadcastContent: "none" },
      contentDetails: { duration: "PT12M5S" },
    };
    await expect(classify(item)).resolves.toBe("video");
  });

  test("parseIsoDurationToSeconds handles H/M/S", () => {
    expect(parseIsoDurationToSeconds("PT1H2M3S")).toBe(3723);
    expect(parseIsoDurationToSeconds("PT45S")).toBe(45);
    expect(parseIsoDurationToSeconds("PT3M")).toBe(180);
    expect(parseIsoDurationToSeconds("garbage")).toBeNull();
  });
});
