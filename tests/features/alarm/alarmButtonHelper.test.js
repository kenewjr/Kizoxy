// Tests for utils/helpers/alarmButtonHelper.js
const {
  PAGINATION_PREFIXES,
  resolvePage,
  parsePaginationId,
  buildNewAlarmModal,
} = require("../../../src/features/alarm/alarmButtonHelper");

describe("alarmButtonHelper", () => {
  describe("PAGINATION_PREFIXES", () => {
    test("contains all four expected prefixes", () => {
      expect(PAGINATION_PREFIXES).toEqual(
        expect.arrayContaining([
          "alarm_list_page",
          "alarm_cancel_page",
          "alarm_edit_page",
          "alarm_toggle_page",
        ]),
      );
    });
  });

  describe("resolvePage", () => {
    test("first → 0", () => {
      expect(resolvePage("first", 5, 10)).toBe(0);
    });
    test("last → total - 1", () => {
      expect(resolvePage("last", 0, 10)).toBe(9);
    });
    test("prev decrements", () => {
      expect(resolvePage("prev", 5, 10)).toBe(4);
    });
    test("next increments", () => {
      expect(resolvePage("next", 5, 10)).toBe(6);
    });
    test("prev clamps at 0", () => {
      expect(resolvePage("prev", 0, 10)).toBe(0);
    });
    test("next clamps at last page", () => {
      expect(resolvePage("next", 9, 10)).toBe(9);
    });
    test("unknown action returns clamped current page", () => {
      expect(resolvePage("indicator", 3, 10)).toBe(3);
    });
  });

  describe("parsePaginationId", () => {
    test("parses a valid customId", () => {
      expect(parsePaginationId("alarm_list_page:next:3")).toEqual({
        prefix: "alarm_list_page",
        action: "next",
        page: 3,
      });
    });

    test("returns null for unknown prefix", () => {
      expect(parsePaginationId("not_a_prefix:next:3")).toBeNull();
    });

    test("returns null for malformed customId (too few parts)", () => {
      expect(parsePaginationId("alarm_list_page:next")).toBeNull();
    });

    test("returns null when page is not numeric", () => {
      expect(parsePaginationId("alarm_list_page:next:abc")).toBeNull();
    });

    test("returns null for completely unrelated buttons", () => {
      expect(parsePaginationId("alarm_refresh")).toBeNull();
      expect(parsePaginationId("alarm_new")).toBeNull();
    });
  });

  describe("buildNewAlarmModal", () => {
    test("returns a modal with the expected customId and title", () => {
      const modal = buildNewAlarmModal();
      const data = modal.toJSON();
      expect(data.custom_id).toBe("alarm_new_submit");
      expect(data.title).toContain("Create New Alarm");
    });

    test("contains the four expected text inputs", () => {
      const data = buildNewAlarmModal().toJSON();
      const inputs = data.components.flatMap((row) => row.components);
      const ids = inputs.map((c) => c.custom_id);
      expect(ids).toEqual([
        "alarm_name",
        "alarm_time",
        "alarm_date",
        "alarm_recurring",
      ]);
    });

    test("alarm_name and alarm_time are required, others optional", () => {
      const data = buildNewAlarmModal().toJSON();
      const byId = Object.fromEntries(
        data.components
          .flatMap((row) => row.components)
          .map((c) => [c.custom_id, c]),
      );
      expect(byId.alarm_name.required).toBe(true);
      expect(byId.alarm_time.required).toBe(true);
      expect(byId.alarm_date.required).toBe(false);
      expect(byId.alarm_recurring.required).toBe(false);
    });
  });
});
