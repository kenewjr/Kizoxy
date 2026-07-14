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

// GET /api/health
router.get("/health", (req, res) => {
  const client = req.app.locals.client;
  if (!client || !client.ws || client.ws.status !== 0) {
    return res.status(503).json({
      status: "unhealthy",
      ws_status: client?.ws?.status ?? -1,
      uptime_ms: process.uptime() * 1000,
    });
  }
  return res.json({
    status: "ok",
    uptime_ms: process.uptime() * 1000,
  });
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
    const romajiConverter = require("../../features/lyrics/romajiConverter");

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
      romaji_cache: romajiConverter.getCacheStats(),
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
              active_filters: player.filtersState || {},
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

    const results = await Promise.allSettled(
      packagesList.map(async (p) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const registryRes = await fetch(
            `https://registry.npmjs.org/${encodeURIComponent(p.name)}/latest`,
            { signal: controller.signal },
          );
          if (!registryRes.ok) throw new Error(`HTTP ${registryRes.status}`);
          const registryData = await registryRes.json();
          const latest = registryData?.version ?? null;
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
        } finally {
          clearTimeout(timer);
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
    const {
      status,
      activity_type,
      activity_text,
      custom_activities,
      pause_rotation,
    } = req.body;
    const client = req.app.locals.client;

    const allowedStatuses = ["online", "idle", "dnd", "invisible"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const fs = require("fs");
    const path = require("path");
    const overridesPath = path.join(
      __dirname,
      "../../../data/config_overrides.json",
    );
    const dir = path.dirname(overridesPath);

    let currentOverrides = {};
    if (fs.existsSync(overridesPath)) {
      try {
        currentOverrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      } catch (_) {}
    }

    if (status) {
      currentOverrides.bot_status = status;
    }

    if (custom_activities !== undefined) {
      currentOverrides.custom_activities = custom_activities;
    }

    let rotation_paused = currentOverrides.rotation_paused ?? false;
    if (pause_rotation !== undefined) {
      rotation_paused = pause_rotation;
    } else if (activity_text !== undefined) {
      rotation_paused = true;
    }

    currentOverrides.rotation_paused = rotation_paused;
    const clientReady = require("../../events/client/clientReady");
    if (rotation_paused) {
      clientReady.pausePresenceRotation();
    } else {
      clientReady.resumePresenceRotation();
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = overridesPath + ".tmp";
    fs.writeFileSync(
      tempPath,
      JSON.stringify(currentOverrides, null, 2),
      "utf8",
    );
    fs.renameSync(tempPath, overridesPath);

    // Apply presence immediately
    const targetStatus = status ?? currentOverrides.bot_status ?? "online";
    if (currentOverrides.rotation_paused) {
      const { ActivityType } = require("discord.js");
      const typeMap = {
        playing: ActivityType.Playing,
        listening: ActivityType.Listening,
        watching: ActivityType.Watching,
        competing: ActivityType.Competing,
      };
      const actText =
        activity_text !== undefined
          ? activity_text
          : custom_activities?.[0]?.text || null;
      const actType =
        activity_type !== undefined
          ? activity_type
          : custom_activities?.[0]?.type || "playing";
      const type = typeMap[actType];
      await client.user.setPresence({
        status: targetStatus,
        activities: actText ? [{ name: actText, type }] : [],
      });
    } else {
      await client.user.setPresence({
        status: targetStatus,
      });
    }

    res.json({
      status: targetStatus,
      activity:
        activity_text !== undefined
          ? activity_text
          : custom_activities?.[0]?.text || null,
      rotation_paused: !!currentOverrides.rotation_paused,
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

// POST /api/deploy/slash
router.post("/deploy/slash", async (req, res) => {
  try {
    const { scope, guild_id, clear } = req.body;
    const client = req.app.locals.client;

    if (!client || !client.user) {
      return res.status(503).json({ error: "Bot client is not ready yet." });
    }

    if (scope !== "global" && scope !== "guild") {
      return res.status(400).json({ error: "Scope must be 'global' or 'guild'." });
    }

    if (scope === "guild" && (!guild_id || !/^\d{17,20}$/.test(guild_id))) {
      return res.status(400).json({ error: "Valid Guild ID is required for guild scope." });
    }

    const { REST, Routes } = require("discord.js");
    const rest = new REST({ version: "10" }).setToken(config.TOKEN);
    const { loadAndValidateCommands } = require("../../../scripts/deploySlash");

    const commands = await loadAndValidateCommands();

    if (clear) {
      if (scope === "global") {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      } else {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guild_id), { body: [] });
      }
    }

    const route = scope === "guild"
      ? Routes.applicationGuildCommands(client.user.id, guild_id)
      : Routes.applicationCommands(client.user.id);

    const result = await rest.put(route, { body: commands });

    res.json({
      deployed: result.length,
      scope,
      guild_id: scope === "guild" ? guild_id : null
    });
  } catch (err) {
    logger.error(`POST /api/deploy/slash failed: ${err.message}`);
    res.status(422).json({ error: err.message || "Failed to deploy slash commands." });
  }
});

module.exports = router;
