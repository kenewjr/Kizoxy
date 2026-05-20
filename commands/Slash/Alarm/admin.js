const {
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  buildPaginationRow,
  totalPages,
  clampPage,
} = require("../../../services/alarm/alarmFormatter");
const Logger = require("../../../utils/logger");
const logger = new Logger("ALARM");

// Pagination: 3 user-groups per page (each user can have multiple alarms)
const ADMIN_PAGE_SIZE = 3;
const ADMIN_PAGINATION_PREFIX = "admin_alarm_page";

/**
 * Group alarms by user, return array of [userId, alarms[]] tuples (stable order).
 */
function groupAlarmsByUser(alarms) {
  const grouped = {};
  for (const alarm of alarms) {
    if (!grouped[alarm.userId]) grouped[alarm.userId] = [];
    grouped[alarm.userId].push(alarm);
  }
  return Object.entries(grouped);
}

function formatAlarmTime(time) {
  const d = new Date(time);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

/**
 * Build admin embed for a given page.
 */
async function buildAdminEmbed(client, guild, alarms, page, refreshed = false) {
  const groups = groupAlarmsByUser(alarms);
  const total = totalPages(groups, ADMIN_PAGE_SIZE);
  const safePage = clampPage(page, total);
  const start = safePage * ADMIN_PAGE_SIZE;
  const pageGroups = groups.slice(start, start + ADMIN_PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(
      `🔔 All Alarms in ${guild.name}${refreshed ? " (Refreshed)" : ""}`,
    )
    .setColor(0x0099ff)
    .setFooter({
      text:
        `Total: ${alarms.length} alarm dari ${groups.length} member` +
        ` • Halaman ${safePage + 1}/${total}` +
        (refreshed
          ? ` • Refreshed: ${new Date().toLocaleTimeString("en-US")}`
          : ""),
      iconURL: guild.iconURL(),
    })
    .setTimestamp();

  for (const [userId, userAlarms] of pageGroups) {
    let userInfo;
    try {
      const user = await client.users.fetch(userId);
      userInfo = `${user.tag} (${user.id})`;
    } catch (_error) {
      logger.warning(`User ${userId} not found, but alarms exist`);
      embed.addFields({
        name: `👤 User Not Found (${userId}) - ${userAlarms.length} alarm(s)`,
        value: "⚠️ User may have left the server",
        inline: false,
      });
      continue;
    }

    let alarmList = "";
    userAlarms.forEach((alarm, index) => {
      const formattedTime = formatAlarmTime(alarm.time);
      alarmList += `**${index + 1}. ${alarm.message}**\n`;
      alarmList += `⏰ ${formattedTime} | 🔔 <#${alarm.channelId}> | 👥 <@&${alarm.roleId}>\n`;
      alarmList += `🔄 ${alarm.recurring === "none" ? "Non-recurring" : alarm.recurring} | 📋 ${alarm.id}\n\n`;
    });

    embed.addFields({
      name: `👤 ${userInfo} - ${userAlarms.length} alarm`,
      value: alarmList || "_(kosong)_",
      inline: false,
    });
  }

  return { embed, total, safePage };
}

function buildAdminControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("refresh_admin_alarms")
      .setLabel("🔄 Refresh")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("cancel_admin_alarms")
      .setLabel("❌ Close")
      .setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  name: ["alarmadmin"],
  description: "View all alarms in the server (Admin only)",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator,
        )
      ) {
        return interaction.editReply(
          "❌ You need Administrator permission to use this command.",
        );
      }

      const alarmScheduler = client.alarmScheduler;
      const alarms = await alarmScheduler.storage.findByGuild(
        interaction.guildId,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ No active alarms in this server.");
      }

      let currentPage = 0;
      const { embed, total } = await buildAdminEmbed(
        client,
        interaction.guild,
        alarms,
        currentPage,
      );

      const components = [buildAdminControlRow()];
      if (total > 1) {
        components.push(
          buildPaginationRow(ADMIN_PAGINATION_PREFIX, currentPage, total),
        );
      }

      const message = await interaction.editReply({
        embeds: [embed],
        components,
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 menit
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "❌ This is not for you!",
            ephemeral: true,
          });
        }

        // Pagination handling
        if (i.customId.startsWith(`${ADMIN_PAGINATION_PREFIX}:`)) {
          await i.deferUpdate();
          const [, action, pageStr] = i.customId.split(":");
          if (action === "indicator") return;

          const refreshedAlarms = await alarmScheduler.storage.findByGuild(
            interaction.guildId,
          );
          if (refreshedAlarms.length === 0) {
            return i.editReply({
              content: "❌ No active alarms in this server.",
              embeds: [],
              components: [],
            });
          }

          const groups = groupAlarmsByUser(refreshedAlarms);
          const totalPagesNow = totalPages(groups, ADMIN_PAGE_SIZE);
          const cur = parseInt(pageStr, 10) || 0;
          let target = cur;
          if (action === "first") target = 0;
          else if (action === "prev") target = cur - 1;
          else if (action === "next") target = cur + 1;
          else if (action === "last") target = totalPagesNow - 1;
          currentPage = clampPage(target, totalPagesNow);

          const result = await buildAdminEmbed(
            client,
            interaction.guild,
            refreshedAlarms,
            currentPage,
          );
          const newComponents = [buildAdminControlRow()];
          if (result.total > 1) {
            newComponents.push(
              buildPaginationRow(
                ADMIN_PAGINATION_PREFIX,
                result.safePage,
                result.total,
              ),
            );
          }
          return i.editReply({
            embeds: [result.embed],
            components: newComponents,
          });
        }

        if (i.customId === "refresh_admin_alarms") {
          await i.deferUpdate();

          const refreshedAlarms = await alarmScheduler.storage.findByGuild(
            interaction.guildId,
          );

          if (refreshedAlarms.length === 0) {
            return i.editReply({
              content: "❌ No active alarms in this server.",
              embeds: [],
              components: [],
            });
          }

          const result = await buildAdminEmbed(
            client,
            interaction.guild,
            refreshedAlarms,
            currentPage,
            true,
          );
          currentPage = result.safePage;

          const newComponents = [buildAdminControlRow()];
          if (result.total > 1) {
            newComponents.push(
              buildPaginationRow(
                ADMIN_PAGINATION_PREFIX,
                result.safePage,
                result.total,
              ),
            );
          }

          return i.editReply({
            embeds: [result.embed],
            components: newComponents,
          });
        }

        if (i.customId === "cancel_admin_alarms") {
          await i.deferUpdate();
          await i.editReply({
            content: "✅ Admin alarm list closed.",
            embeds: [],
            components: [],
          });
          collector.stop();
        }
      });

      collector.on("end", () => {
        message.edit({ components: [] }).catch(() => {});
      });
    } catch (error) {
      logger.error(`Error in admin alarm list: ${error.message}`);
      await interaction.editReply(
        "❌ An error occurred while fetching the admin alarm list.",
      );
    }
  },
};
