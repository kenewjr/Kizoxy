const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: ["alarm", "list"],
  description: "Lihat daftar alarm yang aktif dengan countdown live",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
      const alarmScheduler = client.alarmScheduler;
      const alarms = await alarmScheduler.storage.findByUser(
        interaction.user.id,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ Anda tidak memiliki alarm aktif.");
      }

      // Buat embed dengan countdown
      const embed = new EmbedBuilder()
        .setTitle("🔔 Daftar Alarm Aktif Anda")
        .setColor(client.color)
        .setFooter({
          text: "Countdown akan otomatis update. Klik refresh untuk memperbarui tampilan.",
          iconURL: client.user.displayAvatarURL(),
        });

      // Tambahkan field untuk setiap alarm
      alarms.forEach((alarm) => {
        const alarmDate = new Date(alarm.time);
        const now = new Date();

        // Format waktu untuk display
        const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

        // Hitung waktu tersisa
        const timeLeft = alarmDate.getTime() - now.getTime();

        // Gunakan Discord timestamp untuk countdown otomatis
        const unixTimestamp = Math.floor(alarmDate.getTime() / 1000);
        const discordTimestamp = `<t:${unixTimestamp}:R>`;

        // Tentukan status
        let status = "⏳ Menunggu";
        if (timeLeft < 0) {
          status = "🔔 Terlewat";
        } else if (timeLeft < 60000) {
          status = "🔔 Segera";
        }

        // Tentukan teks berdasarkan jenis pengulangan
        let recurringText = "Tidak Berulang";
        if (alarm.recurring !== "none") {
          recurringText =
            alarm.recurring === "daily"
              ? "Harian"
              : alarm.recurring === "weekly"
                ? "Mingguan"
                : "Bulanan";
        }

        embed.addFields({
          name: `${status} ${alarm.message}`,
          value:
            `⏰ **Waktu**: ${formattedTime}\n` +
            `🔔 **Channel**: <#${alarm.channelId}>\n` +
            `👥 **Role**: <@&${alarm.roleId}>\n` +
            `🔄 **Jenis**: ${recurringText}\n` +
            `⏳ **Countdown**: ${discordTimestamp}\n` +
            `📋 **ID**: ||${alarm.id}||`,
          inline: false,
        });
      });

      // Buat button untuk refresh
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("refresh_alarms")
          .setLabel("🔄 Refresh")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("cancel_alarms")
          .setLabel("❌ Tutup")
          .setStyle(ButtonStyle.Danger),
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Buat collector untuk button
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

        // Handle refresh button
        if (i.customId === "refresh_alarms") {
          try {
            await i.deferUpdate();

            const refreshedAlarms = await alarmScheduler.storage.findByUser(
              i.user.id,
            );

            if (refreshedAlarms.length === 0) {
              await i.editReply({
                content: "❌ Anda tidak memiliki alarm aktif.",
                components: [],
              });
              return;
            }

            // Buat embed baru
            const newEmbed = new EmbedBuilder()
              .setTitle("🔔 Daftar Alarm Aktif Anda (Diperbarui)")
              .setColor(client.color)
              .setFooter({
                text:
                  "Terakhir diperbarui: " +
                  new Date().toLocaleTimeString("id-ID"),
                iconURL: client.user.displayAvatarURL(),
              });

            // Tambahkan field untuk setiap alarm
            refreshedAlarms.forEach((alarm) => {
              const alarmDate = new Date(alarm.time);
              const now = new Date();

              // Format waktu untuk display
              const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

              // Hitung waktu tersisa
              const timeLeft = alarmDate.getTime() - now.getTime();

              // Gunakan Discord timestamp untuk countdown otomatis
              const unixTimestamp = Math.floor(alarmDate.getTime() / 1000);
              const discordTimestamp = `<t:${unixTimestamp}:R>`;

              // Tentukan status
              let status = "⏳ Menunggu";
              if (timeLeft < 0) {
                status = "🔔 Terlewat";
              } else if (timeLeft < 60000) {
                status = "🔔 Segera";
              }

              // Tentukan teks berdasarkan jenis pengulangan
              let recurringText = "Tidak Berulang";
              if (alarm.recurring !== "none") {
                recurringText =
                  alarm.recurring === "daily"
                    ? "Harian"
                    : alarm.recurring === "weekly"
                      ? "Mingguan"
                      : "Bulanan";
              }

              newEmbed.addFields({
                name: `${status} ${alarm.message}`,
                value:
                  `⏰ **Waktu**: ${formattedTime}\n` +
                  `🔔 **Channel**: <#${alarm.channelId}>\n` +
                  `👥 **Role**: <@&${alarm.roleId}>\n` +
                  `🔄 **Jenis**: ${recurringText}\n` +
                  `⏳ **Countdown**: ${discordTimestamp}\n` +
                  `📋 **ID**: ||${alarm.id}||`,
                inline: false,
              });
            });

            await i.editReply({
              embeds: [newEmbed],
              components: [row],
            });
          } catch (error) {
            console.error("Error refreshing alarms:", error);
            await i.editReply({
              content: "❌ Gagal memperbarui daftar alarm.",
              components: [],
            });
          }
        }
        // Handle cancel button
        else if (i.customId === "cancel_alarms") {
          try {
            await i.deferUpdate();
            await i.editReply({
              content: "✅ Daftar alarm ditutup.",
              components: [],
            });
            collector.stop();
          } catch (error) {
            console.error("Error closing alarms:", error);
          }
        }
      });

      collector.on("end", () => {
        // Hapus button ketika collector berakhir
        message.edit({ components: [] }).catch(() => {});
      });
    } catch (error) {
      console.error("Error listing alarms:", error);
      await interaction.editReply(
        "❌ Terjadi error saat mengambil daftar alarm.",
      );
    }
  },
};
