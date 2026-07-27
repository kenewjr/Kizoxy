const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "..", "tests", "logs");

if (fs.existsSync(LOGS_DIR)) {
  fs.rmSync(LOGS_DIR, { recursive: true, force: true });
  console.log(`Removed ${LOGS_DIR}`);
} else {
  console.log("tests/logs/ does not exist — nothing to clean.");
}

// Safety net: also remove a legacy root-level coverage/ folder in
// case an older jest.config.js run (before this change) left one.
const legacyCoverage = path.join(__dirname, "..", "coverage");
if (fs.existsSync(legacyCoverage)) {
  fs.rmSync(legacyCoverage, { recursive: true, force: true });
  console.log(`Removed legacy ${legacyCoverage}`);
}
