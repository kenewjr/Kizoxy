const LIST_PAGE_SIZE = 5;
const SELECT_PAGE_SIZE = 25;

function totalPages(items, pageSize) {
  return Math.max(1, Math.ceil(items.length / pageSize));
}

function clampPage(page, total) {
  if (Number.isNaN(page) || page < 0) return 0;
  if (page >= total) return total - 1;
  return page;
}

function sliceForPage(items, page, pageSize) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

// ── Date / Label helpers ─────────────────────────────────────────────
function formatAlarmDate(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function recurringLabel(recurring) {
  if (recurring === "daily") return "Daily";
  if (recurring === "weekly") return "Weekly";
  if (recurring === "monthly") return "Monthly";
  return "Non-recurring";
}

function alarmStatus(alarm) {
  const timeLeft = new Date(alarm.time).getTime() - Date.now();
  if (alarm.enabled === false) return "⏸️ Disabled";
  if (timeLeft < 0) return "🔔 Missed";
  if (timeLeft < 60000) return "🔔 Soon";
  return "⏳ Waiting";
}

module.exports = {
  LIST_PAGE_SIZE,
  SELECT_PAGE_SIZE,
  totalPages,
  clampPage,
  sliceForPage,
  formatAlarmDate,
  recurringLabel,
  alarmStatus,
};
