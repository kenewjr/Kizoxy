const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const {
  LIST_PAGE_SIZE,
  SELECT_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
} = require("./alarmFormatterHelper");

// ══════════════════════════════════════════════════════════
// Embed builders
// ══════════════════════════════════════════════════════════

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
    .setColor(0x00ff00)
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
    .setColor(0x5865f2)
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

// ══════════════════════════════════════════════════════════
// UI Component builders (buttons, select menus)
// ══════════════════════════════════════════════════════════
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

/** Select menu for picking an alarm (cancel, edit, etc.) — paginated */
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

/** Select menu for toggle — shows on/off status per alarm, paginated */
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

/** Single "⬅️ Back" button row */
function buildBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("alarm_refresh")
      .setLabel("⬅️ Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Detail view component rows. Returns an array of ActionRow builders ready
 * to spread into editReply({ components }).
 *
 * Layout when called with an alarm:
 *   Row 1: Edit Fields | Recurring | Toggle | Delete
 *   Row 2: Channel select
 *   Row 3: Role select
 *   Row 4: Back to List
 *
 * customIds embed the alarm id so handlers don't need session state.
 * Returns the legacy single nav row when called without an alarm.
 */
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
  const {
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
  } = require("discord.js");

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

/** Build the recurring-change select for the detail flow. */
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

/**
 * Build a pagination navigation row.
 * Disables prev/next when at edges, and disables all when only one page.
 *
 * @param {string} prefix — customId prefix (e.g. "alarm_list_page", "alarm_cancel_page")
 * @param {number} page — current page (0-based)
 * @param {number} total — total number of pages
 */
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

/**
 * Build the full set of components for the alarm list view, including
 * action buttons and a pagination navigation row when there's more than one page.
 */
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
  // Pagination helpers
  LIST_PAGE_SIZE,
  SELECT_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  // Formatters
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
  buildAlarmField,
  buildAlarmListEmbed,
  buildAlarmSetEmbed,
  buildAlarmEditEmbed,
  buildAlarmDetailEmbed,
  // Components
  buildAlarmButtons,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildBackButton,
  buildDetailButtons,
  buildRecurringSelectRow,
  buildPaginationRow,
  buildAlarmListComponents,
};
