const fs = require("fs");
const path = require("path");

let errors = 0;

function checkDir(dirPath, checkFn) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      const files = fs.readdirSync(itemPath).filter((f) => f.endsWith(".js"));
      for (const file of files) {
        const filePath = path.join(itemPath, file);
        try {
          const module = require(filePath);
          checkFn(module, filePath);
        } catch (e) {
          console.error(`❌ Crash when loading ${filePath}: ${e.message}`);
          errors++;
        }
      }
    } else if (item.endsWith(".js")) {
      try {
        const module = require(itemPath);
        checkFn(module, itemPath);
      } catch (e) {
        console.error(`❌ Crash when loading ${itemPath}: ${e.message}`);
        errors++;
      }
    }
  }
}

console.log("Validating Slash Commands...");
checkDir(path.join(__dirname, "../../commands/Slash"), (cmd, file) => {
  const cmds = Array.isArray(cmd) ? cmd : [cmd];
  for (const c of cmds) {
    if (!c.name || !c.run) {
      console.error(`❌ Invalid slash command structure in ${file}`);
      errors++;
    }
  }
});

console.log("Validating Prefix Commands...");
checkDir(path.join(__dirname, "../../commands/Prefix"), (cmd, file) => {
  const cmds = Array.isArray(cmd) ? cmd : [cmd];
  for (const c of cmds) {
    if (!c.name) {
      console.error(`❌ Invalid prefix command structure in ${file}`);
      errors++;
    }
  }
});

console.log("Validating Events...");
checkDir(path.join(__dirname, "../../events"), (event, file) => {
  // Events export a single function, not an object with name and run
  if (typeof event !== "function") {
    console.error(
      `❌ Invalid event structure in ${file}: expected a function export.`,
    );
    errors++;
  }
});

if (errors > 0) {
  console.error(`\n🔥 Module validation failed with ${errors} errors.`);
  process.exit(1);
} else {
  console.log("✅ All command modules are structurally valid!");
  process.exit(0);
}
