/**
 * Alarm Button Handler — pure routing logic only.
 * All UI and CRUD logic lives in services/alarm/.
 */

const {
  buildAlarmListEmbed,
  buildAlarmDetailEmbed,
  buildAlarmButtons,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildBackButton,
  buildDetailButtons,
} = require("../services/alarm/alarmFormatter");
const { cancelAlarm, toggleAlarm } = require("../services/alarm/alarmService");
const Logger = require("../utils/logger");
const logger = new Logger("ALARM-BTN");

// ── Helper: show updated alarm list ─────────────────────
async function showAlarmList(interaction, client, userId, statusMsg = "") {
  const alarms = await client.alarmScheduler.storage.findByUser(userId);
  if (alarms.length === 0) {
    return interaction.editReply({ content: statusMsg || "❌ Anda tidak memiliki alarm aktif.", embeds: [], components: [] });
  }
  const embed = buildAlarmListEmbed(alarms, client.color, client.user.displayAvatarURL());
  return interaction.editReply({ content: statusMsg || "", embeds: [embed], components: [buildAlarmButtons(true)] });
}

// ═════════════════════════════════════════════════════════
module.exports = {
  customId: "alarm",
  execute: async (interaction, client) => {
    const action = interaction.customId;
    const userId = interaction.user.id;
    const scheduler = client.alarmScheduler;

    try {
      if (action === "alarm_refresh") return showAlarmList(interaction, client, userId);

      if (action === "alarm_close") return interaction.editReply({ content: "✅ Panel alarm ditutup.", embeds: [], components: [] });

      if (action === "alarm_cancel_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length) return interaction.editReply({ content: "❌ Tidak ada alarm.", embeds: [], components: [] });
        return interaction.editReply({ content: "🗑️ **Pilih alarm yang ingin dibatalkan:**", embeds: [], components: [buildAlarmSelect(alarms, "alarm_cancel_do"), buildBackButton()] });
      }

      if (action === "alarm_cancel_do") {
        const alarm = await scheduler.storage.get(interaction.values[0]);
        if (!alarm || alarm.userId !== userId) return interaction.editReply({ content: "❌ Alarm tidak ditemukan.", components: [] });
        await cancelAlarm(scheduler, interaction.values[0]);
        return showAlarmList(interaction, client, userId, `✅ Alarm **"${alarm.message}"** berhasil dibatalkan!`);
      }

      if (action === "alarm_edit_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length) return interaction.editReply({ content: "❌ Tidak ada alarm.", embeds: [], components: [] });
        return interaction.editReply({ content: "✏️ **Pilih alarm yang ingin diedit:**", embeds: [], components: [buildAlarmSelect(alarms, "alarm_edit_show"), buildBackButton()] });
      }

      if (action === "alarm_edit_show") {
        const alarm = await scheduler.storage.get(interaction.values[0]);
        if (!alarm) return interaction.editReply({ content: "❌ Alarm tidak ditemukan.", components: [] });
        return interaction.editReply({ content: "", embeds: [buildAlarmDetailEmbed(alarm)], components: [buildDetailButtons()] });
      }

      if (action === "alarm_toggle_select") {
        const alarms = await scheduler.storage.findByUser(userId);
        if (!alarms.length) return interaction.editReply({ content: "❌ Tidak ada alarm.", embeds: [], components: [] });
        return interaction.editReply({ content: "⏯️ **Pilih alarm untuk di-toggle:**", embeds: [], components: [buildAlarmToggleSelect(alarms), buildBackButton()] });
      }

      if (action === "alarm_toggle_do") {
        const result = await toggleAlarm(scheduler, interaction.values[0]);
        if (result.error) return interaction.editReply({ content: result.error, components: [] });
        if (result.alarm.userId !== userId) return interaction.editReply({ content: "❌ Alarm bukan milik Anda.", components: [] });
        const msg = `${result.enabled ? "✅" : "⏸️"} Alarm **"${result.alarm.message}"** ${result.enabled ? "diaktifkan" : "dinonaktifkan"}!`;
        return showAlarmList(interaction, client, userId, msg);
      }
    } catch (error) {
      logger.error(`Alarm button error (${action}): ${error.message}`);
      try { await interaction.editReply({ content: "❌ Terjadi error. Silakan coba lagi.", components: [] }); } catch (_) {}
    }
  },
};
