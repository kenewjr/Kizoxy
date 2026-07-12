const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const LOG_FORMAT = process.env.LOG_FORMAT || "pretty"; // "pretty" or "json"

// When running in dev (no PM2 redirecting stdout to a file), the dashboard log
// viewer has nothing to read. So the logger also appends structured JSON lines
// to a dated file under logs/. PM2 in production already redirects stdout, so
// this file mirror is harmless there (it just adds an app-managed file too).
const LOGS_DIR = path.join(process.cwd(), "logs");
const FILE_LOGGING = process.env.LOG_TO_FILE !== "false";

let _stream = null;
let _streamDate = null;

function getStream() {
  if (!FILE_LOGGING) return null;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (_stream && _streamDate === today) return _stream;
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    if (_stream) _stream.end();
    _stream = fs.createWriteStream(path.join(LOGS_DIR, `kizoxy-${today}.log`), {
      flags: "a",
    });
    _streamDate = today;
    return _stream;
  } catch {
    return null; // never let logging break the app
  }
}

class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  log(message, level = "info") {
    const timestamp = new Date().toISOString();

    // Always mirror a clean JSON line to the dated log file so the dashboard
    // log viewer works in every run mode. Parser reads the "level" field.
    const stream = getStream();
    if (stream) {
      stream.write(
        JSON.stringify({
          timestamp,
          level,
          module: this.moduleName,
          message,
        }) + "\n",
      );
    }

    if (LOG_FORMAT === "json") {
      const entry = {
        timestamp,
        level,
        module: this.moduleName,
        message,
      };
      if (level === "error") {
        console.error(JSON.stringify(entry));
      } else if (level === "warning") {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
      return;
    }

    // Pretty-print for local development
    let color = colors.white;
    let prefix = "ℹ️";

    switch (level) {
      case "success":
        color = colors.green;
        prefix = "✅";
        break;
      case "error":
        color = colors.red;
        prefix = "❌";
        break;
      case "warning":
        color = colors.yellow;
        prefix = "⚠️";
        break;
      case "debug":
        color = colors.blue;
        prefix = "🐛";
        break;
      case "info":
      default:
        color = colors.cyan;
        prefix = "ℹ️";
    }

    const formatted = `${colors.bright}${colors.white}[${new Date().toLocaleTimeString()}]${colors.reset} ${color}${prefix} [${this.moduleName}]${colors.reset} ${message}`;

    if (level === "error") {
      console.error(formatted);
    } else if (level === "warning") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  success(message) {
    this.log(message, "success");
  }

  error(message) {
    this.log(message, "error");
  }

  warning(message) {
    this.log(message, "warning");
  }

  info(message) {
    this.log(message, "info");
  }

  debug(message) {
    this.log(message, "debug");
  }
}

module.exports = Logger;
