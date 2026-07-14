const request = require("supertest");
const { createTestApp } = require("../../helpers/mockFactory");

describe("Updates Route Tests", () => {
  let app, originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    const setup = createTestApp();
    app = setup.app;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("GET /api/updates", () => {
    it("returns packages updates list", async () => {
      // Mock fetch response for registries
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ version: "100.0.0" }),
      });

      const res = await request(app).get("/api/updates?refresh=true");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("packages");
      expect(Array.isArray(res.body.packages)).toBe(true);
      expect(res.body.packages.length).toBeGreaterThan(0);
      expect(res.body.packages[0]).toHaveProperty("outdated");
    });

    it("uses cached data on subsequent calls within TTL", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ version: "100.0.0" }),
      });

      // Warm cache
      const res1 = await request(app).get("/api/updates?refresh=true");
      const time1 = res1.body.checked_at;

      // Call again without refresh
      const res2 = await request(app).get("/api/updates");
      const time2 = res2.body.checked_at;

      expect(time1).toBe(time2);
    });
  });
});
