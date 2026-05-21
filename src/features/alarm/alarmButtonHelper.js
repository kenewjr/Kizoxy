const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const {
  buildAlarmListEmbed,
  buildBackButton,
  buildAlarmListComponents,
  buildPaginationRow,
  totalPages,
  clampPage,
  LIST_PAGE_SIZE,
} = require("./alarmFormatter");

const PAGINATION_PREFIXES = [
  "alarm_list_page",
  "alarm_cancel_page",
  "alarm_edit_page",
  "alarm_toggle_page",
];

function resolvePage(action, current, total) {
  let next = current;
  if (action === "first") next = 0;
  else if (action === "prev") next = current - 1;
  else if (action === "next") next = current + 1;
  else if (action === "last") next = total - 1;
  return clampPage(next, total);
}

function parsePaginationId(customId) {
  const parts = customId.split(":");
  if (parts.length < 3) return null;
  const [prefix, action, pageStr] = parts;
  if (!PAGINATION_PREFIXES.includes(prefix)) return null;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page)) return null;
  return { prefix, action, page };
}

async function showAlarmList(
  interaction,
  client,
  userId,
  statusMsg = "",
  page = 0,
) {
  const alarms = await client.alarmScheduler.storage.findByUser(userId);
  const total = totalPages(alarms, LIST_PAGE_SIZE);
  const safePage = clampPage(page, total);
  const embed = buildAlarmListEmbed(
    alarms,
    client.color,
    client.user.displayAvatarURL(),
    safePage,
  );
  return interaction.editReply({
    content: statusMsg || "",
    embeds: [embed],
    components: buildAlarmListComponents(alarms, safePage),
  });
}

async function showPaginatedSelect({
  interaction,
  alarms,
  selectBuilder,
  pagePrefix,
  promptText,
  page = 0,
}) {
  const total = totalPages(
    alarms,
    require("./alarmFormatter").SELECT_PAGE_SIZE,
  );
  const safePage = clampPage(page, total);

  const components = [selectBuilder(alarms, safePage)];
  if (total > 1) {
    components.push(buildPaginationRow(pagePrefix, safePage, total));
  }
  components.push(buildBackButton());

  return interaction.editReply({
    content: promptText,
    embeds: [],
    components,
  });
}

function buildNewAlarmModal() {
  const modal = new ModalBuilder()
    .setCustomId("alarm_new_submit")
    .setTitle("➕ Create New Alarm");

  const inputs = [
    new TextInputBuilder()
      .setCustomId("alarm_name")
      .setLabel("Alarm name")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Wake up")
      .setRequired(true)
      .setMaxLength(80),
    new TextInputBuilder()
      .setCustomId("alarm_time")
      .setLabel("Time (HH:mm, 24h)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("14:30")
      .setRequired(true)
      .setMaxLength(5),
    new TextInputBuilder()
      .setCustomId("alarm_date")
      .setLabel("Date (DD/MM/YYYY, leave empty for today)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("20/05/2026")
      .setRequired(false)
      .setMaxLength(10),
    new TextInputBuilder()
      .setCustomId("alarm_recurring")
      .setLabel("Recurring (none / daily / weekly / monthly)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("none")
      .setRequired(false)
      .setMaxLength(10),
  ];

  modal.addComponents(
    ...inputs.map((i) => new ActionRowBuilder().addComponents(i)),
  );
  return modal;
}

function buildEditAlarmModal(alarm) {
  const d = new Date(alarm.time);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  const modal = new ModalBuilder()
    .setCustomId(`alarm_edit_submit:${alarm.id}`)
    .setTitle("✏️ Edit Alarm");

  const inputs = [
    new TextInputBuilder()
      .setCustomId("alarm_name")
      .setLabel("Alarm name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(80)
      .setValue(alarm.message ?? ""),
    new TextInputBuilder()
      .setCustomId("alarm_time")
      .setLabel("Time (HH:mm, 24h)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(5)
      .setValue(`${hh}:${mi}`),
    new TextInputBuilder()
      .setCustomId("alarm_date")
      .setLabel("Date (DD/MM/YYYY)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10)
      .setValue(`${dd}/${mm}/${yyyy}`),
    new TextInputBuilder()
      .setCustomId("alarm_recurring")
      .setLabel("Recurring (none / daily / weekly / monthly)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(10)
      .setValue(alarm.recurring ?? "none"),
  ];

  modal.addComponents(
    ...inputs.map((i) => new ActionRowBuilder().addComponents(i)),
  );
  return modal;
}

module.exports = {
  PAGINATION_PREFIXES,
  resolvePage,
  parsePaginationId,
  showAlarmList,
  showPaginatedSelect,
  buildNewAlarmModal,
  buildEditAlarmModal,
};
