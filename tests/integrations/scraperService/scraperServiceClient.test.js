const scraperClient = require("../../../src/integrations/scraperService/client");

describe("scraperService client header and request tests", () => {
  let origFetch;
  let origApiKey;
  let origServiceKey;

  beforeEach(() => {
    origFetch = global.fetch;
    origApiKey = process.env.API_KEY;
    origServiceKey = process.env.SCRAPER_SERVICE_API_KEY;
    process.env.SCRAPER_SERVICE_API_KEY = "test-secret-key";
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = origFetch;
    process.env.API_KEY = origApiKey;
    process.env.SCRAPER_SERVICE_API_KEY = origServiceKey;
  });

  it("checkHealth sends single canonical x-api-key without duplicate or dead headers", async () => {
    let capturedHeaders = null;
    global.fetch = jest.fn().mockImplementation((_url, options) => {
      capturedHeaders = options.headers;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            browser_pool: { available: 1, total: 1 },
          }),
      });
    });

    const res = await scraperClient.checkHealth();
    expect(res.status).toBe("Online");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const headersObj = new Headers(capturedHeaders);
    expect(headersObj.get("x-api-key")).toBe("test-secret-key");
    expect(headersObj.get("x-shared-secret")).toBeNull();

    // Check plain object keys to ensure no case variants coexist
    const lowerKeys = Object.keys(capturedHeaders).map((k) => k.toLowerCase());
    const apiKeyCount = lowerKeys.filter((k) => k === "x-api-key").length;
    expect(apiKeyCount).toBe(1);
  });

  it("request sends single canonical x-api-key without duplicate headers", async () => {
    let capturedHeaders = null;
    global.fetch = jest.fn().mockImplementation((_url, options) => {
      capturedHeaders = options.headers;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: "ok" } }),
      });
    });

    const body = await scraperClient.getYoutubeLiveStatus("test-channel");
    expect(body).toEqual({ status: "ok" });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const headersObj = new Headers(capturedHeaders);
    expect(headersObj.get("x-api-key")).toBe("test-secret-key");
    expect(headersObj.get("x-shared-secret")).toBeNull();

    const lowerKeys = Object.keys(capturedHeaders).map((k) => k.toLowerCase());
    const apiKeyCount = lowerKeys.filter((k) => k === "x-api-key").length;
    expect(apiKeyCount).toBe(1);
  });

  it("handles non-ok responses cleanly", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({ detail: "Forbidden" })),
    });

    await expect(scraperClient.getTiktokPosts("testuser")).rejects.toThrow(
      "Forbidden",
    );
  });
});
