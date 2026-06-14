const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const {
  LIST_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
} = require("./alarmFormatterHelper");

function buildAlarmField(alarm, index) {
  const unix = Math.floor(new Date(alarm.time).getTime() / 1000);
  const status = alarmStatus(alarm);

  return {
    name: `${status} ${index + 1}. ${alarm.message}`,
    value:
      `⏰ **Time**: ${formatAlarmDate(alarm.time)}\n` +
      `🔔 **Channel**: <#${alarm.channelId}>\n` +
      `👥 **Role**: <@&${alarm.roleId}>\n` +
      `🔄 **Type**: ${recurringLabel(alarm.recurring)}\n` +
      `⏳ **Countdown**: <t:${unix}:R>\n` +
      `📋 **ID**: ||${alarm.id}||`,
    inline: false,
  };
}

function buildAlarmListEmbed(alarms, color, footerIconURL, page = 0) {
  const total = totalPages(alarms, LIST_PAGE_SIZE);
  const safePage = clampPage(page, total);
  const pageItems = sliceForPage(alarms, safePage, LIST_PAGE_SIZE);
  const startIdx = safePage * LIST_PAGE_SIZE;

  const footerText =
    `${alarms.length} active alarm(s) • Page ${safePage + 1}/${total}` +
    ` • Use the buttons below to manage`;

  if (alarms.length === 0) {
    return Embeds.withColor(null, color, {
      title: "🔔 Your Alarms",
      description:
        "You don't have any active alarms yet.\n" +
        "Press **➕ New** below to create your first one.",
      footerText,
      footerIcon: footerIconURL,
    });
  }

  const fields = pageItems.map((alarm, idx) =>
    buildAlarmField(alarm, startIdx + idx),
  );

  return Embeds.withColor(null, color, {
    title: "🔔 Your Alarms",
    fields,
    footerText,
    footerIcon: footerIconURL,
  });
}

function buildAlarmSetEmbed(alarm, color) {
  const unix = Math.floor(new Date(alarm.time).getTime() / 1000);
  const discordTimestamp = `<t:${unix}:R>`;

  let countdownText = `⏳ Countdown: ${discordTimestamp}`;
  if (alarm.recurring !== "none") {
    countdownText = `⏳ Countdown to next trigger: ${discordTimestamp}`;
  }

  return Embeds.withColor(null, color, {
    description:
      `✅ Alarm "${alarm.message}" has been set!\n` +
      `⏰ Time: ${formatAlarmDate(alarm.time)}\n` +
      `🔔 Will trigger in: <#${alarm.channelId}>\n` +
      `👥 Role to mention: <@&${alarm.roleId}>\n` +
      `🔄 Type: ${recurringLabel(alarm.recurring)}\n` +
      `${countdownText}\n` +
      `🗑️ The alarm message will be auto-deleted after 2 hours`,
    softCap: false,
  });
}

function buildAlarmEditEmbed(alarm, editedBy) {
  const d = new Date(alarm.time);

  return Embeds.withColor(null, COLORS.SUCCESS, {
    title: "✅ Alarm Updated",
    fields: [
      { name: "Alarm Name", value: alarm.name || alarm.message, inline: true },
      {
        name: "Date",
        value: formatAlarmDate(alarm.time).split(" ")[0],
        inline: true,
      },
      {
        name: "Time",
        value: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        inline: true,
      },
      { name: "Channel", value: `<#${alarm.channelId}>`, inline: true },
      {
        name: "Role",
        value: alarm.roleId ? `<@&${alarm.roleId}>` : "None",
        inline: true,
      },
      { name: "Type", value: recurringLabel(alarm.recurring), inline: true },
      { name: "ID", value: alarm.id, inline: true },
    ],
    footerText: `Updated by ${editedBy.tag}`,
    footerIcon: editedBy.displayAvatarURL(),
  });
}

function buildAlarmDetailEmbed(alarm) {
  const d = new Date(alarm.time);

  return Embeds.withColor(null, COLORS.INFO, {
    title: `✏️ Edit Alarm: ${alarm.message}`,
    description:
      "Use the following command to edit:\n" +
      `\`/alarm edit id_alarm:${alarm.id}\` + the parameter you want to change`,
    fields: [
      { name: "ID", value: `\`${alarm.id}\``, inline: false },
      { name: "Time", value: formatAlarmDate(alarm.time), inline: true },
      { name: "Channel", value: `<#${alarm.channelId}>`, inline: true },
      {
        name: "Role",
        value: alarm.roleId ? `<@&${alarm.roleId}>` : "None",
        inline: true,
      },
      { name: "Type", value: recurringLabel(alarm.recurring), inline: true },
      {
        name: "Countdown",
        value: `<t:${Math.floor(d.getTime() / 1000)}:R>`,
        inline: true,
      },
    ],
    footerText: "Parameters: time, alarm_name, date, role, channel, recurring",
  });
}

module.exports = {
  buildAlarmField,
  buildAlarmListEmbed,
  buildAlarmSetEmbed,
  buildAlarmEditEmbed,
  buildAlarmDetailEmbed,
};
