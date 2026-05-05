/**
 * Alarm Formatter — shared embed + UI component builders for alarm system.
 * Used by:  commands/Slash/Alarm/* , buttons/alarm.js , alarmScheduler.js
 *
 * Centralizes ALL visual output: embeds, buttons, select menus.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════
// Date / Label helpers
// ══════════════════════════════════════════════════════════

function formatAlarmDate(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function recurringLabel(recurring) {
  if (recurring === "daily") return "Harian";
  if (recurring === "weekly") return "Mingguan";
  if (recurring === "monthly") return "Bulanan";
  return "Tidak Berulang";
}

function alarmStatus(alarm) {
  const timeLeft = new Date(alarm.time).getTime() - Date.now();
  if (alarm.enabled === false) return "⏸️ Non-aktif";
  if (timeLeft < 0) return "🔔 Terlewat";
  if (timeLeft < 60000) return "🔔 Segera";
  return "⏳ Menunggu";
}

// ══════════════════════════════════════════════════════════
// Embed builders
// ══════════════════════════════════════════════════════════

function buildAlarmField(alarm, index) {
  const unix = Math.floor(new Date(alarm.time).getTime() / 1000);
  const status = alarmStatus(alarm);

  return {
    name: `${status} ${index + 1}. ${alarm.message}`,
    value:
      `⏰ **Waktu**: ${formatAlarmDate(alarm.time)}\n` +
      `🔔 **Channel**: <#${alarm.channelId}>\n` +
      `👥 **Role**: <@&${alarm.roleId}>\n` +
      `🔄 **Jenis**: ${recurringLabel(alarm.recurring)}\n` +
      `⏳ **Countdown**: <t:${unix}:R>\n` +
      `📋 **ID**: ||${alarm.id}||`,
    inline: false,
  };
}

function buildAlarmListEmbed(alarms, color, footerIconURL) {
  const embed = new EmbedBuilder()
    .setTitle("🔔 Daftar Alarm Anda")
    .setColor(color)
    .setFooter({
      text: `${alarms.length} alarm aktif • Gunakan tombol di bawah untuk mengelola`,
      iconURL: footerIconURL,
    })
    .setTimestamp();

  alarms.forEach((alarm, idx) => {
    embed.addFields(buildAlarmField(alarm, idx));
  });

  return embed;
}

function buildAlarmSetEmbed(alarm, color) {
  const unix = Math.floor(new Date(alarm.time).getTime() / 1000);
  const discordTimestamp = `<t:${unix}:R>`;

  let countdownText = `⏳ Countdown: ${discordTimestamp}`;
  if (alarm.recurring !== "none") {
    countdownText = `⏳ Countdown hingga bunyi berikutnya: ${discordTimestamp}`;
  }

  return new EmbedBuilder()
    .setDescription(
      `✅ Alarm "${alarm.message}" berhasil disetel!\n` +
        `⏰ Waktu: ${formatAlarmDate(alarm.time)}\n` +
        `🔔 Akan berbunyi di: <#${alarm.channelId}>\n` +
        `👥 Role yang di-tag: <@&${alarm.roleId}>\n` +
        `🔄 Jenis: ${recurringLabel(alarm.recurring)}\n` +
        `${countdownText}\n` +
        `🗑️ Pesan alarm di channel akan otomatis terhapus setelah 2 jam`,
    )
    .setColor(color);
}

function buildAlarmEditEmbed(alarm, editedBy) {
  const d = new Date(alarm.time);

  return new EmbedBuilder()
    .setTitle("✅ Alarm Berhasil Diupdate")
    .setColor(0x00ff00)
    .addFields(
      { name: "Nama Alarm", value: alarm.name || alarm.message, inline: true },
      {
        name: "Tanggal",
        value: formatAlarmDate(alarm.time).split(" ")[0],
        inline: true,
      },
      {
        name: "Waktu",
        value: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        inline: true,
      },
      { name: "Channel", value: `<#${alarm.channelId}>`, inline: true },
      {
        name: "Role",
        value: alarm.roleId ? `<@&${alarm.roleId}>` : "Tidak ada",
        inline: true,
      },
      { name: "Jenis", value: recurringLabel(alarm.recurring), inline: true },
      { name: "ID", value: alarm.id, inline: true },
    )
    .setFooter({
      text: `Diupdate oleh ${editedBy.tag}`,
      iconURL: editedBy.displayAvatarURL(),
    })
    .setTimestamp();
}

function buildAlarmDetailEmbed(alarm) {
  const d = new Date(alarm.time);

  return new EmbedBuilder()
    .setTitle(`✏️ Edit Alarm: ${alarm.message}`)
    .setColor(0x5865f2)
    .addFields(
      { name: "ID", value: `\`${alarm.id}\``, inline: false },
      { name: "Waktu", value: formatAlarmDate(alarm.time), inline: true },
      { name: "Channel", value: `<#${alarm.channelId}>`, inline: true },
      {
        name: "Role",
        value: alarm.roleId ? `<@&${alarm.roleId}>` : "Tidak ada",
        inline: true,
      },
      { name: "Jenis", value: recurringLabel(alarm.recurring), inline: true },
      {
        name: "Countdown",
        value: `<t:${Math.floor(d.getTime() / 1000)}:R>`,
        inline: true,
      },
    )
    .setDescription(
      "Gunakan command berikut untuk mengedit:\n" +
        `\`/alarm edit id_alarm:${alarm.id}\` + parameter yang ingin diubah`,
    )
    .setFooter({
      text: "Parameter: waktu, nama_alarm, tanggal, role, channel, recurring",
    });
}

// ══════════════════════════════════════════════════════════
// UI Component builders (buttons, select menus)
// ══════════════════════════════════════════════════════════

/** Main alarm panel buttons: Refresh, Batalkan, Edit, On/Off, Tutup */
function buildAlarmButtons(hasAlarms) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("alarm_cancel_select")
      .setLabel("Batalkan")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasAlarms),
    new ButtonBuilder()
      .setCustomId("alarm_edit_select")
      .setLabel("Edit")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasAlarms),
    new ButtonBuilder()
      .setCustomId("alarm_toggle_select")
      .setLabel("On/Off")
      .setEmoji("⏯️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasAlarms),
    new ButtonBuilder()
      .setCustomId("alarm_close")
      .setLabel("Tutup")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary),
  );
}

