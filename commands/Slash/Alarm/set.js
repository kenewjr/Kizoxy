const {
  EmbedBuilder,
  ApplicationCommandOptionType,
  PermissionsBitField,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

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
      // Ambil semua options dari interaction
      const waktu = interaction.options.getString("waktu");
      const namaAlarm = interaction.options.getString("nama_alarm");
      const role = interaction.options.getRole("role");
      const channel = interaction.options.getChannel("channel");
      const tanggalInput = interaction.options.getString("tanggal");
      const recurring = interaction.options.getString("recurring") || "none";

      // Validasi channel type
      if (channel.type !== 0) {
        return interaction.editReply("❌ Channel harus berupa text channel!");
      }

      // Validasi waktu
      const waktuRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!waktuRegex.test(waktu)) {
        return interaction.editReply(
          "❌ Format waktu tidak valid! Gunakan format HH:mm (contoh: 14:30)",
        );
      }

      // Parse waktu
      const [hours, minutes] = waktu.split(":").map(Number);

      // Tentukan tanggal alarm
      let alarmDate;
      const now = new Date();

      if (tanggalInput) {
        // Parse tanggal yang diinput
        const [day, month, year] = tanggalInput.split("/").map(Number);
        alarmDate = new Date(year, month - 1, day, hours, minutes);
      } else {
        // Gunakan hari ini/tanggal default
        alarmDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
        );
      }

      // Untuk alarm berulang, jika waktu sudah lewat, atur ke occurrence berikutnya
      if (alarmDate <= now && recurring !== "none") {
        if (recurring === "daily") {
          alarmDate.setDate(alarmDate.getDate() + 1);
        } else if (recurring === "weekly") {
          alarmDate.setDate(alarmDate.getDate() + 7);
        } else if (recurring === "monthly") {
          alarmDate.setMonth(alarmDate.getMonth() + 1);
        }
      }

      // Validasi tanggal
      if (alarmDate <= now && recurring === "none") {
        return interaction.editReply(
          "❌ Waktu alarm tidak boleh di masa lalu untuk alarm tidak berulang!",
        );
      }

      // Cek permission bot di channel
      if (
        !channel
          .permissionsFor(interaction.guild.members.me)
          .has(PermissionsBitField.Flags.SendMessages)
      ) {
        return interaction.editReply(
          "❌ Saya tidak memiliki izin untuk mengirim pesan di channel tersebut!",
        );
      }

      if (
        !channel
          .permissionsFor(interaction.guild.members.me)
          .has(PermissionsBitField.Flags.MentionEveryone)
      ) {
        return interaction.editReply(
          "❌ Saya tidak memiliki izin untuk mention role di channel tersebut!",
        );
      }

      // Buat alarm object
      const alarmId = uuidv4();
      const alarmData = {
        id: alarmId,
        guildId: interaction.guildId,
        channelId: channel.id,
        roleId: role.id,
        message: namaAlarm,
        time: alarmDate.toISOString(),
        userId: interaction.user.id,
        recurring: recurring,
        createdAt: new Date().toISOString(),
      };

      // Simpan alarm
      const alarmScheduler = client.alarmScheduler;
      await alarmScheduler.storage.create(alarmData);
      await alarmScheduler.scheduleAlarm(alarmData);

      // Format waktu untuk display
      const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      // Gunakan Discord timestamp untuk countdown otomatis
      const unixTimestamp = Math.floor(alarmDate.getTime() / 1000);
      const discordTimestamp = `<t:${unixTimestamp}:R>`;

      // Tentukan teks berdasarkan jenis pengulangan
      let recurringText = "Tidak Berulang";
      let countdownText = `⏳ Countdown: ${discordTimestamp}`;

      if (recurring !== "none") {
        recurringText =
          recurring === "daily"
            ? "Harian"
            : recurring === "weekly"
              ? "Mingguan"
              : "Bulanan";

        countdownText = `⏳ Countdown hingga bunyi berikutnya: ${discordTimestamp}`;
      }

      // Buat embed
      const embed = new EmbedBuilder()
        .setDescription(
          `✅ Alarm "${namaAlarm}" berhasil disetel!\n` +
            `⏰ Waktu: ${formattedTime}\n` +
            `🔔 Akan berbunyi di: ${channel}\n` +
            `👥 Role yang di-tag: ${role}\n` +
            `🔄 Jenis: ${recurringText}\n` +
            `${countdownText}\n` +
            `🗑️ Pesan alarm di channel akan otomatis terhapus setelah 2 jam`,
        )
        .setColor(client.color);

      const response = await interaction.editReply({ embeds: [embed] });

      // Simpan message ID dan channel ID untuk sync
      await alarmScheduler.storage.syncWithMessage(
        alarmId,
        response.id,
        response.channelId,
      );

      // Untuk alarm berulang, tambahkan ke active countdowns
      if (recurring !== "none") {
        client.activeCountdowns.set(alarmId, {
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
