const Logger = require("../../lib/logger");
const logger = new Logger("ALARM");
const {
  safeSetTimeout,
  computeNextRecurringDate,
  formatAlarmDateString,
  buildScheduledEmbed,
} = require("./alarmSchedulerHelper");

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
      userId,
      message: alarmMessage,
      recurring,
      messageId,
      embedChannelId,
    } = alarm;

    const alarmDate = new Date(time);
    const notifyTime = new Date(alarmDate.getTime() - 10 * 60 * 1000);
    const now = new Date();

    if (notifyTime > now) {
      const notifyDelay = notifyTime.getTime() - now.getTime();
      const notifyTimeout = safeSetTimeout(async () => {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (!guild) {
            logger.warning(
              `Guild not found for alarm notification: ${guildId}`,
            );
            return;
          }

          const channel = guild.channels.cache.get(channelId);
          const role = roleId ? guild.roles.cache.get(roleId) : null;
          const mention = role ? `${role}` : userId ? `<@${userId}>` : "";

          if (channel && (role || userId)) {
            const reminderMsg = await channel.send({
              content: `🔔 **Alarm Reminder: ${alarmMessage}**\n⏰ Will trigger in 10 minutes!\n👥 ${mention}`,
            });

            this.scheduleMessageDelete(reminderMsg, 2 * 60 * 60 * 1000);
            logger.info(
              `Notification sent for alarm: ${alarmMessage} (ID: ${id})`,
            );
          } else {
            if (!channel) logger.warning(`Channel not found: ${channelId}`);
            if (roleId && !role) logger.warning(`Role not found: ${roleId}`);
          }
        } catch (error) {
          logger.error(
            `Error sending notification for alarm ${id}: ${error.message}`,
          );
        }
      }, notifyDelay);

      this.jobs.set(`${id}-notify`, notifyTimeout);
    }

    if (alarmDate > now) {
      const alarmDelay = alarmDate.getTime() - now.getTime();
      const alarmTimeout = safeSetTimeout(async () => {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (!guild) {
            logger.warning(`Guild not found for alarm: ${guildId}`);
            return;
          }

          const channel = guild.channels.cache.get(channelId);
          const role = roleId ? guild.roles.cache.get(roleId) : null;
          const mention = role ? `${role}` : userId ? `<@${userId}>` : "";

          if (channel && (role || userId)) {
            const alarmMsg = await channel.send({
              content: `⏰ **ALARM: ${alarmMessage}**\n🔔 The scheduled time has arrived!\n👥 ${mention}`,
            });

            this.scheduleMessageDelete(alarmMsg, 2 * 60 * 60 * 1000);
            logger.info(`Alarm triggered: ${alarmMessage} (ID: ${id})`);

            if (recurring !== "none") {
              const nextAlarmDate = computeNextRecurringDate(
                alarmDate,
                recurring,
              );

              const updatedAlarm = {
                ...alarm,
                time: nextAlarmDate.toISOString(),
              };

              await this.storage.update(id, updatedAlarm);

              this.scheduleAlarm(updatedAlarm);

              if (messageId && embedChannelId) {
                this.scheduleEmbedUpdate(updatedAlarm);
              }

              logger.info(
                `Recurring alarm rescheduled: ${alarmMessage} for ${nextAlarmDate.toLocaleString("en-US")}`,
              );
            } else {
              await this.storage.delete(id);
              this.cancelAlarm(id);
              logger.info(`One-time alarm deleted: ${id}`);
            }
          } else {
            if (!channel) logger.warning(`Channel not found: ${channelId}`);
            if (roleId && !role) logger.warning(`Role not found: ${roleId}`);
          }
        } catch (error) {
          logger.error(`Error triggering alarm ${id}: ${error.message}`);
        }
      }, alarmDelay);

      this.jobs.set(id, alarmTimeout);
      logger.debug(`Alarm scheduled: ${alarmMessage} (ID: ${id})`);

      if (messageId && embedChannelId) {
        this.scheduleEmbedUpdate(alarm);
      }
    } else {
      logger.warning(`Alarm time is in the past: ${alarmMessage} (ID: ${id})`);

      if (recurring !== "none") {
        const nextAlarmDate = computeNextRecurringDate(new Date(), recurring);
        nextAlarmDate.setHours(
          alarmDate.getHours(),
          alarmDate.getMinutes(),
          0,
          0,
        );

        const updatedAlarm = {
          ...alarm,
          time: nextAlarmDate.toISOString(),
        };

        await this.storage.update(id, updatedAlarm);

        this.scheduleAlarm(updatedAlarm);

        if (messageId && embedChannelId) {
          this.scheduleEmbedUpdate(updatedAlarm);
        }

        logger.info(
          `Past-time recurring alarm rescheduled: ${alarmMessage} for ${nextAlarmDate.toLocaleString("en-US")}`,
        );
      }
    }
  }

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

        const formattedTime = formatAlarmDateString(alarmDate);

        const unixTimestamp = Math.floor(alarmDate.getTime() / 1000);
        const discordTimestamp = `<t:${unixTimestamp}:R>`;

        const updatedEmbed = buildScheduledEmbed({
          alarmMessage,
          formattedTime,
          channelId,
          roleId,
          recurring,
          discordTimestamp,
        });

        await message.edit({ embeds: [updatedEmbed] });
        logger.debug(`Embed updated for alarm: ${id}`);

        this.scheduleEmbedUpdate(alarm);
      } catch (error) {
        logger.error(`Error updating embed for alarm ${id}: ${error.message}`);

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

    this.embedUpdateQueue.set(id, updateTimeout);
  }

  async scheduleMessageDelete(message, delay) {
    const deleteTimeout = setTimeout(async () => {
      try {
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

    this.messageDeleteQueue.set(message.id, deleteTimeout);
  }

  cancelScheduledDelete(messageId) {
    const timeout = this.messageDeleteQueue.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.messageDeleteQueue.delete(messageId);
      logger.debug(`Scheduled message delete cancelled: ${messageId}`);
    }
  }

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
    const notifyJob = this.jobs.get(`${alarmId}-notify`);
    if (notifyJob) {
      if (typeof notifyJob.clear === "function") notifyJob.clear();
      else clearTimeout(notifyJob);
      this.jobs.delete(`${alarmId}-notify`);
    }

    const alarmJob = this.jobs.get(alarmId);
    if (alarmJob) {
      if (typeof alarmJob.clear === "function") alarmJob.clear();
      else clearTimeout(alarmJob);
      this.jobs.delete(alarmId);
    }

    this.cancelScheduledDelete(alarmId);

    this.cancelScheduledEmbedUpdate(alarmId);

    logger.info(`Alarm cancelled: ${alarmId}`);
  }
}

module.exports = AlarmScheduler;
