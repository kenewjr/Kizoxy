const axios = require("axios");

const BASE_URL = "https://api.jikan.moe/v4";

const SCHEDULE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const _scheduleCache = new Map(); // key → { data, expiresAt }

function _cacheKey(filter) {
  return `schedule:${filter || "all"}`;
}

function clearScheduleCache() {
  _scheduleCache.clear();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSchedule(filter, { bypassCache = false } = {}) {
  const key = _cacheKey(filter);
  if (!bypassCache) {
    const hit = _scheduleCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      console.warn(`[Jikan] cache hit for ${key}`);
      return hit.data;
    }
  }
  let allAnime = [];
  let page = 1;
  let hasNextPage = true;
  let kids = false;

  try {
    console.warn(`📡 Fetching schedule for ${filter || "all"}...`);

    while (hasNextPage) {
      const url = filter
        ? `${BASE_URL}/schedules?filter=${filter}&page=${page}&kids=${kids}`
        : `${BASE_URL}/schedules?page=${page}&kids=${kids}`;

      console.warn(`   fetching page ${page}...`);
      const response = await axios.get(url);
      const { data, pagination } = response.data;

      if (data && Array.isArray(data)) {
        allAnime.push(...data);
      }

      hasNextPage = pagination?.has_next_page || false;
      page++;

      if (hasNextPage) await delay(500);
    }

    console.warn(`✅ Fetched total ${allAnime.length} entries.`);

    allAnime.sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA; // High score first

      const popA = a.members || 0;
      const popB = b.members || 0;
      return popB - popA; // High popularity second
    });

    const result = { data: allAnime };
    _scheduleCache.set(key, {
      data: result,
      expiresAt: Date.now() + SCHEDULE_TTL_MS,
    });
    return result;
  } catch (error) {
    console.error("Error fetching Jikan schedule:", error.message);
    throw error;
  }
}

async function getTodaySchedule() {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const today = days[new Date().getDay()];
  return getSchedule(today);
}

module.exports = {
  getSchedule,
  getTodaySchedule,
  clearScheduleCache,
};
