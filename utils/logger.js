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

class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  log(message, level = "info") {
    const timestamp = new Date().toISOString();

    // JSON structured output for log aggregation (Logstash, PM2, etc.)
    if (LOG_FORMAT === "json") {
      const entry = {
        timestamp,
        level,
        module: this.moduleName,
        message,
      };
      // Use console.warn for all levels (PM2 compatibility)
      // Use console.error only for actual errors
      if (level === "error") {
        console.error(JSON.stringify(entry));
      } else {
        console.warn(JSON.stringify(entry));
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
    } else {
      console.warn(formatted);
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
