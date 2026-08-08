// Simple file-backed storage for TikTok session cookies.
// Cookies are stored at data/tiktok_cookies.json — excluded from git via data/*.json rule.
const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "../../data/tiktok_cookies.json");

function loadCookies() {
  try {
    if (!fs.existsSync(COOKIES_PATH)) return null;
    const raw = fs.readFileSync(COOKIES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error("cookies must be a non-empty array");
  }
  const dir = path.dirname(COOKIES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = COOKIES_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cookies, null, 2), "utf8");
  fs.renameSync(tmp, COOKIES_PATH);
}

function deleteCookies() {
  if (fs.existsSync(COOKIES_PATH)) fs.unlinkSync(COOKIES_PATH);
}

function hasCookies() {
  return !!loadCookies();
}

module.exports = { loadCookies, saveCookies, deleteCookies, hasCookies };
