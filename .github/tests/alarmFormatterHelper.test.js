// Tests for utils/helpers/alarmFormatterHelper.js
const {
  LIST_PAGE_SIZE,
  SELECT_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
} = require("../../utils/helpers/alarmFormatterHelper");

describe("alarmFormatterHelper", () => {
  describe("constants", () => {
    test("LIST_PAGE_SIZE is 5", () => {
      expect(LIST_PAGE_SIZE).toBe(5);
    });
    test("SELECT_PAGE_SIZE is 25 (Discord max options)", () => {
      expect(SELECT_PAGE_SIZE).toBe(25);
    });
  });

  describe("totalPages", () => {
    test("returns at least 1 even when items is empty", () => {
      expect(totalPages([], 5)).toBe(1);
    });
    test("rounds up partial last page", () => {
      expect(totalPages(new Array(11), 5)).toBe(3);
    });
    test("exact multiples don't add an extra page", () => {
      expect(totalPages(new Array(10), 5)).toBe(2);
    });
  });

  describe("clampPage", () => {
    test("negative page snaps to 0", () => {
      expect(clampPage(-3, 5)).toBe(0);
    });
    test("page beyond total snaps to last", () => {
      expect(clampPage(10, 5)).toBe(4);
    });
    test("NaN snaps to 0", () => {
      expect(clampPage(Number.NaN, 5)).toBe(0);
    });
    test("in-range page returns unchanged", () => {
      expect(clampPage(2, 5)).toBe(2);
    });
  });

  describe("sliceForPage", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    test("returns first slice for page 0", () => {
      expect(sliceForPage(items, 0, 3)).toEqual([1, 2, 3]);
    });
    test("returns trailing slice for last page", () => {
      expect(sliceForPage(items, 2, 3)).toEqual([7]);
    });
  });

  describe("formatAlarmDate", () => {
    test("formats as DD/MM/YYYY HH:mm", () => {
      // Construct a Date in local time so the test is timezone-stable.
      const d = new Date(2026, 4, 20, 14, 30); // 20 May 2026 14:30 local
      expect(formatAlarmDate(d.toISOString())).toBe("20/05/2026 14:30");
    });
    test("zero-pads single-digit components", () => {
      const d = new Date(2026, 0, 5, 9, 7);
      expect(formatAlarmDate(d.toISOString())).toBe("05/01/2026 09:07");
    });
  });

  describe("recurringLabel", () => {
    test.each([
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["none", "Non-recurring"],
      ["", "Non-recurring"],
      [undefined, "Non-recurring"],
    ])("recurringLabel(%p) === %p", (input, expected) => {
      expect(recurringLabel(input)).toBe(expected);
    });
  });

  describe("alarmStatus", () => {
    test("Disabled when alarm.enabled === false", () => {
      const future = new Date(Date.now() + 60_000_000).toISOString();
      expect(alarmStatus({ enabled: false, time: future })).toBe(
        "⏸️ Disabled",
      );
    });
    test("Missed when time is in the past", () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      expect(alarmStatus({ time: past })).toBe("🔔 Missed");
    });
    test("Soon when time is within the next minute", () => {
      const soon = new Date(Date.now() + 30_000).toISOString();
      expect(alarmStatus({ time: soon })).toBe("🔔 Soon");
    });
    test("Waiting when time is comfortably ahead", () => {
      const later = new Date(Date.now() + 5 * 60_000).toISOString();
      expect(alarmStatus({ time: later })).toBe("⏳ Waiting");
    });
  });
});
