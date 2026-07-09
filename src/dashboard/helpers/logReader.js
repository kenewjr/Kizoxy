const fs = require("fs");
const path = require("path");
const { MAX_LOG_LINES, LOG_SEARCH_MAX } = require("../../config/constants");

const LOGS_DIR = path.join(process.cwd(), "logs");
const VALID_NAME = /^[\w.\-]+$/;

function validateName(name) {
  if (!name || !VALID_NAME.test(name) || name.includes("..")) {
    throw Object.assign(new Error("Invalid log file name"), { code: "EINVAL" });
  }
}

function listLogFiles() {
  try {
    const entries = fs.readdirSync(LOGS_DIR);
    return entries
      .map((name) => {
        const full = path.join(LOGS_DIR, name);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) return null;
          return { name, size_bytes: stat.size, modified_at: stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.modified_at - a.modified_at);
  } catch {
    return [];
  }
}

function readLogFile(name, tailLines) {
  validateName(name);
  const full = path.join(LOGS_DIR, name);
  if (!fs.existsSync(full)) {
    throw Object.assign(new Error("Log file not found"), { code: "ENOENT" });
  }
  const content = fs.readFileSync(full, "utf8");
  let lines = content.split("\n");
  if (lines.length > MAX_LOG_LINES) lines = lines.slice(-MAX_LOG_LINES);
  if (tailLines && tailLines > 0) lines = lines.slice(-tailLines);
  return lines.join("\n");
}

function searchLogFile(name, query) {
  validateName(name);
  const full = path.join(LOGS_DIR, name);
  if (!fs.existsSync(full)) {
    throw Object.assign(new Error("Log file not found"), { code: "ENOENT" });
  }
  const content = fs.readFileSync(full, "utf8");
  const lower = query.toLowerCase();
  const matches = [];
  for (const line of content.split("\n")) {
    if (line.toLowerCase().includes(lower)) {
      matches.push(line);
      if (matches.length >= LOG_SEARCH_MAX) break;
    }
  }
  return matches;
}

const { getLevelFromLine } = require("./logParser");

function getLogLevelCounts(name) {
  validateName(name);
  const full = path.join(LOGS_DIR, name);
  if (!fs.existsSync(full)) {
    throw Object.assign(new Error("Log file not found"), { code: "ENOENT" });
  }
  const content = fs.readFileSync(full, "utf8");
  const lines = content.split("\n");
  const counts = {
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    DEBUG: 0,
    SUCCESS: 0,
    TOTAL: 0,
  };

  let linesToCount = lines;
  if (linesToCount.length > MAX_LOG_LINES) {
    linesToCount = linesToCount.slice(-MAX_LOG_LINES);
  }

  for (const line of linesToCount) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lvl = getLevelFromLine(line);
    if (counts[lvl] !== undefined) {
      counts[lvl]++;
    }
    counts.TOTAL++;
  }

  return counts;
}

module.exports = {
  listLogFiles,
  readLogFile,
  searchLogFile,
  getLogLevelCounts,
};
