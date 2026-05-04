const {
  ApplicationCommandOptionType,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");
const { buildAlarmEditEmbed, buildAlarmDetailEmbed, formatAlarmDate } = require("../../../services/alarm/alarmFormatter");
const Logger = require("../../../utils/logger");
const logger = new Logger("ALARM");

module.exports = {
  name: ["alarm", "edit"],
  description: "Edit alarm yang sudah ada",
  category: "Alarm",
  options: [
    {
      name: "id_alarm",
      description:
        "ID alarm yang akan diedit (dapat dilihat dengan /alarm list)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "waktu",
      description: "Waktu alarm baru (Format: HH:mm, contoh: 14:30)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "nama_alarm",
      description: "Nama baru untuk alarm",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "pesan",
      description: "Pesan baru yang akan dikirim saat alarm berbunyi",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "role",
      description: "Role baru yang akan di-tag",
      type: ApplicationCommandOptionType.Role,
      required: false,
    },
    {
      name: "channel",
      description: "Channel baru dimana alarm akan dikirim",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: false,
    },
    {
      name: "tanggal",
      description:
        "Tanggal alarm baru (Format: DD/MM/YYYY atau DD/MM untuk tahun ini)",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "recurring",
      description: "Jenis pengulangan alarm baru",
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
    await interaction.deferReply({ ephemeral: true });

    try {
      const alarmId = interaction.options.getString("id_alarm");
      const alarmScheduler = client.alarmScheduler;

      // Jika ID alarm tidak diberikan, tampilkan daftar alarm
      if (!alarmId) {
        const alarms = await alarmScheduler.storage.findByUser(
          interaction.user.id,
        );

        if (alarms.length === 0) {
          return interaction.editReply("❌ Anda tidak memiliki alarm aktif.");
        }

        // Create select menu options
        const options = alarms.map((alarm, _index) => {
          const formattedTime = formatAlarmDate(alarm.time);

          return {
            label: `${alarm.name || alarm.message}`.substring(0, 100),
            description: `Waktu: ${formattedTime} | ID: ${alarm.id}`,
            value: alarm.id,
          };
        });

        // Create select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("edit_alarm")
          .setPlaceholder("Pilih alarm untuk diedit")
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Kirim pesan dengan select menu
        const response = await interaction.editReply({
          content: "🔔 Pilih alarm yang ingin diedit:",
          components: [row],
        });

        // Buat collector untuk select menu
        const collector = response.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60000, // 1 menit
        });

        collector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) {
            return i.reply({
              content: "❌ Ini bukan untuk Anda!",
              ephemeral: true,
            });
          }

          const selectedAlarmId = i.values[0];
          const alarmToEdit = alarms.find((a) => a.id === selectedAlarmId);

          if (!alarmToEdit) {
            return i.update({
              content: "❌ Alarm tidak ditemukan.",
              components: [],
            });
          }

          const embed = buildAlarmDetailEmbed(alarmToEdit);

          await i.update({
            content: "",
            embeds: [embed],
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

        return;
      }

      // Jika ID alarm diberikan, lanjutkan dengan proses edit
      // Dapatkan alarm dari storage
      const alarm = await alarmScheduler.storage.get(alarmId);

      if (!alarm) {
        return interaction.editReply({
          content:
            "❌ Alarm tidak ditemukan. Gunakan `/alarm list` untuk melihat daftar alarm yang aktif.",
          ephemeral: true,
        });
      }

      // Verifikasi bahwa alarm milik user atau user adalah admin
      if (
        alarm.userId !== interaction.user.id &&
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator,
        )
      ) {
        return interaction.editReply({
          content: "❌ Anda hanya dapat mengedit alarm milik sendiri.",
          ephemeral: true,
        });
      }

      // Ambil nilai baru atau gunakan nilai lama
      const newWaktu = interaction.options.getString("waktu");
      const newNamaAlarm = interaction.options.getString("nama_alarm");
      const newPesan = interaction.options.getString("pesan");
      const newRole = interaction.options.getRole("role");
      const newChannel = interaction.options.getChannel("channel");
      const newTanggal = interaction.options.getString("tanggal");
      const newRecurring = interaction.options.getString("recurring");

      // Cek apakah ada perubahan yang diminta
      if (
        !newWaktu &&
        !newNamaAlarm &&
        !newPesan &&
        !newRole &&
        !newChannel &&
        !newTanggal &&
        !newRecurring
      ) {
        return interaction.editReply({
          content:
            "❌ Tidak ada perubahan yang ditentukan. Silakan pilih setidaknya satu opsi untuk diubah.",
          ephemeral: true,
        });
      }

      // Validasi jika ada perubahan waktu/tanggal
      let newAlarmDate;
      if (newWaktu || newTanggal) {
        // Parse waktu baru atau gunakan waktu lama
        const waktu =
          newWaktu ||
          `${new Date(alarm.time).getHours().toString().padStart(2, "0")}:${new Date(alarm.time).getMinutes().toString().padStart(2, "0")}`;

        // Parse tanggal baru atau gunakan tanggal lama
        let tanggal = newTanggal;
        if (!tanggal) {
          const oldDate = new Date(alarm.time);
          tanggal = `${oldDate.getDate().toString().padStart(2, "0")}/${(oldDate.getMonth() + 1).toString().padStart(2, "0")}/${oldDate.getFullYear()}`;
        }

        // Validasi format waktu
        const waktuRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!waktuRegex.test(waktu)) {
          return interaction.editReply({
            content:
              "❌ Format waktu tidak valid! Gunakan format HH:mm (contoh: 14:30)",
            ephemeral: true,
          });
        }

        // Validasi format tanggal
        const tanggalRegex = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
        const tanggalMatch = tanggal.match(tanggalRegex);

        if (!tanggalMatch) {
          return interaction.editReply({
            content:
              "❌ Format tanggal tidak valid! Gunakan format DD/MM/YYYY atau DD/MM (untuk tahun ini)",
            ephemeral: true,
          });
        }

        // Parse tanggal
        let day = parseInt(tanggalMatch[1]);
        let month = parseInt(tanggalMatch[2]);
        let year = tanggalMatch[3]
          ? parseInt(tanggalMatch[3])
          : new Date().getFullYear();

        // Jika tahun hanya 2 digit, konversi ke tahun 4 digit
        if (tanggalMatch[3] && tanggalMatch[3].length === 2) {
          year = 2000 + parseInt(tanggalMatch[3]);
        }

        // Validasi nilai tanggal
        if (day < 1 || day > 31 || month < 1 || month > 12) {
          return interaction.editReply({
            content: "❌ Tanggal atau bulan tidak valid!",
            ephemeral: true,
          });
        }

        // Parse waktu
        const [hours, minutes] = waktu.split(":").map(Number);

        // Buat objek Date baru
        newAlarmDate = new Date(year, month - 1, day, hours, minutes);

        // Validasi apakah tanggal valid (misal, tidak ada 31 Februari)
        if (
          newAlarmDate.getMonth() !== month - 1 ||
          newAlarmDate.getDate() !== day
        ) {
          return interaction.editReply({
            content:
              "❌ Tanggal tidak valid! Pastikan tanggal sesuai dengan kalender.",
            ephemeral: true,
          });
        }

        // Validasi tanggal untuk alarm tidak berulang
        const now = new Date();
        if (
          newAlarmDate <= now &&
          (newRecurring || alarm.recurring) === "none"
        ) {
          return interaction.editReply({
            content:
              "❌ Waktu alarm tidak boleh di masa lalu untuk alarm tidak berulang!",
            ephemeral: true,
          });
        }
      }

      // Validasi channel
      if (newChannel && newChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
          content: "❌ Channel harus berupa text channel!",
          ephemeral: true,
        });
      }

      // Cek izin bot di channel baru
      if (newChannel) {
        const botPermissions = newChannel.permissionsFor(
          interaction.guild.members.me,
        );
        if (
          !botPermissions.has(PermissionsBitField.Flags.SendMessages) ||
          !botPermissions.has(PermissionsBitField.Flags.ViewChannel)
        ) {
          return interaction.editReply({
            content: `❌ Saya tidak memiliki izin untuk mengirim pesan di channel ${newChannel}.`,
            ephemeral: true,
          });
        }
      }

      // Buat object update
      const updates = {};
      if (newNamaAlarm) updates.name = newNamaAlarm;
      if (newPesan) updates.message = newPesan;
      if (newRole) updates.roleId = newRole.id;
      if (newChannel) updates.channelId = newChannel.id;
      if (newAlarmDate) updates.time = newAlarmDate.toISOString();
      if (newRecurring) updates.recurring = newRecurring;

      // Update alarm
      const updatedAlarm = await alarmScheduler.storage.update(
        alarmId,
        updates,
      );

      if (!updatedAlarm) {
        return interaction.editReply({
          content: "❌ Gagal mengupdate alarm. Silakan coba lagi.",
          ephemeral: true,
        });
      }

      // Batalkan alarm lama dan jadwalkan ulang
      alarmScheduler.cancelAlarm(alarmId);
      await alarmScheduler.scheduleAlarm(updatedAlarm);

      // Buat embed konfirmasi
      const embed = buildAlarmEditEmbed(updatedAlarm, interaction.user);

      await interaction.editReply({
        content: "Alarm Anda telah berhasil diperbarui!",
        embeds: [embed],
        ephemeral: true,
      });

      logger.info(`Alarm ${alarmId} diupdate oleh ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error editing alarm: ${error.message}`);
      await interaction.editReply({
        content:
          "❌ Terjadi error saat mengedit alarm. Silakan coba lagi atau hubungi admin.",
        ephemeral: true,
      });
    }
  },
};
