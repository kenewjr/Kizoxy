const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");
const { getTodaySchedule } = require("./client");
const { formatAnimeEmbed, chunkArray } = require("./formatter");

const DATA_PATH = path.join(__dirname, "../../../data/jikan-schedule.json");

function getScheduleData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH));
  } catch (err) {
    console.error("Error reading schedule data:", err);
    return {};
  }
}

function initScheduler(client) {
  schedule.scheduleJob("0 8 * * *", async () => {
    console.warn("Running daily anime schedule task...");

    const data = getScheduleData();

    try {
      const response = await getTodaySchedule();
      const animeData = response.data;

      if (!animeData || animeData.length === 0) return;

      console.warn(`Fetched ${animeData.length} anime for today.`);

      const allEmbeds = animeData.map((anime) => formatAnimeEmbed(anime));

      const embedChunks = chunkArray(allEmbeds, 10);

      for (const guildId in data) {
        const config = data[guildId];
        if (!config.channelId) continue;

        try {
          const channel = await client.channels.fetch(config.channelId);
          if (channel) {
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

            for (const chunk of embedChunks) {
              await channel.send({ embeds: chunk });
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

  console.warn("Jikan Schedule Handler Loaded. Scheduled for 08:00 AM daily.");
}

module.exports = { initScheduler };
