const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");

module.exports = {
  name: ["alarm", "cancel"],
  description: "Batalkan alarm yang aktif dengan memilih dari daftar",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const alarmScheduler = client.alarmScheduler;
      const alarms = await alarmScheduler.storage.findByUser(
        interaction.user.id,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ Anda tidak memiliki alarm aktif.");
      }

      // Create select menu options
      const options = alarms.map((alarm, index) => {
        const alarmDate = new Date(alarm.time);
        const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

        return {
          label: `${index + 1}. ${alarm.message}`,
          description: `Waktu: ${formattedTime}`,
          value: alarm.id,
        };
      });

      // Create select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("cancel_alarm")
        .setPlaceholder("Pilih alarm untuk dibatalkan")
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      // Send message with select menu
      const response = await interaction.editReply({
        content: "🔔 Pilih alarm yang ingin dibatalkan:",
        components: [row],
      });

      // Create collector for select menu
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000, // 1 minute
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "❌ Ini bukan untuk Anda!",
            ephemeral: true,
          });
        }

        const alarmId = i.values[0];
        const alarmToCancel = alarms.find((a) => a.id === alarmId);

        if (!alarmToCancel) {
          return i.update({
            content: "❌ Alarm tidak ditemukan.",
            components: [],
          });
        }

        // Cancel the alarm
        alarmScheduler.cancelAlarm(alarmId);
        await alarmScheduler.storage.delete(alarmId);

        await i.update({
          content: `✅ Alarm "${alarmToCancel.message}" berhasil dibatalkan.`,
          components: [],
        });
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
          interaction.editReply({
            content: "⏰ Waktu pemilihan alarm habis.",
            components: [],
          });
        }
      });
    } catch (error) {
      console.error("Error in alarm cancel command:", error);
      await interaction.editReply(
        "❌ Terjadi error saat memproses pembatalan alarm.",
      );
    }
  },
};
