// Tests for utils/helpers/alarmSchedulerHelper.js
const {
  safeSetTimeout,
  computeNextRecurringDate,
  formatAlarmDateString,
  recurringText,
  buildScheduledEmbed,
} = require("../src/features/alarm/alarmSchedulerHelper");
const { COLORS } = require("../src/lib/embeds");

describe("alarmSchedulerHelper", () => {
  describe("safeSetTimeout", () => {
    jest.useFakeTimers();

    test("fires callback after the requested delay", () => {
      const cb = jest.fn();
      const handle = safeSetTimeout(cb, 1000);
      expect(typeof handle.clear).toBe("function");

      jest.advanceTimersByTime(999);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    test("clear() prevents the callback from firing", () => {
      const cb = jest.fn();
      const handle = safeSetTimeout(cb, 1000);
      handle.clear();

      jest.advanceTimersByTime(2000);
      expect(cb).not.toHaveBeenCalled();
    });

    test("handles negative delay by firing immediately", () => {
      const cb = jest.fn();
      safeSetTimeout(cb, -50);
      jest.advanceTimersByTime(0);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("computeNextRecurringDate", () => {
    const base = new Date("2026-05-20T10:00:00Z");

    test("daily advances by 1 day", () => {
      const next = computeNextRecurringDate(base, "daily");
      expect(next.getTime() - base.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    test("weekly advances by 7 days", () => {
      const next = computeNextRecurringDate(base, "weekly");
      expect(next.getTime() - base.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    test("monthly advances the month component", () => {
      const next = computeNextRecurringDate(base, "monthly");
      expect(next.getUTCMonth()).toBe(base.getUTCMonth() + 1);
    });

    test("'none' returns the same instant (new instance, no mutation)", () => {
      const next = computeNextRecurringDate(base, "none");
      expect(next.getTime()).toBe(base.getTime());
      expect(next).not.toBe(base);
    });

    test("does not mutate the input date", () => {
      const original = base.getTime();
      computeNextRecurringDate(base, "daily");
      expect(base.getTime()).toBe(original);
    });
  });

  describe("formatAlarmDateString", () => {
    test("formats with zero-padded fields", () => {
      const d = new Date(2026, 0, 5, 9, 7);
      expect(formatAlarmDateString(d)).toBe("05/01/2026 09:07");
    });
  });

  describe("recurringText", () => {
    test.each([
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["none", "Non-recurring"],
      ["random", "Non-recurring"],
    ])("recurringText(%p) === %p", (input, expected) => {
      expect(recurringText(input)).toBe(expected);
    });
  });

  describe("buildScheduledEmbed", () => {
    const args = {
      alarmMessage: "Wake up",
      formattedTime: "20/05/2026 14:30",
      channelId: "111",
      roleId: "222",
      recurring: "daily",
      discordTimestamp: "<t:1234567890:R>",
    };

    test("renders the success color and includes all fields", () => {
      const embed = buildScheduledEmbed(args);
      const data = embed.toJSON();
      expect(data.color).toBe(COLORS.SUCCESS);
      expect(data.description).toContain('"Wake up"');
      expect(data.description).toContain("20/05/2026 14:30");
      expect(data.description).toContain("<#111>");
      expect(data.description).toContain("<@&222>");
      expect(data.description).toContain("Daily");
      expect(data.description).toContain("<t:1234567890:R>");
    });

    test("uses the recurring countdown phrasing for recurring alarms", () => {
      const embed = buildScheduledEmbed(args);
      expect(embed.toJSON().description).toContain("Countdown to next trigger");
    });

    test("uses the simple countdown phrasing for one-time alarms", () => {
      const embed = buildScheduledEmbed({ ...args, recurring: "none" });
      const desc = embed.toJSON().description;
      expect(desc).not.toContain("Countdown to next trigger");
      expect(desc).toContain("Countdown:");
    });
  });
});
