const axios = require("axios");

const BASE_URL = "https://api.jikan.moe/v4";

/**
 * Delay function to prevent rate limiting (Jikan has a strict rate limit).
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch all pages of anime schedule for a specific day.
 * @param {string} filter - Day of the week (monday, tuesday, etc.)
 * @returns {Promise<Object>} Object containing { data: Array } with all items sorted by score.
 */
async function getSchedule(filter) {
  let allAnime = [];
  let page = 1;
  let hasNextPage = true;
  let kids = false;

  try {
    console.log(`📡 Fetching schedule for ${filter || "all"}...`);

    while (hasNextPage) {
      const url = filter
        ? `${BASE_URL}/schedules?filter=${filter}&page=${page}&kids=${kids}`
        : `${BASE_URL}/schedules?page=${page}&kids=${kids}`;

      console.log(`   fetching page ${page}...`);
      const response = await axios.get(url);
      const { data, pagination } = response.data;

      if (data && Array.isArray(data)) {
        allAnime.push(...data);
      }

      hasNextPage = pagination?.has_next_page || false;
      page++;

      // Jikan Rate Limit: 3 requests per second (approx 333ms delay needed)
      // Adding 500ms to be safe.
      if (hasNextPage) await delay(500);
    }

    console.log(`✅ Fetched total ${allAnime.length} entries.`);

    // Sort by Score (Descending), then by Members/Popularity (Descending)
    // Note: 'members' is usually available on anime objects.
    allAnime.sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA; // High score first

      const popA = a.members || 0;
      const popB = b.members || 0;
      return popB - popA; // High popularity second
    });

    // Return in expected structure { data: [...] }
    return { data: allAnime };
  } catch (error) {
    console.error("Error fetching Jikan schedule:", error.message);
    throw error;
  }
}

/**
 * Fetch anime schedule for the current day, handling all pages and sorting.
 * @returns {Promise<Object>} Object containing { data: Array }
 */
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
};
