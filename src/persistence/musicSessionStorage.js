const fs = require("fs").promises;
const path = require("path");
const Logger = require("../lib/logger");
const logger = new Logger("MUSIC-STORAGE");

const FILEPATH = path.join(__dirname, "../../data/musicSessions.json");
const TMP_PATH = `${FILEPATH}.tmp`;
const BACKUP_PATH = `${FILEPATH}.bak`;

const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    await fs.mkdir(path.dirname(FILEPATH), { recursive: true });
    try {
      const content = await fs.readFile(FILEPATH, "utf8");
      cache = JSON.parse(content);
    } catch (err) {
      if (err.code === "ENOENT") {
        cache = {};
        return cache;
      }
      logger.warning(
        `Read/parse failed for ${FILEPATH}: ${err.message}. Trying .bak recovery...`,
      );
      try {
        const bakContent = await fs.readFile(BACKUP_PATH, "utf8");
        cache = JSON.parse(bakContent);
        await fs.writeFile(FILEPATH, bakContent);
        logger.info(`Recovered from ${BACKUP_PATH}`);
      } catch (bakErr) {
        logger.error(`Backup recovery failed: ${bakErr.message}`);
        cache = {};
      }
    }
  } catch (err) {
    logger.error(`Error during load: ${err.message}`);
    cache = {};
  }
  return cache;
}

async function save() {
  if (!cache) return;
  const json = JSON.stringify(cache, null, 2);
  try {
    await fs.copyFile(FILEPATH, BACKUP_PATH).catch(() => {});
    await fs.writeFile(TMP_PATH, json);
    await fs.rename(TMP_PATH, FILEPATH);
  } catch (err) {
    logger.error(`Atomic write failed: ${err.message}`);
    throw err;
  }
}

async function saveSession(guildId, sessionData) {
  await load();
  cache[guildId] = sessionData;
  await save();
}

async function getSession(guildId) {
  await load();
  const session = cache[guildId];
  if (!session) return null;
  if (Date.now() - session.savedAt > SESSION_MAX_AGE_MS) {
    return null;
  }
  return session;
}

async function deleteSession(guildId) {
  await load();
  if (cache[guildId]) {
    delete cache[guildId];
    await save();
  }
}

async function getAllSessions() {
  await load();
  const now = Date.now();
  const valid = [];
  const expiredKeys = [];
  for (const [guildId, session] of Object.entries(cache)) {
    if (now - session.savedAt <= SESSION_MAX_AGE_MS) {
      valid.push(session);
    } else {
      expiredKeys.push(guildId);
    }
  }
  if (expiredKeys.length > 0) {
    for (const key of expiredKeys) {
      delete cache[key];
    }
    await save();
  }
  return valid;
}

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  getAllSessions,
  SESSION_MAX_AGE_MS,
  _clearCache: () => {
    cache = null;
  },
};
