const { PermissionsBitField } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

// ── Validation ──────────────────────────────────────────

const WAKTU_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const TANGGAL_REGEX = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const TIME_REGEX = WAKTU_REGEX;
const DATE_REGEX = TANGGAL_REGEX;

function validateTime(time) {
  if (!TIME_REGEX.test(time)) {
    return "❌ Invalid time format! Use HH:mm (e.g. 14:30)";
  }
  return null;
}

function parseDate(date) {
  const match = date.match(DATE_REGEX);
  if (!match) {
    return {
      error:
        "❌ Invalid date format! Use DD/MM/YYYY or DD/MM",
    };
  }

  let day = parseInt(match[1]);
  let month = parseInt(match[2]);
  let year = match[3] ? parseInt(match[3]) : new Date().getFullYear();

  if (match[3] && match[3].length === 2) {
    year = 2000 + year;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { error: "❌ Invalid day or month!" };
  }

  return { day, month, year };
}

function buildAlarmDate({ time, date, recurring = "none" }) {
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();

  let alarmDate;
  if (date) {
    const parsed = parseDate(date);
    if (parsed.error) return parsed;
    alarmDate = new Date(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      hours,
      minutes,
    );

    // Validate calendar date (e.g. no Feb 31)
    if (
      alarmDate.getMonth() !== parsed.month - 1 ||
      alarmDate.getDate() !== parsed.day
    ) {
      return {
        error:
          "❌ Invalid date! Make sure the date matches the calendar.",
      };
    }
  } else {
    alarmDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
    );
  }

  // For recurring alarms with past time, advance to next occurrence
  if (alarmDate <= now && recurring !== "none") {
    if (recurring === "daily") alarmDate.setDate(alarmDate.getDate() + 1);
    else if (recurring === "weekly") alarmDate.setDate(alarmDate.getDate() + 7);
    else if (recurring === "monthly")
      alarmDate.setMonth(alarmDate.getMonth() + 1);
  }

  // Non-recurring alarms can't be in the past
  if (alarmDate <= now && recurring === "none") {
    return {
      error:
        "❌ Alarm time cannot be in the past for non-recurring alarms!",
    };
  }

  return { alarmDate };
}

function checkChannelPermissions(channel, guild) {
  if (channel.type !== 0) {
    return "❌ Channel must be a text channel!";
  }

  const perms = channel.permissionsFor(guild.members.me);
  if (!perms.has(PermissionsBitField.Flags.SendMessages)) {
    return "❌ I don't have permission to send messages in that channel!";
  }
  if (!perms.has(PermissionsBitField.Flags.MentionEveryone)) {
    return "❌ I don't have permission to mention roles in that channel!";
  }

  return null;
}

// ── CRUD Operations ─────────────────────────────────────

async function createAlarm(
  scheduler,
  {
    guildId,
    channelId,
    roleId,
    userId,
    message,
    time,
    date,
    recurring = "none",
  },
) {
  const dateResult = buildAlarmDate({ time, date, recurring });
  if (dateResult.error) return dateResult;

  const alarmId = uuidv4();
  const alarmData = {
    id: alarmId,
    guildId,
    channelId,
    roleId,
    message,
    time: dateResult.alarmDate.toISOString(),
    userId,
    recurring,
    createdAt: new Date().toISOString(),
  };

  await scheduler.storage.create(alarmData);
  await scheduler.scheduleAlarm(alarmData);

  return { alarm: alarmData, alarmDate: dateResult.alarmDate };
}

/**
 * Cancel (delete) an alarm.
 */
async function cancelAlarm(scheduler, alarmId) {
  scheduler.cancelAlarm(alarmId);
  await scheduler.storage.delete(alarmId);
}

async function toggleAlarm(scheduler, alarmId) {
  const alarm = await scheduler.storage.get(alarmId);
  if (!alarm) return { error: "❌ Alarm not found." };

  const wasEnabled = alarm.enabled !== false;
  const newEnabled = !wasEnabled;

  await scheduler.storage.update(alarmId, { enabled: newEnabled });

  if (newEnabled) {
    const updatedAlarm = await scheduler.storage.get(alarmId);
    await scheduler.scheduleAlarm(updatedAlarm);
  } else {
    scheduler.cancelAlarm(alarmId);
  }

  return { alarm, enabled: newEnabled };
}

module.exports = {
  validateTime,
  parseDate,
  buildAlarmDate,
  checkChannelPermissions,
  createAlarm,
  cancelAlarm,
  toggleAlarm,
};
