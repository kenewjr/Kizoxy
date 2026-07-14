const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  listLogFiles,
  readLogFile,
  searchLogFile,
  getLogLevelCounts,
} = require("../../../src/dashboard/helpers/logReader");

describe("Log Reader Helper Tests", () => {
  let tmpDir, logFile;

  beforeAll(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `logreader-test-${Math.random().toString(36).substring(2, 9)}`,
    );
    fs.mkdirSync(tmpDir, { recursive: true });

    logFile = "kizoxy-test.log";
    fs.writeFileSync(
      path.join(tmpDir, logFile),
      '{"timestamp":"...","level":"error","module":"TEST","message":"..."}\n' +
        '{"timestamp":"...","level":"warning","module":"TEST","message":"..."}\n' +
        "[12:00:00] ✅ [TEST] Success pretty line",
    );
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("listLogFiles", () => {
    it("returns available logs files details", () => {
      const list = listLogFiles();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((f) => f.name === logFile)).toBe(true);
    });
  });

  describe("readLogFile", () => {
    it("reads complete file lines", () => {
      const content = readLogFile(logFile);
      expect(content).toContain("Success pretty line");
    });

    it("limits output line length using tailLines parameter", () => {
      const content = readLogFile(logFile, 1);
      const lines = content.split("\n").filter(Boolean);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Success pretty line");
    });

    it("throws EINVAL error for path traversal name", () => {
      expect(() => readLogFile("../../../etc/passwd")).toThrow(
        /Invalid log file name/,
      );
    });
  });

  describe("searchLogFile", () => {
    it("returns only lines matching query", () => {
      const matches = searchLogFile(logFile, "warning");
      expect(matches.length).toBe(1);
      expect(matches[0]).toContain("warning");
    });
  });

  describe("getLogLevelCounts", () => {
    it("accurately sums levels counts", () => {
      const counts = getLogLevelCounts(logFile);
      expect(counts.ERROR).toBe(1);
      expect(counts.WARN).toBe(1);
      expect(counts.SUCCESS).toBe(1);
      expect(counts.TOTAL).toBe(3);
    });
  });
});
