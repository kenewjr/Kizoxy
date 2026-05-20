const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const {
  buildAlarmListEmbed,
  buildAlarmDetailEmbed,
  buildAlarmSelect,
  buildAlarmToggleSelect,
  buildBackButton,
  buildDetailButtons,
  buildAlarmListComponents,
  buildPaginationRow,
  totalPages,
  clampPage,
  SELECT_PAGE_SIZE,
  LIST_PAGE_SIZE,
} = require("../services/alarm/alarmFormatter");
const {
  cancelAlarm,
  toggleAlarm,
  createAlarm,
} = require("../services/alarm/alarmService");
const Logger = require("../utils/logger");
const logger = new Logger("ALARM-BTN");

// ── Pagination customId conventions ─────────────────────
// Format: <prefix>:<action>:<currentPage>
//   prefix: alarm_list_page | alarm_cancel_page | alarm_edit_page | alarm_toggle_page
//   action: first | prev | next | last | indicator
const PAGINATION_PREFIXES = [
  "alarm_list_page",
  "alarm_cancel_page",
  "alarm_edit_page",
  "alarm_toggle_page",
];

/** Resolve target page based on action and current page */
function resolvePage(action, current, total) {
  let next = current;
  if (action === "first") next = 0;
  else if (action === "prev") next = current - 1;
  else if (action === "next") next = current + 1;
  else if (action === "last") next = total - 1;
  return clampPage(next, total);
}

/** Parse a pagination customId. Returns null if not a pagination ID. */
function parsePaginationId(customId) {
  const parts = customId.split(":");
  if (parts.length < 3) return null;
  const [prefix, action, pageStr] = parts;
  if (!PAGINATION_PREFIXES.includes(prefix)) return null;
  const page = parseInt(pageStr, 10);
  if (Number.isNaN(page)) return null;
  return { prefix, action, page };
}

// ── Helper: show updated alarm list (paginated) ─────────
async function showAlarmList(
  interaction,
  client,
  userId,
  statusMsg = "",
  page = 0,
) {
  const alarms = await client.alarmScheduler.storage.findByUser(userId);
  if (alarms.length === 0) {
    return interaction.editReply({
      content: statusMsg || "❌ You don't have any active alarms.",
      embeds: [],
      components: [],
    });
  }
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

// ── Helper: show paginated select menu (cancel/edit/toggle) ──
async function showPaginatedSelect({
  interaction,
  alarms,
  selectBuilder,
  pagePrefix,
  promptText,
  page = 0,
}) {
  const total = totalPages(alarms, SELECT_PAGE_SIZE);
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

      // ── Standard actions ───────────────────────────────
      if (action === "alarm_new") {
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
        await interaction.showModal(modal);
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
          components: [buildDetailButtons()],
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
