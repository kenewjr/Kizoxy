const Logger = require("../../utils/logger");
const logger = new Logger("ALARM");
const { EmbedBuilder } = require("discord.js");

// Node.js setTimeout caps at 2^31 - 1 ms (~24.8 days). Anything larger
// silently overflows and fires immediately. safeSetTimeout chains shorter
// timeouts until the real delay is reached.
const MAX_TIMEOUT_MS = 2_147_483_647;

function safeSetTimeout(callback, delayMs) {
  const handle = { _timer: null, _cleared: false };
  const schedule = (remaining) => {
    if (handle._cleared) return;
    if (remaining <= MAX_TIMEOUT_MS) {
      handle._timer = setTimeout(
        () => {
          if (!handle._cleared) callback();
        },
        Math.max(0, remaining),
      );
      return;
    }
    handle._timer = setTimeout(
      () => schedule(remaining - MAX_TIMEOUT_MS),
      MAX_TIMEOUT_MS,
    );
  };
  schedule(delayMs);
  handle.clear = () => {
    handle._cleared = true;
    if (handle._timer) {
      clearTimeout(handle._timer);
      handle._timer = null;
    }
  };
  return handle;
}

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
          const role = guild.roles.cache.get(roleId);

          if (channel && role) {
            const reminderMsg = await channel.send({
              content: `🔔 **Alarm Reminder: ${alarmMessage}**\n⏰ Will trigger in 10 minutes!\n👥 ${role}`,
            });

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
          const role = guild.roles.cache.get(roleId);

          if (channel && role) {
            const alarmMsg = await channel.send({
              content: `⏰ **ALARM: ${alarmMessage}**\n🔔 The scheduled time has arrived!\n👥 ${role}`,
            });

            this.scheduleMessageDelete(alarmMsg, 2 * 60 * 60 * 1000);
            logger.info(`Alarm triggered: ${alarmMessage} (ID: ${id})`);

            if (recurring !== "none") {
              const nextAlarmDate = new Date(alarmDate);

              if (recurring === "daily") {
                nextAlarmDate.setDate(nextAlarmDate.getDate() + 1);
              } else if (recurring === "weekly") {
                nextAlarmDate.setDate(nextAlarmDate.getDate() + 7);
              } else if (recurring === "monthly") {
                nextAlarmDate.setMonth(nextAlarmDate.getMonth() + 1);
              }

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
            if (!role) logger.warning(`Role not found: ${roleId}`);
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

        const formattedTime = `${alarmDate.getDate().toString().padStart(2, "0")}/${(alarmDate.getMonth() + 1).toString().padStart(2, "0")}/${alarmDate.getFullYear()} ${alarmDate.getHours().toString().padStart(2, "0")}:${alarmDate.getMinutes().toString().padStart(2, "0")}`;

        const unixTimestamp = Math.floor(alarmDate.getTime() / 1000);
        const discordTimestamp = `<t:${unixTimestamp}:R>`;

        let recurringText = "Non-recurring";
        let countdownText = `⏳ Countdown: ${discordTimestamp}`;

        if (recurring !== "none") {
          recurringText =
            recurring === "daily"
              ? "Daily"
              : recurring === "weekly"
                ? "Weekly"
                : "Monthly";

          countdownText = `⏳ Countdown to next trigger: ${discordTimestamp}`;
        }

        const updatedEmbed = new EmbedBuilder()
          .setDescription(
            `✅ Alarm "${alarmMessage}" has been set!\n` +
              `⏰ Time: ${formattedTime}\n` +
              `🔔 Will trigger in: <#${channelId}>\n` +
              `👥 Role to mention: <@&${roleId}>\n` +
              `🔄 Type: ${recurringText}\n` +
              `${countdownText}\n` +
              `🗑️ The alarm message will be auto-deleted after 2 hours`,
          )
          .setColor(0x00ff00);

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
