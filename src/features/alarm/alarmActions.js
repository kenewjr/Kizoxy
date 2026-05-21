const { buildAlarmDetailEmbed } = require("./alarmEmbeds");
const {
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildDetailButtons,
  buildRecurringSelectRow,
} = require("./alarmComponents");
const {
  totalPages,
  SELECT_PAGE_SIZE,
  LIST_PAGE_SIZE,
} = require("./alarmFormatterHelper");
const {
  cancelAlarm,
  toggleAlarm,
  createAlarm,
  updateAlarm,
} = require("./alarmService");
const {
  resolvePage,
  parsePaginationId,
  showAlarmList,
  showPaginatedSelect,
  buildNewAlarmModal,
  buildEditAlarmModal,
} = require("./alarmButtonHelper");

function replyNotFound(interaction) {
  return interaction.editReply({
    content: "❌ Alarm not found.",
    embeds: [],
    components: [],
  });
}

function replyNoAlarms(interaction) {
  return interaction.editReply({
    content: "❌ No alarms found.",
    embeds: [],
    components: [],
  });
}

async function fetchOwnedAlarm(scheduler, alarmId, userId, interaction) {
  const alarm = await scheduler.storage.get(alarmId);
  if (!alarm || alarm.userId !== userId) {
    await replyNotFound(interaction);
    return null;
  }
  return alarm;
}

async function handlePagination(ctx) {
  const { interaction, client, scheduler, userId } = ctx;
  const pag = parsePaginationId(interaction.customId);
  if (!pag) return false;
  if (pag.action === "indicator") return true;

  const alarms = await scheduler.storage.findByUser(userId);
  if (!alarms.length) {
    await replyNoAlarms(interaction);
    return true;
  }

  if (pag.prefix === "alarm_list_page") {
    const total = totalPages(alarms, LIST_PAGE_SIZE);
    const nextPage = resolvePage(pag.action, pag.page, total);
    await showAlarmList(interaction, client, userId, "", nextPage);
    return true;
  }

  const total = totalPages(alarms, SELECT_PAGE_SIZE);
  const nextPage = resolvePage(pag.action, pag.page, total);

  const SELECT_FLOWS = {
    alarm_cancel_page: {
      builder: (a, p) => buildAlarmSelect(a, "alarm_cancel_do", p),
      prompt: "🗑️ **Select an alarm to cancel:**",
    },
    alarm_edit_page: {
      builder: (a, p) => buildAlarmSelect(a, "alarm_edit_show", p),
      prompt: "✏️ **Select an alarm to edit:**",
    },
    alarm_toggle_page: {
      builder: (a, p) => buildAlarmToggleSelect(a, p),
      prompt: "⏯️ **Select an alarm to toggle:**",
    },
  };

  const flow = SELECT_FLOWS[pag.prefix];
  if (!flow) return true;

  await showPaginatedSelect({
    interaction,
    alarms,
    selectBuilder: flow.builder,
    pagePrefix: pag.prefix,
    promptText: flow.prompt,
    page: nextPage,
  });
  return true;
}

async function handleNewModal({ interaction }) {
  return interaction.showModal(buildNewAlarmModal());
}

async function handleRefresh({ interaction, client, userId }) {
  return showAlarmList(interaction, client, userId);
}

async function handleClose({ interaction }) {
  return interaction.editReply({
    content: "✅ Alarm panel closed.",
    embeds: [],
    components: [],
  });
}

async function handleOpenCancelPicker({ interaction, scheduler, userId }) {
  const alarms = await scheduler.storage.findByUser(userId);
  if (!alarms.length) return replyNoAlarms(interaction);
  return showPaginatedSelect({
    interaction,
    alarms,
    selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_cancel_do", p),
    pagePrefix: "alarm_cancel_page",
    promptText: "🗑️ **Select an alarm to cancel:**",
    page: 0,
  });
}

