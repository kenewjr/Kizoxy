const {
  getLevelFromLine,
  stripAnsi,
} = require("../../../src/dashboard/helpers/logParser");

describe("Log Parser Helper Tests", () => {
  describe("stripAnsi", () => {
    it("removes ANSI escape codes", () => {
      const coloredLine =
        "\u001b[31m[12:00:00] ❌ [CORE] Error occurred\u001b[0m";
      expect(stripAnsi(coloredLine)).toBe(
        "[12:00:00] ❌ [CORE] Error occurred",
      );
    });
  });

  describe("getLevelFromLine", () => {
    it("detects level from JSON format", () => {
      const jsonLine =
        '{"timestamp":"...","level":"error","module":"TEST","message":"..."}';
      expect(getLevelFromLine(jsonLine)).toBe("ERROR");
    });

    it("detects level from emoji prefix with pretty format", () => {
      const prettyLine = "[12:00:00] ❌ [CORE] Message";
      expect(getLevelFromLine(prettyLine)).toBe("ERROR");
    });

    it("detects level from colored emoji pretty format", () => {
      const coloredLine = "\u001b[31m[12:00:00] ⚠️ [CORE] Message\u001b[0m";
      expect(getLevelFromLine(coloredLine)).toBe("WARN");
    });

    it("defaults to INFO if unknown format", () => {
      const simpleLine = "simple line with no emoji or json";
      expect(getLevelFromLine(simpleLine)).toBe("INFO");
    });

    it("handles empty input", () => {
      expect(getLevelFromLine("")).toBe("INFO");
      expect(getLevelFromLine(null)).toBe("INFO");
    });
  });
});
