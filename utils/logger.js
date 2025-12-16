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

class Logger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  log(message, level = "info") {
    // User requested only error logs to appear in console
    if (level !== "error") return;

    const timestamp = new Date().toLocaleTimeString();
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

    console.log(
      `${colors.bright}${colors.white}[${timestamp}]${colors.reset} ${color}${prefix} [${this.moduleName}]${colors.reset} ${message}`,
    );
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
