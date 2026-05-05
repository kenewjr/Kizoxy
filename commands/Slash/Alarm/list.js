const {
  buildAlarmListEmbed,
  buildAlarmButtons,
} = require("../../../services/alarm/alarmFormatter");

module.exports = {
  name: ["alarm", "list"],
  description: "Lihat daftar alarm yang aktif dengan panel kontrol",
  category: "Alarm",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
      const alarms = await client.alarmScheduler.storage.findByUser(
        interaction.user.id,
      );

      if (alarms.length === 0) {
        return interaction.editReply("❌ Anda tidak memiliki alarm aktif.");
      }

      const embed = buildAlarmListEmbed(
        alarms,
        client.color,
        client.user.displayAvatarURL(),
      );

      await interaction.editReply({
        embeds: [embed],
        components: [buildAlarmButtons(true)],
      });
    } catch (error) {
      console.error("Error listing alarms:", error);
      await interaction.editReply(
        "❌ Terjadi error saat mengambil daftar alarm.",
      );
    }
  },
};
