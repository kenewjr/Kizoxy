const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "..", "tests", "logs");
const LATEST_LOG = path.join(LOGS_DIR, "latest-test-run.log");
const PREVIOUS_LOG = path.join(LOGS_DIR, "previous-test-run.log");

fs.mkdirSync(LOGS_DIR, { recursive: true });

// Rotate: whatever was "latest" becomes "previous" before this run
// overwrites "latest" — gives one step of before/after history with
// zero clutter, no timestamps to hunt through.
if (fs.existsSync(LATEST_LOG)) {
  fs.copyFileSync(LATEST_LOG, PREVIOUS_LOG);
}

// Forward extra CLI args (e.g. --coverage) straight through to jest,
// so this ONE script serves both `npm test` and `npm run test:coverage`.
const extraArgs = process.argv.slice(2).join(" ");
const command = `npx jest tests/ ${extraArgs} 2>&1`.trim();

console.log(`Running: ${command}\n`);

let exitCode = 0;
let output = "";
try {
  output = execSync(command, { encoding: "utf8", stdio: "pipe" });
} catch (err) {
  // Jest exits non-zero on failing tests — still capture full
  // stdout+stderr and reflect the real exit code, never swallow it.
  output = (err.stdout ?? "") + (err.stderr ?? "");
  exitCode = err.status ?? 1;
}

const header =
  `Run at: ${new Date().toISOString()}\n` +
  `Command: ${command}\n` +
  `${"=".repeat(60)}\n\n`;

fs.writeFileSync(LATEST_LOG, header + output, "utf8");

// Still print everything to the terminal as normal — this script
// is a transparent wrapper, not a silent one.
console.log(output);
console.log(`\nFull output saved to: ${LATEST_LOG}`);

process.exit(exitCode);
