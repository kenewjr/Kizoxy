const request = require("supertest");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { createTestApp } = require("../../helpers/mockFactory");

describe("Logs Route Tests", () => {
  let app, tmpDir, logFile1, logFile2;

  beforeAll(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `logs-test-${Math.random().toString(36).substring(2, 9)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });

    logFile1 = "kizoxy-test-1.log";
    fs.writeFileSync(
      path.join(tmpDir, logFile1),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        module: "TEST",
        message: "Test error message",
      }) +
        "\n" +
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warning",
          module: "TEST",
          message: "Test warning message",
        }) +
        "\n" +
        "Not a JSON line but pretty ℹ️ Info line\n",
    );

    logFile2 = "kizoxy-test-2.log";
    fs.writeFileSync(path.join(tmpDir, logFile2), "Empty log");

    // Override the logs directory in helper
    require("../../../src/dashboard/helpers/logReader");
    // Using Object.defineProperty since it's a const, or re-setting it.
    // Wait, logReader resolves logs directory absolute relative to __dirname.
    // But since it's compiled, we can mock/spy fs calls or just use Jest module mocking for path resolution.
    // Wait! Let's mock/override path.join or fs operations inside the test for LOGS_DIR!
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  // Let's mock fs internally so we can redirect LOGS_DIR to our tmpDir!
  beforeEach(() => {
    require("../../../src/dashboard/helpers/logReader");
    // We can mock readdirSync, readFileSync, existsSync etc., or just let logReader read our tmpDir
    // How can we make logReader use tmpDir?
    // Let's mock logReader.js or redirect LOGS_DIR.
    // Actually, in Jest, we can spy on fs.readdirSync and redirect when the path contains '/logs'!
    const originalReaddirSync = fs.readdirSync;
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    const originalStatSync = fs.statSync;

    jest.spyOn(fs, "readdirSync").mockImplementation((p, options) => {
      if (typeof p === "string" && p.endsWith("logs")) {
        return originalReaddirSync(tmpDir, options);
      }
      return originalReaddirSync(p, options);
    });

    jest.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (typeof p === "string" && p.includes("logs")) {
        const basename = path.basename(p);
        return originalExistsSync(path.join(tmpDir, basename));
      }
      return originalExistsSync(p);
    });

    jest.spyOn(fs, "readFileSync").mockImplementation((p, encoding) => {
      if (typeof p === "string" && p.includes("logs")) {
        const basename = path.basename(p);
        return originalReadFileSync(path.join(tmpDir, basename), encoding);
      }
      return originalReadFileSync(p, encoding);
    });

    jest.spyOn(fs, "statSync").mockImplementation((p) => {
      if (typeof p === "string" && p.includes("logs")) {
        const basename = path.basename(p);
        return originalStatSync(path.join(tmpDir, basename));
      }
      return originalStatSync(p);
    });

    const setup = createTestApp();
    app = setup.app;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/logs", () => {
    it("returns array of log files", async () => {
      const res = await request(app).get("/api/logs");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((f) => f.name === logFile1)).toBe(true);
    });
  });

  describe("GET /api/logs/:name", () => {
    it("returns log file content and level counts", async () => {
      const res = await request(app).get(`/api/logs/${logFile1}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toContain("Test error message");
      expect(res.body.level_counts.ERROR).toBe(1);
      expect(res.body.level_counts.WARN).toBe(1);
    });

    it("limits lines with tail parameter", async () => {
      const res = await request(app).get(`/api/logs/${logFile1}?tail=1`);
      expect(res.status).toBe(200);
      const lines = res.body.content.split("\n").filter(Boolean);
      expect(lines.length).toBeLessThanOrEqual(1);
    });

    it("returns 400 on path traversal attempts", async () => {
      const res = await request(app).get("/api/logs/..%2F..%2Fetc%2Fpasswd");
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent files", async () => {
      const res = await request(app).get("/api/logs/nonexistent.log");
      expect(res.status).toBe(404);
    });
  });
});
