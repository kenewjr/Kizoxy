const { EmbedBuilder } = require("discord.js");
const { COLORS } = require("../../lib/embeds");
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

  const embed = new EmbedBuilder()
    .setTitle("🔔 Your Alarms")
    .setColor(color)
    .setFooter({
      text:
        `${alarms.length} active alarm(s) • Page ${safePage + 1}/${total}` +
        ` • Use the buttons below to manage`,
      iconURL: footerIconURL,
    })
    .setTimestamp();

  if (alarms.length === 0) {
    embed.setDescription(
      "You don't have any active alarms yet.\n" +
        "Press **➕ New** below to create your first one.",
    );
    return embed;
  }

  pageItems.forEach((alarm, idx) => {
    embed.addFields(buildAlarmField(alarm, startIdx + idx));
  });

  return embed;
}

function buildAlarmSetEmbed(alarm, color) {
  const unix = Math.floor(new Date(alarm.time).getTime() / 1000);
  const discordTimestamp = `<t:${unix}:R>`;

  let countdownText = `⏳ Countdown: ${discordTimestamp}`;
  if (alarm.recurring !== "none") {
    countdownText = `⏳ Countdown to next trigger: ${discordTimestamp}`;
  }

  return new EmbedBuilder()
    .setDescription(
      `✅ Alarm "${alarm.message}" has been set!\n` +
        `⏰ Time: ${formatAlarmDate(alarm.time)}\n` +
        `🔔 Will trigger in: <#${alarm.channelId}>\n` +
        `👥 Role to mention: <@&${alarm.roleId}>\n` +
        `🔄 Type: ${recurringLabel(alarm.recurring)}\n` +
        `${countdownText}\n` +
        `🗑️ The alarm message will be auto-deleted after 2 hours`,
    )
    .setColor(color);
}

function buildAlarmEditEmbed(alarm, editedBy) {
  const d = new Date(alarm.time);

  return new EmbedBuilder()
    .setTitle("✅ Alarm Updated")
    .setColor(COLORS.SUCCESS)
    .addFields(
      {
        name: "Alarm Name",
        value: alarm.name || alarm.message,
        inline: true,
      },
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
    )
    .setFooter({
      text: `Updated by ${editedBy.tag}`,
      iconURL: editedBy.displayAvatarURL(),
    })
    .setTimestamp();
}

function buildAlarmDetailEmbed(alarm) {
  const d = new Date(alarm.time);

  return new EmbedBuilder()
    .setTitle(`✏️ Edit Alarm: ${alarm.message}`)
    .setColor(COLORS.INFO)
    .addFields(
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
    )
    .setDescription(
      "Use the following command to edit:\n" +
        `\`/alarm edit id_alarm:${alarm.id}\` + the parameter you want to change`,
    )
    .setFooter({
      text: "Parameters: time, alarm_name, date, role, channel, recurring",
    });
}

module.exports = {
  buildAlarmField,
  buildAlarmListEmbed,
  buildAlarmSetEmbed,
  buildAlarmEditEmbed,
  buildAlarmDetailEmbed,
};
