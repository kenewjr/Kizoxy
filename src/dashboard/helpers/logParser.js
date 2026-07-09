// Detects log level from a raw log line.
//
// The bot's logger (src/lib/logger.js) emits TWO on-disk formats depending on
// LOG_FORMAT env:
//   - "json"   (production/PM2): {"timestamp":"..","level":"error","module":".."}
//   - "pretty" (development):    "[time] ❌ [MODULE] message"  (emoji-prefixed)
// Neither format uses bracket tokens like "[ERROR]", so we detect via the JSON
// `level` field first, then fall back to the pretty-print emoji prefix.

const LOG_LEVELS = [
  { id: "ERROR", token: "ERROR" },
  { id: "WARN", token: "WARN" },
  { id: "SUCCESS", token: "SUCCESS" },
  { id: "INFO", token: "INFO" },
  { id: "DEBUG", token: "DEBUG" },
];

// logger level string -> parser level id
const JSON_LEVEL_MAP = {
  error: "ERROR",
  warning: "WARN",
  warn: "WARN",
  success: "SUCCESS",
  info: "INFO",
  debug: "DEBUG",
};

// pretty-print emoji prefix -> parser level id
const EMOJI_MAP = [
  { emoji: "❌", id: "ERROR" },
  { emoji: "⚠️", id: "WARN" },
  { emoji: "✅", id: "SUCCESS" },
  { emoji: "🐛", id: "DEBUG" },
  { emoji: "ℹ️", id: "INFO" },
];

function getLevelFromLine(line) {
  if (!line) return "INFO";

  // JSON format: try to extract the "level" field. PM2 may prepend a date
  // prefix before the JSON, so search for the level key rather than JSON.parse.
  const jsonMatch = line.match(/"level"\s*:\s*"(\w+)"/);
  if (jsonMatch) {
    const mapped = JSON_LEVEL_MAP[jsonMatch[1].toLowerCase()];
    if (mapped) return mapped;
  }

  // Pretty format: detect by emoji prefix.
  for (const { emoji, id } of EMOJI_MAP) {
    if (line.includes(emoji)) return id;
  }

  return "INFO";
}

module.exports = { getLevelFromLine, LOG_LEVELS, JSON_LEVEL_MAP, EMOJI_MAP };
