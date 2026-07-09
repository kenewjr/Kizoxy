const router = require("express").Router();
const Logger = require("../../lib/logger");
const { getBotMeta } = require("../helpers/guildData");
const youtubeStorage = require("../../persistence/youtubeStorage");
const tiktokStorage = require("../../persistence/tiktokStorage");

const logger = new Logger("DASHBOARD");

// GET /api/meta
router.get("/meta", async (req, res) => {
  try {
    const meta = await getBotMeta(req.app.locals.client);
    res.json(meta);
  } catch (err) {
    logger.error(`GET /api/meta: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch bot metadata" });
  }
});

// GET /api/stats
router.get("/stats", async (req, res) => {
  try {
    const client = req.app.locals.client;
    const mem = process.memoryUsage();

    let userCount = 0;
    for (const g of client.guilds.cache.values()) userCount += g.memberCount;

    // Count total subscriptions across all guilds.
    const [ytMap, ttMap] = await Promise.allSettled([
      youtubeStorage.getChannelSubscriberMap(),
      tiktokStorage.getUserSubscriberMap(),
    ]);

    let ytTotal = 0;
    if (ytMap.status === "fulfilled") {
      for (const subs of ytMap.value.values()) ytTotal += subs.length;
    }
    let ttTotal = 0;
    if (ttMap.status === "fulfilled") {
      for (const subs of ttMap.value.values()) ttTotal += subs.length;
    }

    const activeAlarmIds = new Set();
    if (client.alarmScheduler?.jobs) {
      for (const key of client.alarmScheduler.jobs.keys()) {
        const alarmId = key.replace("-notify", "");
        activeAlarmIds.add(alarmId);
      }
    }

    res.json({
      guild_count: client.guilds.cache.size,
      user_count: userCount,
      youtube_total_subs: ytTotal,
      tiktok_total_subs: ttTotal,
      uptime_ms: Math.round(process.uptime() * 1000),
      memory_rss_mb: Math.round(mem.rss / 1024 / 1024),
      active_player_count: client.manager?.players?.size ?? 0,
      active_alarm_count: activeAlarmIds.size,
    });
  } catch (err) {
    logger.error(`GET /api/stats: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/players
router.get("/players", (req, res) => {
  try {
    const client = req.app.locals.client;
    const players = [];

    if (client.manager?.players) {
      for (const player of client.manager.players.values()) {
        try {
          players.push({
            guild_id: player.guildId,
            guild_name:
              client.guilds.cache.get(player.guildId)?.name || "Unknown",
            is_playing: !!player.playing,
            is_paused: !!player.paused,
            current_track: player.queue?.current
              ? {
                  title: player.queue.current.title,
                  author: player.queue.current.author,
                  uri: player.queue.current.uri,
                  duration_ms: player.queue.current.length,
                  position_ms: player.position,
                }
              : null,
            queue_length: player.queue?.length ?? 0,
            voice_channel_id: player.voiceId || null,
          });
        } catch (playerErr) {
          logger.warning(
            `Failed to serialize player for guild ${player.guildId}: ${playerErr.message}`,
          );
        }
      }
    }

    res.json(players);
  } catch (err) {
    logger.error(`GET /api/players: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

module.exports = router;
