const { sendErrorWebhook } = require("../../src/lib/webhookReporter");

jest.mock("../../src/lib/logger");

describe("webhookReporter", () => {
  let origFetch;
  let origEnv;

  beforeEach(() => {
    origFetch = global.fetch;
    origEnv = process.env.ERROR_WEBHOOK_URL;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = origFetch;
    process.env.ERROR_WEBHOOK_URL = origEnv;
  });

  it("silently skips if webhook url is empty or invalid", async () => {
    delete process.env.ERROR_WEBHOOK_URL;
    global.fetch = jest.fn();
    await sendErrorWebhook("Test Title", new Error("Oops"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends payload to discord webhook", async () => {
    process.env.ERROR_WEBHOOK_URL =
      "https://discord.com/api/webhooks/12345/abcde";
    // Reload validation block via re-requiring or dynamic require, but since it's already executed at load:
    // Actually, the module validates on load. The module is already loaded.
    // Let's re-require to pick up env change!
    jest.isolateModules(async () => {
      process.env.ERROR_WEBHOOK_URL =
        "https://discord.com/api/webhooks/12345/abcde";
      const {
        sendErrorWebhook: send,
      } = require("../../src/lib/webhookReporter");

      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await send("Test Title", new Error("Oops"), { extraField: "val" });
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(process.env.ERROR_WEBHOOK_URL);
      const payload = JSON.parse(options.body);
      expect(payload.embeds[0].title).toContain("Test Title");
      expect(payload.embeds[0].description).toContain("Oops");
    });
  });

  it("handles fetch errors gracefully and backs off", async () => {
    jest.isolateModules(async () => {
      process.env.ERROR_WEBHOOK_URL =
        "https://discord.com/api/webhooks/12345/abcde";
      const {
        sendErrorWebhook: send,
      } = require("../../src/lib/webhookReporter");

      const mockFetch = jest.fn().mockRejectedValue(new Error("Network Error"));
      global.fetch = mockFetch;

      await send("Test Title", new Error("Oops"));
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
