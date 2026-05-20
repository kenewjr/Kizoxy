// utils/helpers/alarmSchedulerHelper.js
// Stateless helpers extracted from modules/alarm/alarmScheduler.js so the
// scheduler class itself can stay focused on orchestration / I/O.

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

/**
 * Compute the next occurrence date for a recurring alarm.
 *
 * @param {Date} fromDate     - reference date to advance from
 * @param {string} recurring  - "daily" | "weekly" | "monthly" | "none"
 * @returns {Date} new Date instance (does not mutate fromDate)
 */
function computeNextRecurringDate(fromDate, recurring) {
  const next = new Date(fromDate);
  if (recurring === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (recurring === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (recurring === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/** Format a Date as DD/MM/YYYY HH:mm using the host TZ (legacy embed format). */
function formatAlarmDateString(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

/** Map recurring code → display label for embed copy. */
function recurringText(recurring) {
  if (recurring === "daily") return "Daily";
  if (recurring === "weekly") return "Weekly";
  if (recurring === "monthly") return "Monthly";
  return "Non-recurring";
}

/**
 * Build the green "alarm-set / countdown" embed shown in user channels.
 *
 * @param {object} args
 * @param {string} args.alarmMessage
 * @param {string} args.formattedTime  - DD/MM/YYYY HH:mm
 * @param {string} args.channelId
 * @param {string} args.roleId
 * @param {string} args.recurring      - "none" | "daily" | "weekly" | "monthly"
 * @param {string} args.discordTimestamp - "<t:UNIX:R>"
 */
function buildScheduledEmbed({
  alarmMessage,
  formattedTime,
  channelId,
  roleId,
  recurring,
  discordTimestamp,
}) {
  const countdownText =
    recurring !== "none"
      ? `⏳ Countdown to next trigger: ${discordTimestamp}`
      : `⏳ Countdown: ${discordTimestamp}`;

  return new EmbedBuilder()
    .setDescription(
      `✅ Alarm "${alarmMessage}" has been set!\n` +
        `⏰ Time: ${formattedTime}\n` +
        `🔔 Will trigger in: <#${channelId}>\n` +
        `👥 Role to mention: <@&${roleId}>\n` +
        `🔄 Type: ${recurringText(recurring)}\n` +
        `${countdownText}\n` +
        `🗑️ The alarm message will be auto-deleted after 2 hours`,
    )
    .setColor(0x00ff00);
}

module.exports = {
  MAX_TIMEOUT_MS,
  safeSetTimeout,
  computeNextRecurringDate,
  formatAlarmDateString,
  recurringText,
  buildScheduledEmbed,
};
