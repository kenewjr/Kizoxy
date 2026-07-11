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

    const donateSeenStorage = require("../../persistence/donateSeenStorage");

    res.json({
      guild_count: client.guilds.cache.size,
      user_count: userCount,
      youtube_total_subs: ytTotal,
      tiktok_total_subs: ttTotal,
      uptime_ms: Math.round(process.uptime() * 1000),
      memory_rss_mb: Math.round(mem.rss / 1024 / 1024),
      active_player_count: client.manager?.players?.size ?? 0,
      active_alarm_count: activeAlarmIds.size,
      donate_seen_count: donateSeenStorage.getSeenCount(),
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

let updatesCache = null;

function isOutdated(current, latest) {
  if (!current || !latest) return false;
  const cleanCurrent = current.replace(/^[\^~]/, "");
  const c = cleanCurrent.split(".").map(Number);
  const l = latest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

// GET /api/updates
router.get("/updates", async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh =
      req.query.refresh === "1" || req.query.refresh === "true";
    if (updatesCache && !forceRefresh && now - updatesCache.timestamp < 60000) {
      return res.json(updatesCache.data);
    }

    const pkg = require("../../../package.json");
    const dependencies = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const packagesList = Object.entries(dependencies).map(
      ([name, current]) => ({
        name,
        current,
        is_dev: Object.prototype.hasOwnProperty.call(
          pkg.devDependencies || {},
          name,
        ),
      }),
    );

    const axios = require("axios");
    const results = await Promise.allSettled(
      packagesList.map(async (p) => {
        try {
          const registryRes = await axios.get(
            `https://registry.npmjs.org/${encodeURIComponent(p.name)}/latest`,
            { timeout: 5000 },
          );
          const latest = registryRes.data?.version ?? null;
          return {
            name: p.name,
            current: p.current,
            latest,
            is_dev: p.is_dev,
            outdated: isOutdated(p.current, latest),
            error: !latest,
          };
        } catch (_err) {
          return {
            name: p.name,
            current: p.current,
            latest: null,
            is_dev: p.is_dev,
            outdated: false,
            error: true,
          };
        }
      }),
    );

    const packages = results.map((r, i) => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      return {
        name: packagesList[i].name,
        current: packagesList[i].current,
        latest: null,
        is_dev: packagesList[i].is_dev,
        outdated: false,
        error: true,
      };
    });

    const outdated_count = packages.filter((p) => p.outdated).length;
    const responseData = {
      checked_at: new Date().toISOString(),
      node_version: process.version,
      packages,
      outdated_count,
      total_count: packages.length,
    };

    updatesCache = {
      timestamp: now,
      data: responseData,
    };

    res.json(responseData);
  } catch (err) {
    logger.error(`GET /api/updates: ${err.message}`);
    res.status(500).json({ error: "Failed to check updates" });
  }
});

// PATCH /api/bot/username
router.patch("/bot/username", async (req, res) => {
  try {
    const { username } = req.body;
    if (
      !username ||
      typeof username !== "string" ||
      !username.trim() ||
      username.length < 2 ||
      username.length > 32
    ) {
      return res
        .status(400)
        .json({ error: "Username must be between 2 and 32 characters." });
    }

    const client = req.app.locals.client;
    await client.user.setUsername(username.trim());
    res.json({ username: client.user.username });
  } catch (err) {
    logger.error(`PATCH /api/bot/username: ${err.message}`);
    res.status(422).json({ error: err.message });
  }
});

// PATCH /api/bot/presence
router.patch("/bot/presence", async (req, res) => {
  try {
    const { status, activity_type, activity_text } = req.body;
    const client = req.app.locals.client;

    const allowedStatuses = ["online", "idle", "dnd", "invisible"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const allowedTypes = ["playing", "listening", "watching", "competing"];
    if (activity_type && !allowedTypes.includes(activity_type)) {
      return res.status(400).json({ error: "Invalid activity type" });
    }

    if (
      activity_text !== undefined &&
      typeof activity_text === "string" &&
      activity_text.length > 128
    ) {
      return res
        .status(400)
        .json({ error: "Activity text must be max 128 characters" });
    }

    const clientReady = require("../../events/client/clientReady");
    clientReady.pausePresenceRotation();

    const { ActivityType } = require("discord.js");
    const typeMap = {
      playing: ActivityType.Playing,
      listening: ActivityType.Listening,
      watching: ActivityType.Watching,
      competing: ActivityType.Competing,
    };

    const activities = activity_text
      ? [{ name: activity_text, type: typeMap[activity_type ?? "playing"] }]
      : [];

    await client.user.setPresence({
      status: status ?? "online",
      activities,
    });

    res.json({
      status: status ?? "online",
      activity: activity_text ?? null,
      rotation_paused: true,
    });
  } catch (err) {
    logger.error(`PATCH /api/bot/presence: ${err.message}`);
    res.status(500).json({ error: "Failed to set presence" });
  }
});

// PATCH /api/bot/presence/resume
router.patch("/bot/presence/resume", async (req, res) => {
  try {
    const clientReady = require("../../events/client/clientReady");
    clientReady.resumePresenceRotation();
    res.json({ rotation_paused: false });
  } catch (err) {
    logger.error(`PATCH /api/bot/presence/resume: ${err.message}`);
    res.status(500).json({ error: "Failed to resume presence rotation" });
  }
});

module.exports = router;
