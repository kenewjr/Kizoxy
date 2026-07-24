const router = require("express").Router();
const Logger = require("../../lib/logger");
const levelSettingsStorage = require("../../persistence/levelSettingsStorage");

const logger = new Logger("DASHBOARD-LEVEL");

// GET /api/guilds/:id/level/settings
router.get("/:id/level/settings", (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

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

// POST /api/guilds/:id/level/xp
router.post("/:id/level/xp", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, amount, action } = req.body;
    const client = req.app.locals.client;

    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    if (!user_id || !/^\d{17,20}$/.test(user_id)) {
      return res
        .status(400)
        .json({ error: "Invalid user_id. Must be a 17-20 digit snowflake." });
    }
    if (
      amount === undefined ||
      typeof amount !== "number" ||
      amount < 1 ||
      amount > 100000 ||
      !Number.isInteger(amount)
    ) {
      return res.status(400).json({
        error: "Invalid amount. Must be an integer between 1 and 100,000.",
      });
    }
    const allowedActions = ["add", "set", "remove"];
    if (!action || !allowedActions.includes(action)) {
      return res
        .status(400)
        .json({ error: "Invalid action. Must be 'add', 'set', or 'remove'." });
    }

    if (!client.levelStorage) {
      const LevelStorage = require("../../persistence/levelStorage");
      client.levelStorage = new LevelStorage();
    }

    let userBefore = await client.levelStorage.getUser(user_id, id);
    const previous_xp = userBefore ? userBefore.xp : 0;
    const previous_level = userBefore ? userBefore.level : 0;

    let delta = amount;
    if (action === "add") {
      delta = amount;
    } else if (action === "remove") {
      delta = -Math.min(amount, previous_xp);
    } else if (action === "set") {
      delta = amount - previous_xp;
    }

    const { user: userAfter } = await client.levelStorage.addXp(
      user_id,
      id,
      delta,
    );

    res.json({
      user_id,
      previous_xp,
      new_xp: userAfter.xp,
      previous_level,
      new_level: userAfter.level,
      leveled_up: userAfter.level > previous_level,
    });
  } catch (err) {
    logger.error(`POST /api/guilds/${req.params.id}/level/xp: ${err.message}`);
    res.status(500).json({ error: "Failed to modify level XP" });
  }
});

module.exports = router;
