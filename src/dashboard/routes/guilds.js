const router = require("express").Router();
const Logger = require("../../lib/logger");
const { getGuildList, getGuildDetail } = require("../helpers/guildData");
const fixembedStorage = require("../../persistence/fixembedStorage");

const logger = new Logger("DASHBOARD");

const VALID_VIEW_MODES = ["normal", "direct", "gallery", "text"];

// GET /api/guilds
router.get("/", async (req, res) => {
  try {
    const list = await getGuildList(req.app.locals.client);
    res.json(list);
  } catch (err) {
    logger.error(`GET /api/guilds: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch guilds" });
  }
});

// GET /api/guilds/:id
router.get("/:id", async (req, res) => {
  try {
    const detail = await getGuildDetail(req.app.locals.client, req.params.id);
    if (!detail) return res.status(404).json({ error: "Guild not found" });
    res.json(detail);
  } catch (err) {
    logger.error(`GET /api/guilds/${req.params.id}: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch guild" });
  }
});

// PATCH /api/guilds/:id/fixembed
router.patch("/:id/fixembed", (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, view_mode } = req.body;

    if (enabled !== undefined && typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }
    if (view_mode !== undefined && !VALID_VIEW_MODES.includes(view_mode)) {
      return res.status(400).json({
        error: `view_mode must be one of: ${VALID_VIEW_MODES.join(", ")}`,
      });
    }

    if (enabled !== undefined) fixembedStorage.setEnabled(id, enabled);
    if (view_mode !== undefined) fixembedStorage.setViewMode(id, view_mode);

    res.json(fixembedStorage.getSettings(id));
  } catch (err) {
    logger.error(`PATCH /api/guilds/${req.params.id}/fixembed: ${err.message}`);
    res.status(500).json({ error: "Failed to update fixembed settings" });
  }
});

// GET /api/guilds/:id/setlog
router.get("/:id/setlog", (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const logChannelId = client.logStorage?.getChannel(id) || null;
    res.json({ log_channel_id: logChannelId });
  } catch (err) {
    logger.error(`GET /api/guilds/${req.params.id}/setlog: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch log channel" });
  }
});

// PUT /api/guilds/:id/setlog
router.put("/:id/setlog", (req, res) => {
  try {
    const { id } = req.params;
    const { channel_id } = req.body;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    if (channel_id !== null) {
      if (typeof channel_id !== "string" || !/^\d{17,20}$/.test(channel_id)) {
        return res.status(400).json({ error: "Invalid channel_id format" });
      }
      const channel = guild.channels.cache.get(channel_id);
      if (!channel) {
        return res
          .status(422)
          .json({ error: "Channel not found in this guild's cache" });
      }
      client.logStorage.setChannel(id, channel_id);
    } else {
      client.logStorage.removeChannel(id);
    }

    res.json({ log_channel_id: client.logStorage.getChannel(id) || null });
  } catch (err) {
    logger.error(`PUT /api/guilds/${req.params.id}/setlog: ${err.message}`);
    res.status(500).json({ error: "Failed to update log channel" });
  }
});

// PATCH /api/guilds/:id/alarms/:alarmId
router.patch("/:id/alarms/:alarmId", async (req, res) => {
  try {
    const { id, alarmId } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const alarm = await client.alarmStorage.get(alarmId);
    if (!alarm || alarm.guildId !== id) {
      return res.status(404).json({ error: "Alarm not found in this guild" });
    }

    const { message, time, date, recurring, channelId, roleId } = req.body;
    const patch = {};
    if (message !== undefined) patch.message = message;
    if (time !== undefined) patch.time = time;
    if (date !== undefined) patch.date = date;
    if (recurring !== undefined) patch.recurring = recurring;
    if (channelId !== undefined) {
      if (channelId !== null && !guild.channels.cache.get(channelId)) {
        return res
          .status(422)
          .json({ error: "Channel not found in this guild" });
      }
      patch.channelId = channelId;
    }
    if (roleId !== undefined) patch.roleId = roleId;

    const alarmService = require("../../features/alarm/alarmService");
    const result = await alarmService.updateAlarm(
      client.alarmScheduler,
      alarmId,
      patch,
    );
    if (result.error) return res.status(422).json({ error: result.error });
    res.json(result.alarm);
  } catch (err) {
    logger.error(
      `PATCH /api/guilds/${req.params.id}/alarms/${req.params.alarmId}: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to update alarm" });
  }
});