async function handleCancelDo({ interaction, client, scheduler, userId }) {
  const alarmId = interaction.values[0];
  const alarm = await fetchOwnedAlarm(scheduler, alarmId, userId, interaction);
  if (!alarm) return;
  await cancelAlarm(scheduler, alarmId);
  return showAlarmList(
    interaction,
    client,
    userId,
    `✅ Alarm **"${alarm.message}"** has been cancelled.`,
  );
}

async function handleOpenEditPicker({ interaction, scheduler, userId }) {
  const alarms = await scheduler.storage.findByUser(userId);
  if (!alarms.length) return replyNoAlarms(interaction);
  return showPaginatedSelect({
    interaction,
    alarms,
    selectBuilder: (a, p) => buildAlarmSelect(a, "alarm_edit_show", p),
    pagePrefix: "alarm_edit_page",
    promptText: "✏️ **Select an alarm to edit:**",
    page: 0,
  });
}

async function handleShowDetail({ interaction, scheduler }) {
  const alarm = await scheduler.storage.get(interaction.values[0]);
  if (!alarm) return replyNotFound(interaction);
  return interaction.editReply({
    content: "",
    embeds: [buildAlarmDetailEmbed(alarm)],
    components: buildDetailButtons(alarm),
  });
}

async function handleOpenTogglePicker({ interaction, scheduler, userId }) {
  const alarms = await scheduler.storage.findByUser(userId);
  if (!alarms.length) return replyNoAlarms(interaction);
  return showPaginatedSelect({
    interaction,
    alarms,
    selectBuilder: (a, p) => buildAlarmToggleSelect(a, p),
    pagePrefix: "alarm_toggle_page",
    promptText: "⏯️ **Select an alarm to toggle:**",
    page: 0,
  });
}

async function handleToggleDo({ interaction, client, scheduler, userId }) {
  const result = await toggleAlarm(scheduler, interaction.values[0]);
  if (result.error) {
    return interaction.editReply({ content: result.error, components: [] });
  }
  if (result.alarm.userId !== userId) {
    return interaction.editReply({
      content: "❌ Alarm is not yours.",
      components: [],
    });
  }
  const msg = `${result.enabled ? "✅" : "⏸️"} Alarm **"${result.alarm.message}"** ${
    result.enabled ? "enabled" : "disabled"
  }.`;
  return showAlarmList(interaction, client, userId, msg);
}

async function handleEditModal({ interaction, scheduler, userId }) {
  const alarmId = interaction.customId.split(":")[1];
  const alarm = await fetchOwnedAlarm(scheduler, alarmId, userId, interaction);
  if (!alarm) return;
  return interaction.showModal(buildEditAlarmModal(alarm));
}

const RECURRING_VALUES = ["none", "daily", "weekly", "monthly"];
function parseRecurring(raw) {
  const value = (raw || "none").trim().toLowerCase();
  return RECURRING_VALUES.includes(value) ? value : "none";
}

