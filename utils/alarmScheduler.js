const Logger = require("../utils/logger");
const logger = new Logger("ALARM");
const { EmbedBuilder } = require("discord.js");

class AlarmScheduler {
  constructor(client) {
    this.client = client;
    this.jobs = new Map();
    this.storage = null;
    this.messageDeleteQueue = new Map();
    this.embedUpdateQueue = new Map();
  }

  setStorage(storage) {
    this.storage = storage;
  }

  async scheduleAlarm(alarm) {
    const {
      id,
      time,
      guildId,
      channelId,
      roleId,
      message: alarmMessage,
      recurring,
      messageId,
      embedChannelId,
    } = alarm;

    const alarmDate = new Date(time);
    const notifyTime = new Date(alarmDate.getTime() - 10 * 60 * 1000);
    const now = new Date();

    // Jadwalkan notifikasi 10 menit sebelumnya
    if (notifyTime > now) {
      const notifyDelay = notifyTime.getTime() - now.getTime();
      const notifyTimeout = setTimeout(async () => {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (!guild) {
            logger.warning(
              `Guild not found for alarm notification: ${guildId}`,
            );
            return;
          }

          const channel = guild.channels.cache.get(channelId);
          const role = guild.roles.cache.get(roleId);

          if (channel && role) {
            const reminderMsg = await channel.send({
              content: `🔔 **Pengingat Alarm: ${alarmMessage}**\n⏰ Akan berbunyi dalam 10 menit!\n👥 ${role}`,
            });

            // Jadwalkan penghapusan pesan pengingat setelah 2 jam
            this.scheduleMessageDelete(reminderMsg, 2 * 60 * 60 * 1000);
            logger.info(
              `Notification sent for alarm: ${alarmMessage} (ID: ${id})`,
            );
          } else {
            if (!channel) logger.warning(`Channel not found: ${channelId}`);
            if (!role) logger.warning(`Role not found: ${roleId}`);
          }
        } catch (error) {
          logger.error(
            `Error sending notification for alarm ${id}: ${error.message}`,
          );
        }
      }, notifyDelay);

      this.jobs.set(`${id}-notify`, notifyTimeout);
    }

    // Jadwalkan alarm utama
    if (alarmDate > now) {
      const alarmDelay = alarmDate.getTime() - now.getTime();
      const alarmTimeout = setTimeout(async () => {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (!guild) {
            logger.warning(`Guild not found for alarm: ${guildId}`);
            return;
          }

          const channel = guild.channels.cache.get(channelId);
          const role = guild.roles.cache.get(roleId);

          if (channel && role) {
            const alarmMsg = await channel.send({
              content: `⏰ **ALARM: ${alarmMessage}**\n🔔 Waktu yang ditentukan telah tiba!\n👥 ${role}`,
            });

            // Jadwalkan penghapusan pesan alarm setelah 2 jam
            this.scheduleMessageDelete(alarmMsg, 2 * 60 * 60 * 1000);
            logger.info(`Alarm triggered: ${alarmMessage} (ID: ${id})`);

            // Untuk alarm recurring, jadwalkan ulang untuk waktu berikutnya
            if (recurring !== "none") {
              // Hitung waktu berikutnya berdasarkan jenis recurring
              const nextAlarmDate = new Date(alarmDate);

              if (recurring === "daily") {
                nextAlarmDate.setDate(nextAlarmDate.getDate() + 1);
              } else if (recurring === "weekly") {
                nextAlarmDate.setDate(nextAlarmDate.getDate() + 7);
              } else if (recurring === "monthly") {
                nextAlarmDate.setMonth(nextAlarmDate.getMonth() + 1);
              }

              // Update alarm dengan waktu berikutnya
              const updatedAlarm = {
                ...alarm,
                time: nextAlarmDate.toISOString(),
              };

              await this.storage.update(id, updatedAlarm);

              // Jadwalkan alarm berikutnya
              this.scheduleAlarm(updatedAlarm);

              // Update embed message jika ada
              if (messageId && embedChannelId) {
                this.scheduleEmbedUpdate(updatedAlarm);
              }

              logger.info(
                `Recurring alarm rescheduled: ${alarmMessage} for ${nextAlarmDate.toLocaleString("id-ID")}`,
              );
            } else {
              // Hapus alarm one-time setelah dijalankan
              await this.storage.delete(id);
              this.cancelAlarm(id);
              logger.info(`One-time alarm deleted: ${id}`);
            }
          } else {
            if (!channel) logger.warning(`Channel not found: ${channelId}`);
            if (!role) logger.warning(`Role not found: ${roleId}`);
          }
        } catch (error) {
          logger.error(`Error triggering alarm ${id}: ${error.message}`);
        }
      }, alarmDelay);

