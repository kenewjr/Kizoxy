const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const {
  LIST_PAGE_SIZE,
  SELECT_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  formatAlarmDate,
} = require("./alarmFormatterHelper");

function buildAlarmButtons(hasAlarms) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_new")
      .setLabel("New")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("Refresh")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("alarm_cancel_select")
      .setLabel("Cancel")
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
  );
}

function buildAlarmSelect(alarms, customId, page = 0) {
  const total = totalPages(alarms, SELECT_PAGE_SIZE);
  const safePage = clampPage(page, total);
  const pageItems = sliceForPage(alarms, safePage, SELECT_PAGE_SIZE);
  const startIdx = safePage * SELECT_PAGE_SIZE;

  const options = pageItems.map((alarm, i) => ({
    label: `${startIdx + i + 1}. ${alarm.message}`.slice(0, 100),
    description: `Time: ${formatAlarmDate(alarm.time)}`.slice(0, 100),
    value: alarm.id,
  }));
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(
      total > 1
        ? `Select an alarm... (Page ${safePage + 1}/${total})`
        : "Select an alarm...",
    )
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

function buildAlarmToggleSelect(alarms, page = 0) {
  const total = totalPages(alarms, SELECT_PAGE_SIZE);
  const safePage = clampPage(page, total);
  const pageItems = sliceForPage(alarms, safePage, SELECT_PAGE_SIZE);
  const startIdx = safePage * SELECT_PAGE_SIZE;

  const options = pageItems.map((alarm, i) => {
    const isEnabled = alarm.enabled !== false;
    return {
      label: `${startIdx + i + 1}. ${alarm.message}`.slice(0, 100),
      description:
        `${isEnabled ? "✅ Active" : "⏸️ Disabled"} • ${formatAlarmDate(alarm.time)}`.slice(
          0,
          100,
        ),
      value: alarm.id,
    };
  });
  const select = new StringSelectMenuBuilder()
    .setCustomId("alarm_toggle_do")
    .setPlaceholder(
      total > 1
        ? `Select an alarm to toggle... (Page ${safePage + 1}/${total})`
        : "Select an alarm to toggle on/off...",
    )
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

function buildBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("⬅️ Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildDetailButtons(alarm) {
  if (!alarm) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("alarm_refresh")
        .setLabel("⬅️ Back to List")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("alarm_close")
        .setLabel("❌ Close")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  const enabled = alarm.enabled !== false;

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`alarm_edit_modal:${alarm.id}`)
      .setLabel("✏️ Edit Fields")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`alarm_recurring_change:${alarm.id}`)
      .setLabel("🔄 Recurring")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`alarm_detail_toggle:${alarm.id}`)
      .setLabel(enabled ? "⏸️ Disable" : "▶️ Enable")
      .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`alarm_detail_delete:${alarm.id}`)
      .setLabel("🗑️ Delete")
      .setStyle(ButtonStyle.Danger),
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`alarm_detail_channel:${alarm.id}`)
      .setPlaceholder("Change notification channel")
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`alarm_detail_role:${alarm.id}`)
      .setPlaceholder("Change ping role")
      .setMinValues(1)
      .setMaxValues(1),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("⬅️ Back to List")
      .setStyle(ButtonStyle.Secondary),
  );

  return [actionRow, channelRow, roleRow, navRow];
}

function buildRecurringSelectRow(alarmId, current) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`alarm_recurring_set:${alarmId}`)
    .setPlaceholder(`Recurring: ${current}`)
    .addOptions(
      { label: "Non-recurring", value: "none", default: current === "none" },
      { label: "Daily", value: "daily", default: current === "daily" },
      { label: "Weekly", value: "weekly", default: current === "weekly" },
      { label: "Monthly", value: "monthly", default: current === "monthly" },
    );
  return new ActionRowBuilder().addComponents(select);
}

function buildPaginationRow(prefix, page, total) {
  const safePage = clampPage(page, total);
  const onlyOne = total <= 1;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:first:${safePage}`)
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(onlyOne || safePage === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev:${safePage}`)
      .setEmoji("⬅️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(onlyOne || safePage === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}:indicator:${safePage}`)
      .setLabel(`${safePage + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next:${safePage}`)
      .setEmoji("➡️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(onlyOne || safePage >= total - 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:last:${safePage}`)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(onlyOne || safePage >= total - 1),
  );
}

function buildAlarmListComponents(alarms, page = 0) {
  const total = totalPages(alarms, LIST_PAGE_SIZE);
  const hasAlarms = alarms.length > 0;
  const rows = [buildAlarmButtons(hasAlarms)];
  if (total > 1) {
    rows.push(buildPaginationRow("alarm_list_page", page, total));
  }
  return rows;
}

module.exports = {
  buildAlarmButtons,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildBackButton,
  buildDetailButtons,
  buildRecurringSelectRow,
  buildPaginationRow,
  buildAlarmListComponents,
};