/** Select menu for picking an alarm (cancel, edit, etc.) */
function buildAlarmSelect(alarms, customId) {
  const options = alarms.slice(0, 25).map((alarm, i) => ({
    label: `${i + 1}. ${alarm.message}`.slice(0, 100),
    description: `Waktu: ${formatAlarmDate(alarm.time)}`.slice(0, 100),
    value: alarm.id,
  }));
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Pilih alarm...")
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

/** Select menu for toggle — shows on/off status per alarm */
function buildAlarmToggleSelect(alarms) {
  const options = alarms.slice(0, 25).map((alarm, i) => {
    const isEnabled = alarm.enabled !== false;
    return {
      label: `${i + 1}. ${alarm.message}`.slice(0, 100),
      description:
        `${isEnabled ? "✅ Aktif" : "⏸️ Non-aktif"} • ${formatAlarmDate(alarm.time)}`.slice(
          0,
          100,
        ),
      value: alarm.id,
    };
  });
  const select = new StringSelectMenuBuilder()
    .setCustomId("alarm_toggle_do")
    .setPlaceholder("Pilih alarm untuk toggle on/off...")
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

/** Single "⬅️ Kembali" button row */
function buildBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("⬅️ Kembali")
      .setStyle(ButtonStyle.Secondary),
  );
}

/** Detail view buttons: Kembali ke Daftar + Tutup */
function buildDetailButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("⬅️ Kembali ke Daftar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("alarm_close")
      .setLabel("❌ Tutup")
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = {
  // Helpers
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
  // Embeds
  buildAlarmField,
  buildAlarmListEmbed,
  buildAlarmSetEmbed,
  buildAlarmEditEmbed,
  buildAlarmDetailEmbed,
  // UI Components
  buildAlarmButtons,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildBackButton,
  buildDetailButtons,
};
