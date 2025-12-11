const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");
const { getTodaySchedule } = require("./client");
const { formatAnimeEmbed, chunkArray } = require("./formatter");

const DATA_PATH = path.join(__dirname, "./data/jikan-schedule.json");

/**
 * Validates and ensures the Jikan schedule data file exists.
 * @returns {Object} The schedule data.
 */
function getScheduleData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH));
  } catch (err) {
    console.error("Error reading schedule data:", err);
    return {};
  }
}

/**
 * Initializes the Jikan Daily Scheduler.
 * @param {Object} client - The Discord Client instance.
 */
function initScheduler(client) {
  // Schedule the job to run every day at 08:00 AM
  schedule.scheduleJob("0 8 * * *", async () => {
    console.log("Running daily anime schedule task...");

    const data = getScheduleData();

    // Fetch schedule once for all guilds
    try {
      const response = await getTodaySchedule();
      const animeData = response.data;

      if (!animeData || animeData.length === 0) return;

      console.log(`Fetched ${animeData.length} anime for today.`);

      // Format all anime into embeds
      const allEmbeds = animeData.map((anime) => formatAnimeEmbed(anime));

      // Chunk embeds into groups of 10 (Discord limit per message)
      const embedChunks = chunkArray(allEmbeds, 10);

      // Send to all configured channels
      for (const guildId in data) {
        const config = data[guildId];
        if (!config.channelId) continue;

        try {
          const channel = await client.channels.fetch(config.channelId);
          if (channel) {
            // Send header message
            const days = [
              "Minggu",
              "Senin",
              "Selasa",
              "Rabu",
              "Kamis",
              "Jumat",
              "Sabtu",
            ];
            const date = new Date();
            const dayName = days[date.getDay()];
            const dateNum = date.getDate();
            await channel.send({
              content: `📅 **Jadwal Update Anime Hari '${dayName}' Pada Tanggal '${dateNum}'**`,
            });

            // Send each chunk as a separate message
            for (const chunk of embedChunks) {
              await channel.send({ embeds: chunk });
              // Small delay to prevent rate limits
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (err) {
          console.error(
            `Failed to send schedule to guild ${guildId}:`,
            err.message,
          );
        }
      }
    } catch (err) {
      console.error("Error running daily schedule task:", err);
    }
  });

  console.log("Jikan Schedule Handler Loaded. Scheduled for 08:00 AM daily.");
}

module.exports = { initScheduler };
