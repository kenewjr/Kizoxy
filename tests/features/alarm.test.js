jest.mock("uuid", () => ({ v4: () => "mock-uuid-123" }));

const {
  validateTime,
  parseDate,
  buildAlarmDate,
} = require("../../src/features/alarm/alarmService");

describe("Alarm Service Feature Tests", () => {
  describe("validateTime", () => {
    it("validates HH:mm formats correctly", () => {
      expect(validateTime("14:30")).toBeNull();
      expect(validateTime("08:05")).toBeNull();
      expect(validateTime("25:00")).toContain("Invalid time format");
      expect(validateTime("12:61")).toContain("Invalid time format");
    });
  });

  describe("parseDate", () => {
    it("parses DD/MM/YYYY dates successfully", () => {
      const res = parseDate("14/07/2026");
      expect(res.day).toBe(14);
      expect(res.month).toBe(7);
      expect(res.year).toBe(2026);
    });

    it("defaults to current year for DD/MM dates", () => {
      const res = parseDate("25/12");
      expect(res.day).toBe(25);
      expect(res.month).toBe(12);
      expect(res.year).toBe(new Date().getFullYear());
    });

    it("returns error on invalid days or months", () => {
      expect(parseDate("32/07").error).toBeDefined();
      expect(parseDate("14/13").error).toBeDefined();
    });
  });

  describe("buildAlarmDate", () => {
    it("builds a correct Date object from time and date string", () => {
      const res = buildAlarmDate({ time: "14:30", date: "25/12/2026" });
      const targetDate = res.alarmDate;
      expect(targetDate.getFullYear()).toBe(2026);
      expect(targetDate.getMonth()).toBe(11); // December (0-indexed)
      expect(targetDate.getDate()).toBe(25);
      expect(targetDate.getHours()).toBe(14);
      expect(targetDate.getMinutes()).toBe(30);
    });
  });
});
