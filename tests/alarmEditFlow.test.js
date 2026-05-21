// Tests for the new alarm edit flow (Phase: rich detail UI).

// uuid v9+ ships ESM-only and jest can't load it without extra config.
// alarmService only uses uuid in createAlarm (not updateAlarm), so a stub
// is enough to satisfy the module-level require.
jest.mock("uuid", () => ({ v4: () => "test-uuid" }));

const {
  buildEditAlarmModal,
} = require("../src/features/alarm/alarmButtonHelper");
const {
  buildDetailButtons,
  buildRecurringSelectRow,
} = require("../src/features/alarm/alarmFormatter");
const { updateAlarm } = require("../src/features/alarm/alarmService");

describe("alarm edit flow", () => {
  describe("buildEditAlarmModal", () => {
    const alarm = {
      id: "alarm-1",
      message: "Wake up",
      time: new Date(2026, 4, 20, 14, 30).toISOString(),
      recurring: "daily",
    };

    test("customId encodes the alarm id", () => {
      const data = buildEditAlarmModal(alarm).toJSON();
      expect(data.custom_id).toBe("alarm_edit_submit:alarm-1");
    });

    test("pre-fills all four inputs with current values", () => {
      const data = buildEditAlarmModal(alarm).toJSON();
      const byId = Object.fromEntries(
        data.components
          .flatMap((row) => row.components)
          .map((c) => [c.custom_id, c]),
      );
      expect(byId.alarm_name.value).toBe("Wake up");
      expect(byId.alarm_time.value).toBe("14:30");
      expect(byId.alarm_date.value).toBe("20/05/2026");
      expect(byId.alarm_recurring.value).toBe("daily");
    });

    test("falls back to 'none' for missing recurring", () => {
      const noRecurring = { ...alarm, recurring: undefined };
      const data = buildEditAlarmModal(noRecurring).toJSON();
      const recurringInput = data.components
        .flatMap((row) => row.components)
        .find((c) => c.custom_id === "alarm_recurring");
      expect(recurringInput.value).toBe("none");
    });
  });

  describe("buildDetailButtons (rich variant)", () => {
    const baseAlarm = {
      id: "alarm-2",
      message: "Test",
      time: new Date().toISOString(),
      enabled: true,
      recurring: "none",
    };

    test("returns 4 ActionRows when called with an alarm", () => {
      const rows = buildDetailButtons(baseAlarm);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(4);
    });

    test("falls back to single-row legacy output when called without an alarm", () => {
      const single = buildDetailButtons();
      expect(Array.isArray(single)).toBe(false);
      expect(single.toJSON().components).toHaveLength(2);
    });

    test("first row has Edit, Recurring, Toggle, Delete", () => {
      const rows = buildDetailButtons(baseAlarm);
      const labels = rows[0].toJSON().components.map((c) => c.label);
      expect(labels[0]).toContain("Edit");
      expect(labels[1]).toContain("Recurring");
      expect(labels[2]).toContain("Disable"); // enabled=true → Disable button
      expect(labels[3]).toContain("Delete");
    });

    test("toggle button shows Enable when alarm is disabled", () => {
      const rows = buildDetailButtons({ ...baseAlarm, enabled: false });
      const toggleLabel = rows[0].toJSON().components[2].label;
      expect(toggleLabel).toContain("Enable");
    });

    test("customIds embed the alarm id", () => {
      const rows = buildDetailButtons(baseAlarm);
      const ids = rows[0].toJSON().components.map((c) => c.custom_id);
      ids.forEach((id) => expect(id).toContain(":alarm-2"));
    });

    test("delete button uses Danger style", () => {
      const rows = buildDetailButtons(baseAlarm);
      const deleteBtn = rows[0].toJSON().components[3];
      // Discord.js ButtonStyle.Danger === 4
      expect(deleteBtn.style).toBe(4);
    });
  });

  describe("buildRecurringSelectRow", () => {
    test("renders all four recurring options", () => {
      const row = buildRecurringSelectRow("alarm-3", "daily").toJSON();
      const select = row.components[0];
      expect(select.options).toHaveLength(4);
      const values = select.options.map((o) => o.value);
      expect(values).toEqual(["none", "daily", "weekly", "monthly"]);
    });

    test("marks the current value as default", () => {
      const row = buildRecurringSelectRow("alarm-3", "weekly").toJSON();
      const select = row.components[0];
      const weekly = select.options.find((o) => o.value === "weekly");
      expect(weekly.default).toBe(true);
    });

    test("customId embeds the alarm id", () => {
      const row = buildRecurringSelectRow("alarm-3", "none").toJSON();
      expect(row.components[0].custom_id).toBe("alarm_recurring_set:alarm-3");
    });
  });

  describe("updateAlarm", () => {
    // Build a minimal in-memory scheduler stub so we can test the service
    // without spinning up the real one.
    function makeScheduler(initialAlarm) {
      const store = new Map();
      if (initialAlarm) store.set(initialAlarm.id, { ...initialAlarm });

      return {
        cancelAlarmCalls: [],
        scheduleAlarmCalls: [],
        cancelAlarm(id) {
          this.cancelAlarmCalls.push(id);
        },
        async scheduleAlarm(a) {
          this.scheduleAlarmCalls.push(a);
        },
        storage: {
          async get(id) {
            const a = store.get(id);
            return a ? { ...a } : null;
          },
          async update(id, patch) {
            const a = store.get(id);
            if (a) store.set(id, { ...a, ...patch });
          },
        },
      };
    }

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const baseAlarm = {
      id: "a1",
      userId: "u1",
      guildId: "g1",
      channelId: "c1",
      roleId: "r1",
      message: "Old name",
      time: future.toISOString(),
      recurring: "none",
      enabled: true,
    };

    test("returns error when alarm not found", async () => {
      const sch = makeScheduler();
      const result = await updateAlarm(sch, "missing", { message: "x" });
      expect(result.error).toBeTruthy();
    });

    test("updates message only without rescheduling", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", { message: "New name" });
      expect(result.error).toBeUndefined();
      expect(result.alarm.message).toBe("New name");
      expect(sch.scheduleAlarmCalls).toHaveLength(0);
      expect(sch.cancelAlarmCalls).toHaveLength(0);
    });

    test("rejects empty message", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", { message: "   " });
      expect(result.error).toContain("empty");
    });

    test("reschedules when time changes and alarm enabled", async () => {
      const sch = makeScheduler(baseAlarm);
      // Pick a time string different from current minute to force change.
      const result = await updateAlarm(sch, "a1", { time: "23:59" });
      expect(result.error).toBeUndefined();
      expect(sch.cancelAlarmCalls).toContain("a1");
      expect(sch.scheduleAlarmCalls).toHaveLength(1);
    });

    test("does not reschedule when alarm is disabled", async () => {
      const sch = makeScheduler({ ...baseAlarm, enabled: false });
      const result = await updateAlarm(sch, "a1", { time: "23:59" });
      expect(result.error).toBeUndefined();
      expect(sch.scheduleAlarmCalls).toHaveLength(0);
    });

    test("rejects invalid time format", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", { time: "not-a-time" });
      expect(result.error).toContain("Invalid time");
    });

    test("rejects unknown recurring value", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", { recurring: "yearly" });
      expect(result.error).toContain("Invalid recurring");
    });

    test("changing channelId triggers a reschedule for enabled alarms", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", { channelId: "c2" });
      expect(result.error).toBeUndefined();
      expect(result.alarm.channelId).toBe("c2");
      expect(sch.scheduleAlarmCalls).toHaveLength(1);
    });

    test("empty patch is a no-op", async () => {
      const sch = makeScheduler(baseAlarm);
      const result = await updateAlarm(sch, "a1", {});
      expect(result.error).toBeUndefined();
      expect(result.alarm.message).toBe("Old name");
      expect(sch.scheduleAlarmCalls).toHaveLength(0);
    });
  });
});
