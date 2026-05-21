const { Events } = require("discord.js");
const Embeds = require("../lib/embeds");
const JSONStorage = require("../persistence/jsonStorage");
const AlarmScheduler = require("../features/alarm/alarmScheduler");
const Logger = require("../lib/logger");
const logger = new Logger("ALARM");

const intervals = [];

function clearAlarmIntervals() {
  for (const id of intervals) clearInterval(id);
  intervals.length = 0;
}

module.exports = (client) => {
  try {
    const alarmStorage = new JSONStorage("alarms.json");
    const alarmScheduler = new AlarmScheduler(client);
    alarmScheduler.setStorage(alarmStorage);
    client.alarmStorage = alarmStorage;
    client.alarmScheduler = alarmScheduler;
    client.activeCountdowns = new Map();

    client.once(Events.ClientReady, async () => {
      try {
        logger.info("Loading saved alarms...");
        await alarmStorage.load();
        await alarmScheduler.loadAlarms();
        logger.success("Alarm scheduler started with auto-delete feature");

        const countdownInterval = setInterval(async () => {
          try {
            const now = Date.now();

            for (const [alarmId, countdownData] of client.activeCountdowns) {
              if (now >= countdownData.nextUpdate) {
                const alarm = await client.alarmStorage.get(alarmId);
                if (!alarm) {
                  client.activeCountdowns.delete(alarmId);
                  continue;
                }
                let nextAlarmTime = new Date(alarm.time);
                const nowDate = new Date();

                if (nextAlarmTime <= nowDate && alarm.recurring !== "none") {
                  if (alarm.recurring === "daily") {
                    nextAlarmTime.setDate(nextAlarmTime.getDate() + 1);
                  } else if (alarm.recurring === "weekly") {
                    nextAlarmTime.setDate(nextAlarmTime.getDate() + 7);
                  } else if (alarm.recurring === "monthly") {
                    nextAlarmTime.setMonth(nextAlarmTime.getMonth() + 1);
                  }
                  await client.alarmStorage.update(alarmId, {
                    time: nextAlarmTime.toISOString(),
                  });
                  client.alarmScheduler.cancelAlarm(alarmId);
                  await client.alarmScheduler.scheduleAlarm({
                    ...alarm,
                    time: nextAlarmTime.toISOString(),
                  });
                }

                const jakartaParts = new Intl.DateTimeFormat("id-ID", {
                  timeZone: "Asia/Jakarta",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).formatToParts(nextAlarmTime);
                const partMap = Object.fromEntries(
                  jakartaParts.map((p) => [p.type, p.value]),
                );
                const formattedTime = `${partMap.day}/${partMap.month}/${partMap.year} ${partMap.hour}:${partMap.minute}`;
                const unixTimestamp = Math.floor(
                  nextAlarmTime.getTime() / 1000,
                );
                const discordTimestamp = `<t:${unixTimestamp}:R>`;
                const updatedEmbed = Embeds.withColor(
                  client,
                  countdownData.originalEmbed.color,
                  {
                    description:
                      `✅ Alarm "${alarm.message}" successfully set!\n` +
                      `⏰ Time: ${formattedTime}\n` +
                      `🔔 Will ring in: <#${alarm.channelId}>\n` +
                      `👥 Tagged role: <@&${alarm.roleId}>\n` +
                      `🔄 Type: ${alarm.recurring === "daily" ? "Daily" : alarm.recurring === "weekly" ? "Weekly" : alarm.recurring === "monthly" ? "Monthly" : "Non-recurring"}\n` +
                      `⏳ Countdown to next ring: ${discordTimestamp}\n` +
                      `🗑️ Alarm message in channel will be auto-deleted after 2 hours`,
                  },
                );
                try {
                  const channel = await client.channels.fetch(
                    countdownData.channelId,
                  );
                  const message = await channel.messages.fetch(
                    countdownData.messageId,
                  );
                  await message.edit({ embeds: [updatedEmbed] });
                  countdownData.originalEmbed = updatedEmbed;
                } catch (error) {
                  logger.error(
                    `Error updating countdown message: ${error.message}`,
                  );
                  client.activeCountdowns.delete(alarmId);
                }
                countdownData.nextUpdate = now + 60000; // Update every minute
              }
            }
          } catch (error) {
            logger.error(
              `Error in countdown update interval: ${error.message}`,
            );
          }
        }, 30000); // Check every 30 seconds
        intervals.push(countdownInterval);

        logger.success("Auto-update countdown system started");
      } catch (error) {
        logger.error(`Error starting alarm scheduler: ${error.message}`);
      }
    });

    logger.success(
      "Alarm system initialized with auto-delete and auto-update countdown",
    );
  } catch (error) {
    logger.error(`Error initializing alarm system: ${error.message}`);
  }
};

module.exports.clearAlarmIntervals = clearAlarmIntervals;
