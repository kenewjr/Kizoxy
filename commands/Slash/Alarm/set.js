const { ApplicationCommandOptionType } = require("discord.js");
const {
  createAlarm,
  validateTime,
  checkChannelPermissions,
} = require("../../../services/alarm/alarmService");
const {
  buildAlarmSetEmbed,
} = require("../../../services/alarm/alarmFormatter");

module.exports = {
  name: ["alarm", "set"],
  description: "Set a custom alarm with timezone support",
  category: "Alarm",
  options: [
    {
      name: "waktu",
      description: "Waktu alarm (Format: HH:mm)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "nama_alarm",
      description: "Nama untuk alarm ini",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "role",
      description: "Role yang akan di-tag saat alarm",
      type: ApplicationCommandOptionType.Role,
      required: true,
    },
    {
      name: "channel",
      description: "Channel dimana alarm akan dikirim",
      type: ApplicationCommandOptionType.Channel,
      required: true,
    },
    {
      name: "tanggal",
      description:
        "Tanggal alarm (Format: DD/MM/YYYY, kosongkan untuk hari ini)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "recurring",
      description: "Jenis pengulangan alarm",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "Tidak Berulang", value: "none" },
        { name: "Harian", value: "daily" },
        { name: "Mingguan", value: "weekly" },
        { name: "Bulanan", value: "monthly" },
      ],
    },
  ],
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    try {
      const waktu = interaction.options.getString("waktu");
      const namaAlarm = interaction.options.getString("nama_alarm");
      const role = interaction.options.getRole("role");
      const channel = interaction.options.getChannel("channel");
      const tanggalInput = interaction.options.getString("tanggal");
      const recurring = interaction.options.getString("recurring") || "none";

      // Validate time
      const timeError = validateTime(waktu);
      if (timeError) return interaction.editReply(timeError);

      // Validate channel permissions
      const permError = checkChannelPermissions(channel, interaction.guild);
      if (permError) return interaction.editReply(permError);

      // Create alarm via service
      const result = await createAlarm(client.alarmScheduler, {
        guildId: interaction.guildId,
        channelId: channel.id,
        roleId: role.id,
        userId: interaction.user.id,
        message: namaAlarm,
        waktu,
        tanggal: tanggalInput,
        recurring,
      });

      if (result.error) return interaction.editReply(result.error);

      // Build embed using formatter
      const embed = buildAlarmSetEmbed(result.alarm, client.color);
      const response = await interaction.editReply({ embeds: [embed] });

      // Sync message ID
      await client.alarmScheduler.storage.syncWithMessage(
        result.alarm.id,
        response.id,
        response.channelId,
      );

      // Track recurring countdowns
      if (recurring !== "none") {
        client.activeCountdowns.set(result.alarm.id, {
          messageId: response.id,
          channelId: response.channelId,
          originalEmbed: embed,
          nextUpdate: Date.now() + 60000,
        });
      }
    } catch (error) {
      console.error("Error setting alarm:", error);
      await interaction.editReply(
        "❌ Terjadi error saat menyetel alarm. Silakan coba lagi.",
      );
    }
  },
};
