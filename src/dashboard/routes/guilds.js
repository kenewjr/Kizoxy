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

      return {
        id: gen.id,
        channelId: gen.id,
        guildId: id,
        defaultName: gen.defaultName || null,
        limit: gen.userLimit ?? gen.defaultLimit ?? 0,
        bitrate:
          gen.bitrate ??
          (gen.defaultBitrate ? Math.round(gen.defaultBitrate / 1000) : 64),
        rtcRegion: gen.rtcRegion ?? null,
        templateId: gen.templateId ?? null,
        voiceRoles: genRoles,
        templates: templates,
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

// PATCH /api/guilds/:id/tempvc/:generatorId
router.patch("/:id/tempvc/:generatorId", async (req, res) => {
  try {
    const { id, generatorId } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const tempVcStorage = require("../../persistence/tempVcStorage");
    const generator = await tempVcStorage.getGenerator(id, generatorId);
    if (!generator) {
      return res.status(404).json({ error: "Generator not found" });
    }

    const { bitrate, rtcRegion, defaultName, userLimit, templateId } = req.body;
    const updates = {};

    if (bitrate !== undefined) {
      if (typeof bitrate !== "number" || bitrate < 8 || bitrate > 384) {
        return res
          .status(400)
          .json({ error: "Bitrate must be between 8 and 384 kbps" });
      }
      updates.bitrate = bitrate;
      updates.defaultBitrate = bitrate * 1000;
    }

    if (rtcRegion !== undefined) {
      const allowed = [
        "auto",
        "brazil",
        "hongkong",
        "india",
        "japan",
        "rotterdam",
        "russia",
        "singapore",
        "southafrica",
        "sydney",
        "us-central",
        "us-east",
        "us-south",
        "us-west",
      ];
      if (rtcRegion !== null && !allowed.includes(rtcRegion)) {
        return res.status(400).json({ error: "Invalid voice region" });
      }
      updates.rtcRegion = rtcRegion === "auto" ? null : rtcRegion;
    }

    if (defaultName !== undefined) {
      if (typeof defaultName !== "string" || !defaultName.trim()) {
        return res.status(400).json({ error: "Invalid defaultName" });
      }
      updates.defaultName = defaultName;
    }

    if (userLimit !== undefined) {
      if (typeof userLimit !== "number" || userLimit < 0 || userLimit > 99) {
        return res
          .status(400)
          .json({ error: "Limit must be between 0 and 99" });
      }
      updates.userLimit = userLimit;
      updates.defaultLimit = userLimit;
    }

    if (templateId !== undefined) {
      if (templateId !== null) {
        const template = await tempVcStorage.getTemplate(id, templateId);
        if (!template)
          return res.status(400).json({ error: "Template not found" });
      }
      updates.templateId = templateId;
    }

    const updated = await tempVcStorage.updateGenerator(
      id,
      generatorId,
      updates,
    );
    res.json(updated);
  } catch (err) {
    logger.error(
      `PATCH /api/guilds/${req.params.id}/tempvc/${req.params.generatorId}: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to update generator settings" });
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

    const { nextLevelXp } = require("../helpers/guildData");
    const list = await client.levelStorage.getLeaderboard(id);
    const top10raw = list.slice(0, 10);
    const userIds = top10raw.map((u) => u.userId);

    let fetchedMembers = new Map();
    if (userIds.length > 0) {
      try {
        const fetched = await guild.members.fetch({
          user: userIds,
          withPresences: false,
          force: false,
        });
        fetchedMembers = fetched;
      } catch (e) {
        logger.debug(
          `Member batch fetch failed for leaderboard in guild ${id}: ${e.message}`,
        );
      }
    }

    const top10 = await Promise.all(
      top10raw.map(async (user, idx) => {
        let server_name = null;
        let global_name = null;
        const member = fetchedMembers.get(user.userId);
        if (member) {
          server_name = member.displayName;
          global_name = member.user.globalName ?? member.user.username;
        } else {
          try {
            const u =
              client.users.cache.get(user.userId) ||
              (await client.users.fetch(user.userId).catch(() => null));
            if (u) {
              server_name = u.globalName ?? u.username;
              global_name = u.username;
            }
          } catch (_) {}
        }

        const next_xp = nextLevelXp(user.level, user.xp);
        return {
          rank: idx + 1,
          user_id: user.userId,
          userId: user.userId,
          server_name,
          global_name,
          xp: user.xp,
          level: user.level,
          next_xp,
          xp_to_next: Math.max(0, next_xp - user.xp),
        };
      }),
    );

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