async function handleEditSubmit({ interaction, scheduler, userId }) {
  await interaction.deferReply({ ephemeral: true });
  const alarmId = interaction.customId.split(":")[1];
  const existing = await scheduler.storage.get(alarmId);
  if (!existing || existing.userId !== userId) {
    return interaction.editReply({ content: "❌ Alarm not found." });
  }

  const message = interaction.fields.getTextInputValue("alarm_name").trim();
  const time = interaction.fields.getTextInputValue("alarm_time").trim();
  const date = interaction.fields.getTextInputValue("alarm_date").trim();
  const recurring = parseRecurring(
    interaction.fields.getTextInputValue("alarm_recurring"),
  );

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

async function handleRecurringChange({ interaction, scheduler, userId }) {
  const alarmId = interaction.customId.split(":")[1];
  const alarm = await fetchOwnedAlarm(scheduler, alarmId, userId, interaction);
  if (!alarm) return;

  const detailRows = buildDetailButtons(alarm);
  const backRow = Array.isArray(detailRows)
    ? detailRows.slice(-1)
    : [detailRows];

  return interaction.editReply({
    content: "🔄 **Pick a new recurring schedule:**",
    embeds: [buildAlarmDetailEmbed(alarm)],
    components: [
      buildRecurringSelectRow(alarmId, alarm.recurring ?? "none"),
      ...backRow,
    ],
  });
}

async function handleRecurringSet({ interaction, scheduler }) {
  const alarmId = interaction.customId.split(":")[1];
  const value = interaction.values?.[0];
  const result = await updateAlarm(scheduler, alarmId, { recurring: value });
  if (result.error) {
    return interaction.editReply({ content: result.error, components: [] });
  }
  return interaction.editReply({
    content: `🔄 Recurring set to **${value}**.`,
    embeds: [buildAlarmDetailEmbed(result.alarm)],
    components: buildDetailButtons(result.alarm),
  });
}

async function handleDetailToggle({ interaction, scheduler, userId }) {
  const alarmId = interaction.customId.split(":")[1];
  const result = await toggleAlarm(scheduler, alarmId);
  if (result.error) {
    return interaction.editReply({ content: result.error, components: [] });
  }
  if (result.alarm.userId !== userId) {
    return interaction.editReply({
      content: "❌ Alarm is not yours.",
      components: [],
    });
  }
  const fresh = await scheduler.storage.get(alarmId);
  return interaction.editReply({
    content: `${result.enabled ? "✅" : "⏸️"} Alarm ${
      result.enabled ? "enabled" : "disabled"
    }.`,
    embeds: [buildAlarmDetailEmbed(fresh)],
    components: buildDetailButtons(fresh),
  });
}

async function handleDetailDelete({ interaction, client, scheduler, userId }) {
  const alarmId = interaction.customId.split(":")[1];
  const alarm = await fetchOwnedAlarm(scheduler, alarmId, userId, interaction);
  if (!alarm) return;
  await cancelAlarm(scheduler, alarmId);
  return showAlarmList(
    interaction,
    client,
    userId,
    `🗑️ Alarm **"${alarm.message}"** deleted.`,
  );
}

async function handleDetailChannel({ interaction, scheduler }) {
  const alarmId = interaction.customId.split(":")[1];
  const channelId = interaction.values?.[0];
  const result = await updateAlarm(scheduler, alarmId, { channelId });
  if (result.error) {
    return interaction.editReply({ content: result.error, components: [] });
  }
  return interaction.editReply({
    content: `✅ Channel updated to <#${channelId}>.`,
    embeds: [buildAlarmDetailEmbed(result.alarm)],
    components: buildDetailButtons(result.alarm),
  });
}

async function handleDetailRole({ interaction, scheduler }) {
  const alarmId = interaction.customId.split(":")[1];
  const roleId = interaction.values?.[0];
  const result = await updateAlarm(scheduler, alarmId, { roleId });
  if (result.error) {
    return interaction.editReply({ content: result.error, components: [] });
  }
  return interaction.editReply({
    content: `✅ Ping role updated to <@&${roleId}>.`,
    embeds: [buildAlarmDetailEmbed(result.alarm)],
    components: buildDetailButtons(result.alarm),
  });
}

async function handleNewSubmit({ interaction, scheduler, userId }) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.fields.getTextInputValue("alarm_name").trim();
  const time = interaction.fields.getTextInputValue("alarm_time").trim();
  const date = interaction.fields.getTextInputValue("alarm_date")?.trim();
  const recurring = parseRecurring(
    interaction.fields.getTextInputValue("alarm_recurring"),
  );

  const result = await createAlarm(scheduler, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    roleId: null,
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

module.exports = {
  handleNewModal,
  handleRefresh,
  handleClose,
  handleOpenCancelPicker,
  handleCancelDo,
  handleOpenEditPicker,
  handleShowDetail,
  handleOpenTogglePicker,
  handleToggleDo,
  handleNewSubmit,
  handleEditModal,
  handleEditSubmit,
  handleRecurringChange,
  handleRecurringSet,
  handleDetailToggle,
  handleDetailDelete,
  handleDetailChannel,
  handleDetailRole,
  handlePagination,
};
