const {
  buildAlarmDetailEmbed,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildAlarmListComponents,
  buildDetailButtons,
  buildRecurringSelectRow,
  totalPages,
  SELECT_PAGE_SIZE,
  LIST_PAGE_SIZE,
} = require("../services/alarm/alarmFormatter");
const {
  cancelAlarm,
  toggleAlarm,
  createAlarm,
  updateAlarm,
} = require("../services/alarm/alarmService");
const {
  resolvePage,
  parsePaginationId,
  showAlarmList,
  showPaginatedSelect,
  buildNewAlarmModal,
  buildEditAlarmModal,
} = require("../utils/helpers/alarmButtonHelper");
const Logger = require("../utils/logger");
const logger = new Logger("ALARM-BTN");


// ═════════════════════════════════════════════════════════
module.exports = {
  customId: "alarm",
  execute: async (interaction, client) => {
    const action = interaction.customId;
    const userId = interaction.user.id;
    const scheduler = client.alarmScheduler;

    try {
      // ── Pagination buttons ─────────────────────────────
      const pag = parsePaginationId(action);
      if (pag) {
        // Indicator button is disabled, but guard anyway
        if (pag.action === "indicator") return;

        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length) {
          return interaction.editReply({
            content: "❌ No alarms found.",
            embeds: [],
            components: [],
          });
        }

        if (pag.prefix === "alarm_list_page") {
          const total = totalPages(alarms, LIST_PAGE_SIZE);
          const nextPage = resolvePage(pag.action, pag.page, total);
          return showAlarmList(interaction, client, userId, "", nextPage);
        }

        const total = totalPages(alarms, SELECT_PAGE_SIZE);
        const nextPage = resolvePage(pag.action, pag.page, total);

        if (pag.prefix === "alarm_cancel_page") {
          return showPaginatedSelect({
            interaction,
            alarms,
            selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_cancel_do", p),
            pagePrefix: "alarm_cancel_page",
            promptText: "🗑️ **Select an alarm to cancel:**",
            page: nextPage,
          });
        }

        if (pag.prefix === "alarm_edit_page") {
          return showPaginatedSelect({
            interaction,
            alarms,
            selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_edit_show", p),
            pagePrefix: "alarm_edit_page",
            promptText: "✏️ **Select an alarm to edit:**",
            page: nextPage,
          });
        }

        if (pag.prefix === "alarm_toggle_page") {
          return showPaginatedSelect({
            interaction,
            alarms,
            selectBuilder: (a, p) => buildAlarmToggleSelect(a, p),
            pagePrefix: "alarm_toggle_page",
            promptText: "⏯️ **Select an alarm to toggle:**",
            page: nextPage,
          });
        }
        return;
      }

      // ── Standard actions ────────────────────────────────────
      if (action === "alarm_new") {
        await interaction.showModal(buildNewAlarmModal());
        return;
      }

      if (action === "alarm_refresh")
        return showAlarmList(interaction, client, userId);

      if (action === "alarm_close")
        return interaction.editReply({
          content: "✅ Alarm panel closed.",
          embeds: [],
          components: [],
        });

      if (action === "alarm_cancel_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length)
          return interaction.editReply({
            content: "❌ No alarms found.",
            embeds: [],
            components: [],
          });
        return showPaginatedSelect({
          interaction,
          alarms,
          selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_cancel_do", p),
          pagePrefix: "alarm_cancel_page",
          promptText: "🗑️ **Select an alarm to cancel:**",
          page: 0,
        });
      }

      if (action === "alarm_cancel_do") {
        const alarm = await scheduler.storage.get(interaction.values[0]);
        if (!alarm || alarm.userId !== userId)
          return interaction.editReply({
            content: "❌ Alarm not found.",
            components: [],
          });
        await cancelAlarm(scheduler, interaction.values[0]);
        return showAlarmList(
          interaction,
          client,
          userId,
          `✅ Alarm **"${alarm.message}"** has been cancelled.`,
        );
      }

      if (action === "alarm_edit_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length)
          return interaction.editReply({
            content: "❌ No alarms found.",
            embeds: [],
            components: [],
          });
        return showPaginatedSelect({
          interaction,
          alarms,
          selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_edit_show", p),
          pagePrefix: "alarm_edit_page",
          promptText: "✏️ **Select an alarm to edit:**",
          page: 0,
        });
      }

      if (action === "alarm_edit_show") {
        const alarm = await scheduler.storage.get(interaction.values[0]);
        if (!alarm)
          return interaction.editReply({
            content: "❌ Alarm not found.",
            components: [],
          });
        return interaction.editReply({
          content: "",
          embeds: [buildAlarmDetailEmbed(alarm)],
          components: buildDetailButtons(alarm),
        });
      }

      if (action === "alarm_toggle_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length)
          return interaction.editReply({
            content: "❌ No alarms found.",
            embeds: [],
            components: [],
          });
        return showPaginatedSelect({
          interaction,
          alarms,
          selectBuilder: (a, p) => buildAlarmToggleSelect(a, p),
          pagePrefix: "alarm_toggle_page",
          promptText: "⏯️ **Select an alarm to toggle:**",
          page: 0,
        });
      }

      if (action === "alarm_toggle_do") {
        const result = await toggleAlarm(scheduler, interaction.values[0]);
        if (result.error)
          return interaction.editReply({
            content: result.error,
            components: [],
          });
        if (result.alarm.userId !== userId)
          return interaction.editReply({
            content: "❌ Alarm is not yours.",
            components: [],
          });
        const msg = `${result.enabled ? "✅" : "⏸️"} Alarm **"${result.alarm.message}"** ${result.enabled ? "enabled" : "disabled"}.`;
        return showAlarmList(interaction, client, userId, msg);
      }

      // ── Detail-view dynamic actions ─────────────────────
      // All of these use customId format: "<verb>:<alarmId>"

      // Show the edit modal pre-filled with current values.
      if (action.startsWith("alarm_edit_modal:")) {
        const alarmId = action.split(":")[1];
        const alarm = await scheduler.storage.get(alarmId);
        if (!alarm || alarm.userId !== userId) {
          return interaction.editReply({
            content: "❌ Alarm not found.",
            components: [],
          });
        }
        await interaction.showModal(buildEditAlarmModal(alarm));
        return;
      }

      // Modal submit for the edit flow.
      if (action.startsWith("alarm_edit_submit:")) {
        await interaction.deferReply({ ephemeral: true });
        const alarmId = action.split(":")[1];
        const existing = await scheduler.storage.get(alarmId);
        if (!existing || existing.userId !== userId) {
          return interaction.editReply({ content: "❌ Alarm not found." });
        }

        const message = interaction.fields
          .getTextInputValue("alarm_name")
          .trim();
        const time = interaction.fields
          .getTextInputValue("alarm_time")
          .trim();
        const date = interaction.fields
          .getTextInputValue("alarm_date")
          .trim();
        const recurringRaw = (
          interaction.fields.getTextInputValue("alarm_recurring") || "none"
        )
          .trim()
          .toLowerCase();
        const recurring = ["none", "daily", "weekly", "monthly"].includes(
          recurringRaw,
        )
          ? recurringRaw
          : "none";

        const result = await updateAlarm(scheduler, alarmId, {
          message,
          time,
          date,
          recurring,
        });
        if (result.error) {
          return interaction.editReply({ content: result.error });
        }
        return interaction.editReply({
          content: `✅ Alarm **"${result.alarm.message}"** updated. Run \`/alarm\` to see the panel.`,
        });
      }

      // Show the recurring-change select on the detail message.
      if (action.startsWith("alarm_recurring_change:")) {
        const alarmId = action.split(":")[1];
        const alarm = await scheduler.storage.get(alarmId);
        if (!alarm || alarm.userId !== userId) {
          return interaction.editReply({
            content: "❌ Alarm not found.",
            components: [],
          });
        }
        return interaction.editReply({
          content: "🔄 **Pick a new recurring schedule:**",
          embeds: [buildAlarmDetailEmbed(alarm)],
          components: [
            buildRecurringSelectRow(alarmId, alarm.recurring ?? "none"),
            ...[buildDetailButtons(alarm)].flat().slice(-1), // back button only
          ],
        });
      }

      // Apply recurring select.
      if (action.startsWith("alarm_recurring_set:")) {
        const alarmId = action.split(":")[1];
        const value = interaction.values?.[0];
        const result = await updateAlarm(scheduler, alarmId, {
          recurring: value,
        });
        if (result.error) {
          return interaction.editReply({
            content: result.error,
            components: [],
          });
        }
        return interaction.editReply({
          content: `🔄 Recurring set to **${value}**.`,
          embeds: [buildAlarmDetailEmbed(result.alarm)],
          components: buildDetailButtons(result.alarm),
        });
      }

      // Toggle from the detail view.
      if (action.startsWith("alarm_detail_toggle:")) {
        const alarmId = action.split(":")[1];
        const result = await toggleAlarm(scheduler, alarmId);
        if (result.error) {
          return interaction.editReply({
            content: result.error,
            components: [],
          });
        }
        if (result.alarm.userId !== userId) {
          return interaction.editReply({
            content: "❌ Alarm is not yours.",
            components: [],
          });
        }
        const fresh = await scheduler.storage.get(alarmId);
        return interaction.editReply({
          content: `${result.enabled ? "✅" : "⏸️"} Alarm ${result.enabled ? "enabled" : "disabled"}.`,
          embeds: [buildAlarmDetailEmbed(fresh)],
          components: buildDetailButtons(fresh),
        });
      }

      // Delete from the detail view (no second-step confirmation per spec).
      if (action.startsWith("alarm_detail_delete:")) {
        const alarmId = action.split(":")[1];
        const alarm = await scheduler.storage.get(alarmId);
        if (!alarm || alarm.userId !== userId) {
          return interaction.editReply({
            content: "❌ Alarm not found.",
            components: [],
          });
        }
        await cancelAlarm(scheduler, alarmId);
        return showAlarmList(
          interaction,
          client,
          userId,
          `🗑️ Alarm **"${alarm.message}"** deleted.`,
        );
      }

      // Change notification channel via channel-select menu.
      if (action.startsWith("alarm_detail_channel:")) {
        const alarmId = action.split(":")[1];
        const channelId = interaction.values?.[0];
        const result = await updateAlarm(scheduler, alarmId, { channelId });
        if (result.error) {
          return interaction.editReply({
            content: result.error,
            components: [],
          });
        }
        return interaction.editReply({
          content: `✅ Channel updated to <#${channelId}>.`,
          embeds: [buildAlarmDetailEmbed(result.alarm)],
          components: buildDetailButtons(result.alarm),
        });
      }

      // Change ping role via role-select menu.
      if (action.startsWith("alarm_detail_role:")) {
        const alarmId = action.split(":")[1];
        const roleId = interaction.values?.[0];
        const result = await updateAlarm(scheduler, alarmId, { roleId });
        if (result.error) {
          return interaction.editReply({
            content: result.error,
            components: [],
          });
        }
        return interaction.editReply({
          content: `✅ Ping role updated to <@&${roleId}>.`,
          embeds: [buildAlarmDetailEmbed(result.alarm)],
          components: buildDetailButtons(result.alarm),
        });
      }

      // ── Modal submission: create new alarm ─────────────
      if (action === "alarm_new_submit") {
        await interaction.deferReply({ ephemeral: true });

        const name = interaction.fields.getTextInputValue("alarm_name").trim();
        const time = interaction.fields.getTextInputValue("alarm_time").trim();
        const date = interaction.fields
          .getTextInputValue("alarm_date")
          ?.trim();
        const recurringRaw = (
          interaction.fields.getTextInputValue("alarm_recurring") || "none"
        )
          .trim()
          .toLowerCase();
        const recurring = ["none", "daily", "weekly", "monthly"].includes(
          recurringRaw,
        )
          ? recurringRaw
          : "none";

        const result = await createAlarm(scheduler, {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          roleId: interaction.guild.roles.everyone.id,
          userId,
          message: name,
          time,
          date: date || undefined,
          recurring,
        });

        if (result.error) {
          return interaction.editReply({ content: result.error });
        }

        return interaction.editReply({
          content: `✅ Alarm **"${name}"** created. Run \`/alarm\` again to see the panel.`,
        });
      }
    } catch (error) {
      logger.error(`Alarm button error (${action}): ${error.message}`);
      try {
        await interaction.editReply({
          content: "❌ An error occurred. Please try again.",
          components: [],
        });
      } catch (_) {}
    }
  },
};
