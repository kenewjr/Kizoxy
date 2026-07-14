const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../data/donate_seen.json");

let data = null;
let pendingSave = false;
let batchCount = 0;
let saveTimeout = null;

function ensureLoaded() {
  if (data !== null) return;
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      data = JSON.parse(content);
      if (!data || !Array.isArray(data.seenUserIds)) {
        data = { seenUserIds: [] };
      }
    } else {
      data = { seenUserIds: [] };
    }
  } catch (_err) {
    data = { seenUserIds: [] };
  }
}

function saveNow() {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = filePath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(data), "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (_err) {
    // catch write errors
  }
  pendingSave = false;
  batchCount = 0;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

function scheduleSave() {
  batchCount++;
  if (batchCount >= 5) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveNow();
  } else if (!pendingSave) {
    pendingSave = true;
    saveTimeout = setTimeout(() => {
      saveNow();
    }, 2000);
  }
}

function hasSeen(userId) {
  try {
    ensureLoaded();
    return data.seenUserIds.includes(userId);
  } catch (_err) {
    return false;
  }
}

function markSeen(userId) {
  try {
    ensureLoaded();
    if (!data.seenUserIds.includes(userId)) {
      data.seenUserIds.push(userId);
      scheduleSave();
    }
  } catch (_err) {
    // ignore
  }
}

function getSeenCount() {
  try {
    ensureLoaded();
    return data.seenUserIds.length;
  } catch (_err) {
    return 0;
  }
}

module.exports = {
  hasSeen,
  markSeen,
  getSeenCount,
  flush: saveNow,
};