      this.jobs.set(id, alarmTimeout);
      logger.debug(`Alarm scheduled: ${alarmMessage} (ID: ${id})`);

      // Jadwalkan update embed jika alarm memiliki messageId
      if (messageId && embedChannelId) {
        this.scheduleEmbedUpdate(alarm);
      }
    } else {
      logger.warning(`Alarm time is in the past: ${alarmMessage} (ID: ${id})`);

      // Untuk alarm recurring yang waktunya sudah lewat, jadwalkan ulang
      if (recurring !== "none") {
        // Hitung waktu berikutnya berdasarkan jenis recurring
        const nextAlarmDate = new Date();

        if (recurring === "daily") {
          nextAlarmDate.setDate(nextAlarmDate.getDate() + 1);
          nextAlarmDate.setHours(
            alarmDate.getHours(),
            alarmDate.getMinutes(),
            0,
            0,
          );
        } else if (recurring === "weekly") {
          nextAlarmDate.setDate(nextAlarmDate.getDate() + 7);
          nextAlarmDate.setHours(
            alarmDate.getHours(),
            alarmDate.getMinutes(),
            0,
            0,
          );
        } else if (recurring === "monthly") {
          nextAlarmDate.setMonth(nextAlarmDate.getMonth() + 1);
          nextAlarmDate.setHours(
            alarmDate.getHours(),
            alarmDate.getMinutes(),
            0,
            0,
          );
        }

        // Update alarm dengan waktu berikutnya
        const updatedAlarm = {
          ...alarm,
          time: nextAlarmDate.toISOString(),
        };

        await this.storage.update(id, updatedAlarm);

        // Jadwalkan alarm berikutnya
        this.scheduleAlarm(updatedAlarm);

        // Update embed message jika ada
        if (messageId && embedChannelId) {
          this.scheduleEmbedUpdate(updatedAlarm);
        }

        logger.info(
          `Past-time recurring alarm rescheduled: ${alarmMessage} for ${nextAlarmDate.toLocaleString("id-ID")}`,
        );
      }
    }
  }

  // Method untuk update embed message
  async scheduleEmbedUpdate(alarm) {
    const {
      id,
      messageId,
      embedChannelId,
      message: alarmMessage,
      channelId,
      roleId,
      recurring,
      time,
    } = alarm;

    const alarmDate = new Date(time);
    const now = new Date();

    if (alarmDate <= now) {
      logger.debug(`Skipping embed update for past alarm: ${id}`);
      return;
    }

    // Hitung delay sampai update berikutnya (update setiap menit)
    const updateDelay = 60000 - (now.getTime() % 60000);

    const updateTimeout = setTimeout(async () => {
      try {
        const channel = this.client.channels.cache.get(embedChannelId);
        if (!channel) {
          logger.warning(`Embed channel not found: ${embedChannelId}`);
          return;
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          logger.warning(`Embed message not found: ${messageId}`);
          return;
        }

        // Format waktu untuk display
        const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

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

        // Buat embed baru
        const updatedEmbed = new EmbedBuilder()
          .setDescription(
            `✅ Alarm "${alarmMessage}" berhasil disetel!\n` +
              `⏰ Waktu: ${formattedTime}\n` +
              `🔔 Akan berbunyi di: <#${channelId}>\n` +
              `👥 Role yang di-tag: <@&${roleId}>\n` +
              `🔄 Jenis: ${recurringText}\n` +
              `${countdownText}\n` +
              `🗑️ Pesan alarm di channel akan otomatis terhapus setelah 2 jam`,
          )
          .setColor(0x00ff00);

        // Edit pesan
        await message.edit({ embeds: [updatedEmbed] });
        logger.debug(`Embed updated for alarm: ${id}`);

        // Jadwalkan update berikutnya
        this.scheduleEmbedUpdate(alarm);
      } catch (error) {
        logger.error(`Error updating embed for alarm ${id}: ${error.message}`);

        // Jika pesan tidak ditemukan, hapus dari storage
        if (error.code === 10008) {
          logger.info(
            `Embed message not found, removing reference from alarm: ${id}`,
          );
          const updatedAlarm = {
            ...alarm,
            messageId: null,
            embedChannelId: null,
          };
          await this.storage.update(id, updatedAlarm);
        }
      }
    }, updateDelay);

    // Simpan timeout di queue
    this.embedUpdateQueue.set(id, updateTimeout);
  }

  // Method untuk menjadwalkan penghapusan pesan
  async scheduleMessageDelete(message, delay) {
    const deleteTimeout = setTimeout(async () => {
      try {
        // Pastikan pesan masih ada sebelum menghapus
        const channel = this.client.channels.cache.get(message.channelId);
        if (channel) {
          try {
            const fetchedMessage = await channel.messages.fetch(message.id);
            if (fetchedMessage) {
              await fetchedMessage.delete();
              logger.info(`Alarm message deleted: ${message.id}`);
            }
          } catch (fetchError) {
            if (fetchError.code === 10008) {
              // Unknown Message
              logger.debug(`Message already deleted: ${message.id}`);
            } else {
              logger.error(`Failed to fetch message: ${fetchError.message}`);
            }
          }
        }
      } catch (error) {
        logger.error(`Error in scheduled message delete: ${error.message}`);
      }
    }, delay);

    // Simpan timeout di queue
    this.messageDeleteQueue.set(message.id, deleteTimeout);
  }

  // Method untuk membatalkan penghapusan pesan
  cancelScheduledDelete(messageId) {
    const timeout = this.messageDeleteQueue.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.messageDeleteQueue.delete(messageId);
      logger.debug(`Scheduled message delete cancelled: ${messageId}`);
    }
  }

  // Method untuk membatalkan update embed
  cancelScheduledEmbedUpdate(alarmId) {
    const timeout = this.embedUpdateQueue.get(alarmId);
    if (timeout) {
      clearTimeout(timeout);
      this.embedUpdateQueue.delete(alarmId);
      logger.debug(`Scheduled embed update cancelled: ${alarmId}`);
    }
  }

  async loadAlarms() {
    if (!this.storage) {
      logger.error("Storage not set for alarm scheduler");
      return;
    }

    try {
      const alarms = await this.storage.getAll();
      logger.info(`Loading ${alarms.length} alarms from storage`);

      for (const alarm of alarms) {
        this.scheduleAlarm(alarm);
      }

      logger.success(`Successfully loaded ${alarms.length} alarms`);
    } catch (error) {
      logger.error(`Failed to load alarms: ${error.message}`);
    }
  }

  cancelAlarm(alarmId) {
    // Batalkan notifikasi
    const notifyJob = this.jobs.get(`${alarmId}-notify`);
    if (notifyJob) {
      clearTimeout(notifyJob);
      this.jobs.delete(`${alarmId}-notify`);
    }

    // Batalkan alarm utama
    const alarmJob = this.jobs.get(alarmId);
    if (alarmJob) {
      clearTimeout(alarmJob);
      this.jobs.delete(alarmId);
    }

    // Batalkan penghapusan pesan terkait
    this.cancelScheduledDelete(alarmId);

    // Batalkan update embed
    this.cancelScheduledEmbedUpdate(alarmId);

    logger.info(`Alarm cancelled: ${alarmId}`);
  }
}

module.exports = AlarmScheduler;
