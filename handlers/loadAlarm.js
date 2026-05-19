const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const JSONStorage = require("../modules/storage/storage");
const AlarmScheduler = require("../modules/alarm/alarmScheduler");
const Logger = require("../utils/logger");
const logger = new Logger("ALARM");

module.exports = (client) => {
  try {
    const alarmStorage = new JSONStorage("alarms.json");
    const alarmScheduler = new AlarmScheduler(client);
    alarmScheduler.setStorage(alarmStorage);
    client.alarmStorage = alarmStorage;
    client.alarmScheduler = alarmScheduler;
    client.activeCountdowns = new Map();
    const commandsDir = path.join(
      __dirname,
      "..",
      "commands",
      "Slash",
      "Alarm",
    );
    const buttonsDir = path.join(__dirname, "..", "buttons");
    let loadedCommands = 0;
    let failedCommands = [];

    try {
      const buttonFiles = fs
        .readdirSync(buttonsDir)
        .filter((f) => f.endsWith(".js"));
      for (const file of buttonFiles) {
        try {
          const filePath = path.join(buttonsDir, file);
          delete require.cache[require.resolve(filePath)];
          const btn = require(filePath);

          if (btn && btn.customId) {
            client.buttons.set(btn.customId, btn);
            logger.success(`Button loaded: ${btn.customId}`);
          }
        } catch (error) {
          logger.error(`Failed to load button ${file}: ${error.message}`);
        }
      }
    } catch (err) {
      logger.error(`Failed to read buttons folder: ${err.message}`);
    }

    try {
      const files = fs
        .readdirSync(commandsDir)
        .filter((f) => f.endsWith(".js"));

      for (const file of files) {
        try {
          const filePath = path.join(commandsDir, file);
          // Clear cache during development
          delete require.cache[require.resolve(filePath)];
          const cmd = require(filePath);

          if (!cmd) {
            throw new Error("Module exports is empty");
          }

          if (!cmd.name || !Array.isArray(cmd.name)) {
            throw new Error("Missing or invalid 'name' array");
          }

          if (typeof cmd.run !== "function") {
            throw new Error("Missing 'run' function");
          }

          // Store command with full name (alarm set, alarm list, etc.)
          const fullCommandName = cmd.name.join(" ");
          client.commands.set(fullCommandName, cmd);
          logger.success(`Command loaded: ${fullCommandName}`);
          loadedCommands++;
        } catch (error) {
          logger.error(`Failed to load ${file}: ${error.message}`);
          failedCommands.push({ file, error: error.message });
        }
      }

      logger.info(`Total alarm commands loaded: ${loadedCommands}`);

      if (failedCommands.length > 0) {
        logger.warning(
          `${failedCommands.length} alarm commands failed to load:`,
        );
        failedCommands.forEach(({ file, error }) => {
          logger.warning(`- ${file}: ${error}`);
        });
      }
    } catch (err) {
      logger.error(`Failed to read folder ${commandsDir}: ${err.message}`);
    }

    // Event handler to load alarms after bot is ready
    client.once("ready", async () => {
      try {
        logger.info("Loading saved alarms...");
        await alarmStorage.load();
        await alarmScheduler.loadAlarms();
        logger.success("Alarm scheduler started with auto-delete feature");

        // Set up interval for automatic countdown updates
        setInterval(async () => {
          try {
            const now = Date.now();

            for (const [alarmId, countdownData] of client.activeCountdowns) {
              if (now >= countdownData.nextUpdate) {
                // Get the alarm data
                const alarm = await client.alarmStorage.get(alarmId);
                if (!alarm) {
                  client.activeCountdowns.delete(alarmId);
                  continue;
                }

                // Calculate next occurrence for recurring alarms
                let nextAlarmTime = new Date(alarm.time);
                const nowDate = new Date();

                // Fix timezone for Indonesia (UTC+7)
                const timezoneOffset = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
                const localNextAlarmTime = new Date(
                  nextAlarmTime.getTime() + timezoneOffset,
                );
                const _localNowDate = new Date(
                  nowDate.getTime() + timezoneOffset,
                );

                if (nextAlarmTime <= nowDate && alarm.recurring !== "none") {
                  if (alarm.recurring === "daily") {
                    nextAlarmTime.setDate(nextAlarmTime.getDate() + 1);
                  } else if (alarm.recurring === "weekly") {
                    nextAlarmTime.setDate(nextAlarmTime.getDate() + 7);
                  } else if (alarm.recurring === "monthly") {
                    nextAlarmTime.setMonth(nextAlarmTime.getMonth() + 1);
                  }

                  // Update the alarm time in storage
                  await client.alarmStorage.update(alarmId, {
                    time: nextAlarmTime.toISOString(),
                  });

                  // Reschedule the alarm
                  client.alarmScheduler.cancelAlarm(alarmId);
                  await client.alarmScheduler.scheduleAlarm({
                    ...alarm,
                    time: nextAlarmTime.toISOString(),
                  });
                }

                // Format time for display with Indonesia timezone
                const formattedTime = `${localNextAlarmTime.getDate().toString().padStart(2, "0")}/${(localNextAlarmTime.getMonth() + 1).toString().padStart(2, "0")}/${localNextAlarmTime.getFullYear()} ${localNextAlarmTime.getHours().toString().padStart(2, "0")}:${localNextAlarmTime.getMinutes().toString().padStart(2, "0")}`;

                // Update the Discord timestamp
                const unixTimestamp = Math.floor(
                  nextAlarmTime.getTime() / 1000,
                );
                const discordTimestamp = `<t:${unixTimestamp}:R>`;

                // Update the embed with new time
                const updatedEmbed = new EmbedBuilder()
                  .setDescription(
                    `✅ Alarm "${alarm.message}" successfully set!\n` +
                      `⏰ Time: ${formattedTime}\n` +
                      `🔔 Will ring in: <#${alarm.channelId}>\n` +
                      `👥 Tagged role: <@&${alarm.roleId}>\n` +
                      `🔄 Type: ${alarm.recurring === "daily" ? "Daily" : alarm.recurring === "weekly" ? "Weekly" : alarm.recurring === "monthly" ? "Monthly" : "Non-recurring"}\n` +
                      `⏳ Countdown to next ring: ${discordTimestamp}\n` +
                      `🗑️ Alarm message in channel will be auto-deleted after 2 hours`,
                  )
                  .setColor(countdownData.originalEmbed.color);

                // Edit the message
                try {
                  const channel = await client.channels.fetch(
                    countdownData.channelId,
                  );
                  const message = await channel.messages.fetch(
                    countdownData.messageId,
                  );
                  await message.edit({ embeds: [updatedEmbed] });

                  // Update stored embed data
                  countdownData.originalEmbed = updatedEmbed;
                } catch (error) {
                  logger.error(
                    `Error updating countdown message: ${error.message}`,
                  );
                  client.activeCountdowns.delete(alarmId);
                }

                // Schedule next update
                countdownData.nextUpdate = now + 60000; // Update every minute
              }
            }
          } catch (error) {
            logger.error(
              `Error in countdown update interval: ${error.message}`,
            );
          }
        }, 30000); // Check every 30 seconds

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
