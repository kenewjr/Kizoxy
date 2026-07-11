/* ═══════════════════════════════════════════════════════════════════
   Kizoxy Dashboard — components.js (Shared UI utilities)
   ═══════════════════════════════════════════════════════════════════ */

function classifyLogLine(line) {
  if (!line) return "info";
  // JSON format (production/PM2): {"level":"error",...}
  const m = line.match(/"level"\s*:\s*"(\w+)"/);
  if (m) {
    const lv = m[1].toLowerCase();
    if (lv === "error") return "error";
    if (lv === "warn" || lv === "warning") return "warn";
    if (lv === "success") return "success";
    if (lv === "debug") return "debug";
    return "info";
  }
  // Pretty format (dev): emoji prefixes
  if (line.includes("❌")) return "error";
  if (line.includes("⚠")) return "warn";
  if (line.includes("✅")) return "success";
  if (line.includes("🐛")) return "debug";
  return "info";
}

function formatLogLine(line) {
  if (!line) return "";
  const trimmed = line.trim();
  let jsonStr = "";
  if (trimmed.startsWith("{")) {
    jsonStr = trimmed;
  } else {
    const idx = trimmed.indexOf("{");
    if (idx !== -1) {
      jsonStr = trimmed.slice(idx);
    }
  }

  if (jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const emojis = {
        error: "❌",
        warning: "⚠️",
        warn: "⚠️",
        success: "✅",
        debug: "🐛",
        info: "ℹ️",
      };
      const emoji = emojis[data.level?.toLowerCase()] || "ℹ️";

      let timeStr = "";
      if (data.timestamp) {
        const d = new Date(data.timestamp);
        if (!isNaN(d.getTime())) {
          timeStr = `[${d.toLocaleTimeString()}]`;
        }
      }
      if (!timeStr && !trimmed.startsWith("{")) {
        const idx = trimmed.indexOf("{");
        timeStr = `[${trimmed.slice(0, idx).replace(/:$/, "").trim()}]`;
      }

      const moduleStr = data.module ? ` [${data.module}]` : "";
      return `${timeStr} ${emoji}${moduleStr} ${esc(data.message || "")}`;
    } catch {
      // ignore
    }
  }
  return esc(line);
}

function colorizeLog(content) {
  if (!content) return "";
  return content
    .split("\n")
    .map(
      (line) =>
        `<div class="log-line--${classifyLogLine(line)}">${formatLogLine(line)}</div>`,
    )
    .join("");
}
