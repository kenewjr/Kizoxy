/**
 * Alarm Service — shared CRUD + validation logic for alarms.
 * Used by:  commands/Slash/Alarm/* , buttons/alarm.js
 */

const { PermissionsBitField } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

// ── Validation ──────────────────────────────────────────

const WAKTU_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const TANGGAL_REGEX = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;

/**
 * Validate time string format (HH:mm).
 * @returns {string|null} Error message, or null if valid
 */
function validateTime(waktu) {
  if (!WAKTU_REGEX.test(waktu)) {
    return "❌ Format waktu tidak valid! Gunakan format HH:mm (contoh: 14:30)";
  }
  return null;
}

/**
 * Validate date string format (DD/MM/YYYY or DD/MM).
 * @returns {{ day, month, year }|{ error: string }}
 */
function parseDate(tanggal) {
  const match = tanggal.match(TANGGAL_REGEX);
  if (!match) {
    return {
      error:
        "❌ Format tanggal tidak valid! Gunakan format DD/MM/YYYY atau DD/MM",
    };
  }

  let day = parseInt(match[1]);
  let month = parseInt(match[2]);
  let year = match[3] ? parseInt(match[3]) : new Date().getFullYear();

  if (match[3] && match[3].length === 2) {
    year = 2000 + year;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { error: "❌ Tanggal atau bulan tidak valid!" };
  }

  return { day, month, year };
}

/**
 * Build a Date object from alarm params and validate it.
 * @returns {{ alarmDate: Date }|{ error: string }}
 */
function buildAlarmDate({ waktu, tanggal, recurring = "none" }) {
  const [hours, minutes] = waktu.split(":").map(Number);
  const now = new Date();

  let alarmDate;
  if (tanggal) {
    const parsed = parseDate(tanggal);
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
          "❌ Tanggal tidak valid! Pastikan tanggal sesuai dengan kalender.",
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
        "❌ Waktu alarm tidak boleh di masa lalu untuk alarm tidak berulang!",
    };
  }

  return { alarmDate };
}

/**
 * Check bot permissions in a channel.
 * @returns {string|null} Error message, or null if permissions are OK
 */
function checkChannelPermissions(channel, guild) {
  if (channel.type !== 0) {
    return "❌ Channel harus berupa text channel!";
  }

  const perms = channel.permissionsFor(guild.members.me);
  if (!perms.has(PermissionsBitField.Flags.SendMessages)) {
    return "❌ Saya tidak memiliki izin untuk mengirim pesan di channel tersebut!";
  }
  if (!perms.has(PermissionsBitField.Flags.MentionEveryone)) {
    return "❌ Saya tidak memiliki izin untuk mention role di channel tersebut!";
  }

  return null;
}

// ── CRUD Operations ─────────────────────────────────────

/**
 * Create a new alarm.
 * @returns {{ alarm, alarmDate }|{ error: string }}
 */
async function createAlarm(
  scheduler,
  {
    guildId,
    channelId,
    roleId,
    userId,
    message,
    waktu,
    tanggal,
    recurring = "none",
  },
) {
  const dateResult = buildAlarmDate({ waktu, tanggal, recurring });
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

/**
 * Toggle an alarm on/off.
 * @returns {{ alarm, enabled: boolean }}
 */
async function toggleAlarm(scheduler, alarmId) {
  const alarm = await scheduler.storage.get(alarmId);
  if (!alarm) return { error: "❌ Alarm tidak ditemukan." };

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
