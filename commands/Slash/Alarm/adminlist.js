const {
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const Logger = require("../../../utils/logger");
const logger = new Logger("ALARM");

module.exports = {
  name: ["alarm", "adminlist"],
  description: "Lihat semua alarm di server (Admin only)",
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
          "❌ Anda memerlukan permission Administrator untuk menggunakan command ini.",
        );
      }

      const alarmScheduler = client.alarmScheduler;

      const alarms = await alarmScheduler.storage.findByGuild(
        interaction.guildId,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ Tidak ada alarm aktif di server ini.");
      }

      const alarmsByUser = {};
      alarms.forEach((alarm) => {
        if (!alarmsByUser[alarm.userId]) {
          alarmsByUser[alarm.userId] = [];
        }
        alarmsByUser[alarm.userId].push(alarm);
      });

      const embed = new EmbedBuilder()
        .setTitle(`🔔 Semua Alarm di ${interaction.guild.name}`)
        .setColor(0x0099ff)
        .setFooter({
          text: `Total: ${alarms.length} alarm dari ${Object.keys(alarmsByUser).length} member`,
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      for (const [userId, userAlarms] of Object.entries(alarmsByUser)) {
        try {
          const user = await client.users.fetch(userId);
          const userInfo = `${user.tag} (${user.id})`;

          let alarmList = "";
          userAlarms.forEach((alarm, index) => {
            const alarmDate = new Date(alarm.time);
            const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

            alarmList += `**${index + 1}. ${alarm.message}**\n`;
            alarmList += `⏰ ${formattedTime} | 🔔 <#${alarm.channelId}> | 👥 <@&${alarm.roleId}>\n`;
            alarmList += `🔄 ${alarm.recurring === "none" ? "Tidak Berulang" : alarm.recurring} | 📋 ${alarm.id}\n\n`;
          });

          embed.addFields({
            name: `👤 ${userInfo} - ${userAlarms.length} alarm`,
            value: alarmList,
            inline: false,
          });
        } catch (_error) {
          logger.warning(`User ${userId} not found, but alarms exist`);
          embed.addFields({
            name: `👤 User Tidak Ditemukan (${userId}) - ${userAlarms.length} alarm`,
            value: "⚠️ User mungkin sudah meninggalkan server",
            inline: false,
          });
        }
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("refresh_admin_alarms")
          .setLabel("🔄 Refresh")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("cancel_admin_alarms")
          .setLabel("❌ Tutup")
          .setStyle(ButtonStyle.Danger),
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 menit
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "❌ Ini bukan untuk Anda!",
            ephemeral: true,
          });
        }

        if (i.customId === "refresh_admin_alarms") {
          await i.deferUpdate();

          const refreshedAlarms = await alarmScheduler.storage.findByGuild(
            interaction.guildId,
          );

          if (refreshedAlarms.length === 0) {
            await i.editReply({
              content: "❌ Tidak ada alarm aktif di server ini.",
              components: [],
            });
            return;
          }

          const newEmbed = new EmbedBuilder()
            .setTitle(
              `🔔 Semua Alarm di ${interaction.guild.name} (Diperbarui)`,
            )
            .setColor(0x0099ff)
            .setFooter({
              text: `Total: ${refreshedAlarms.length} alarm | Terakhir diperbarui: ${new Date().toLocaleTimeString("id-ID")}`,
              iconURL: interaction.guild.iconURL(),
            })
            .setTimestamp();

          const refreshedAlarmsByUser = {};
          refreshedAlarms.forEach((alarm) => {
            if (!refreshedAlarmsByUser[alarm.userId]) {
              refreshedAlarmsByUser[alarm.userId] = [];
            }
            refreshedAlarmsByUser[alarm.userId].push(alarm);
          });

          for (const [userId, userAlarms] of Object.entries(
            refreshedAlarmsByUser,
          )) {
            try {
              const user = await client.users.fetch(userId);
              const userInfo = `${user.tag} (${user.id})`;

              let alarmList = "";
              userAlarms.forEach((alarm, index) => {
                const alarmDate = new Date(alarm.time);
                const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

                alarmList += `**${index + 1}. ${alarm.message}**\n`;
                alarmList += `⏰ ${formattedTime} | 🔔 <#${alarm.channelId}> | 👥 <@&${alarm.roleId}>\n`;
                alarmList += `🔄 ${alarm.recurring === "none" ? "Tidak Berulang" : alarm.recurring} | 📋 ${alarm.id}\n\n`;
              });

              newEmbed.addFields({
                name: `👤 ${userInfo} - ${userAlarms.length} alarm`,
                value: alarmList,
                inline: false,
              });
            } catch (_error) {
              newEmbed.addFields({
                name: `👤 User Tidak Ditemukan (${userId}) - ${userAlarms.length} alarm`,
                value: "⚠️ User mungkin sudah meninggalkan server",
                inline: false,
              });
            }
          }

          await i.editReply({
            embeds: [newEmbed],
            components: [row],
          });
        } else if (i.customId === "cancel_admin_alarms") {
          await i.deferUpdate();
          await i.editReply({
            content: "✅ Daftar alarm admin ditutup.",
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
        "❌ Terjadi error saat mengambil daftar alarm admin.",
      );
    }
  },
};