// DELETE /api/guilds/:id/alarms/:alarmId
router.delete("/:id/alarms/:alarmId", async (req, res) => {
  try {
    const { id, alarmId } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const alarm = await client.alarmStorage.get(alarmId);
    if (!alarm || alarm.guildId !== id) {
      return res.status(404).json({ error: "Alarm not found in this guild" });
    }

    const alarmService = require("../../features/alarm/alarmService");
    await alarmService.cancelAlarm(client.alarmScheduler, alarmId);
    res.json({ cancelled: true, alarm_id: alarmId });
  } catch (err) {
    logger.error(
      `DELETE /api/guilds/${req.params.id}/alarms/${req.params.alarmId}: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to delete alarm" });
  }
});

// GET /api/guilds/:id/tempvc/generators
router.get("/:id/tempvc/generators", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const tempVcStorage = require("../../persistence/tempVcStorage");
    const tempvc = await tempVcStorage._guild(id).catch(() => null);
    if (!tempvc || !tempvc.generators) {
      return res.json([]);
    }

    const tempChannels = tempvc.tempChannels
      ? Object.values(tempvc.tempChannels)
      : [];
    const voiceRoles = tempvc.voiceRoles || [];
    const templates = tempvc.templates ? Object.values(tempvc.templates) : [];

    const list = Object.values(tempvc.generators).map((gen) => {
      const genRoles = voiceRoles
        .filter((vr) => vr.channelId === gen.id)
        .map((vr) => vr.roleId);

      const genTemplates = templates.filter(
        (t) => t.generatorId === gen.id || t.id === gen.templateId,
      );

      return {
        id: gen.id,
        channelId: gen.id,
        guildId: id,
        defaultName: gen.defaultName || null,
        limit: gen.defaultLimit ?? 0,
        bitrate: gen.defaultBitrate ?? null,
        voiceRoles: genRoles,
        templates: genTemplates,
        activeChannelCount: tempChannels.filter((c) => c.generatorId === gen.id)
          .length,
      };
    });

    res.json(list);
  } catch (err) {
    logger.error(
      `GET /api/guilds/${req.params.id}/tempvc/generators: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to fetch TempVC generators" });
  }
});

// GET /api/guilds/:id/level/settings
router.get("/:id/level/settings", (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const levelSettingsStorage = require("../../persistence/levelSettingsStorage");
    res.json(levelSettingsStorage.getSettings(id));
  } catch (err) {
    logger.error(
      `GET /api/guilds/${req.params.id}/level/settings: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to fetch level settings" });
  }
});

// PATCH /api/guilds/:id/level/settings
router.patch("/:id/level/settings", (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const {
      xp_enabled,
      level_up_channel_id,
      xp_min,
      xp_max,
      cooldown_seconds,
    } = req.body;
    const patch = {};

    if (xp_enabled !== undefined) {
      if (typeof xp_enabled !== "boolean") {
        return res.status(400).json({ error: "xp_enabled must be a boolean" });
      }
      patch.xp_enabled = xp_enabled;
    }
    if (level_up_channel_id !== undefined) {
      if (level_up_channel_id !== null) {
        if (
          typeof level_up_channel_id !== "string" ||
          !/^\d{17,20}$/.test(level_up_channel_id)
        ) {
          return res
            .status(400)
            .json({ error: "Invalid level_up_channel_id format" });
        }
        if (!guild.channels.cache.get(level_up_channel_id)) {
          return res
            .status(422)
            .json({ error: "Channel not found in this guild" });
        }
      }
      patch.level_up_channel_id = level_up_channel_id;
    }
    for (const [key, val] of [
      ["xp_min", xp_min],
      ["xp_max", xp_max],
      ["cooldown_seconds", cooldown_seconds],
    ]) {
      if (val !== undefined) {
        if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
          return res
            .status(400)
            .json({ error: `${key} must be a non-negative number` });
        }
        patch[key] = Math.floor(val);
      }
    }
    if (
      patch.xp_min !== undefined &&
      patch.xp_max !== undefined &&
      patch.xp_min > patch.xp_max
    ) {
      return res.status(400).json({ error: "xp_min cannot exceed xp_max" });
    }

    const levelSettingsStorage = require("../../persistence/levelSettingsStorage");
    res.json(levelSettingsStorage.saveSettings(id, patch));
  } catch (err) {
    logger.error(
      `PATCH /api/guilds/${req.params.id}/level/settings: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to update level settings" });
  }
});

// GET /api/guilds/:id/level/leaderboard
router.get("/:id/level/leaderboard", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    if (!client.levelStorage) {
      const LevelStorage = require("../../persistence/levelStorage");
      client.levelStorage = new LevelStorage();
    }

    const list = await client.levelStorage.getLeaderboard(id);
    const top20 = list.slice(0, 20).map((user, idx) => ({
      user_id: user.userId,
      xp: user.xp,
      level: user.level,
      rank: idx + 1,
    }));

    res.json(top20);
  } catch (err) {
    logger.error(
      `GET /api/guilds/${req.params.id}/level/leaderboard: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/guilds/:id/level
router.get("/:id/level", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    if (!client.levelStorage) {
      const LevelStorage = require("../../persistence/levelStorage");
      client.levelStorage = new LevelStorage();
    }

    const list = await client.levelStorage.getLeaderboard(id);
    const top10 = list.slice(0, 10).map((user, idx) => ({
      userId: user.userId,
      xp: user.xp,
      level: user.level,
      rank: idx + 1,
    }));

    res.json({
      level_top10: top10,
    });
  } catch (err) {
    logger.error(`GET /api/guilds/${req.params.id}/level: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch level data" });
  }
});

// GET /api/guilds/:id/tempvc
router.get("/:id/tempvc", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const tempVcStorage = require("../../persistence/tempVcStorage");
    const tempvcData = await tempVcStorage._guild(id).catch(() => null);

    res.json({
      generators: tempvcData?.generators
        ? Object.values(tempvcData.generators)
        : [],
      active_count: tempvcData?.tempChannels
        ? Object.keys(tempvcData.tempChannels).length
        : 0,
      active_channels: tempvcData?.tempChannels
        ? Object.values(tempvcData.tempChannels).map((ch) => {
            const channelObj = guild.channels?.cache?.get(ch.id);
            return {
              id: ch.id,
              ownerId: ch.ownerId,
              createdAt: ch.createdAt,
              memberCount: channelObj ? (channelObj.members?.size ?? "—") : "—",
            };
          })
        : [],
    });
  } catch (err) {
    logger.error(`GET /api/guilds/${req.params.id}/tempvc: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch TempVC data" });
  }
});

module.exports = router;
