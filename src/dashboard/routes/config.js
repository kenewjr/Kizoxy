const router = require("express").Router();
const Logger = require("../../lib/logger");
const config = require("../../config/config");
const constants = require("../../config/constants");

const logger = new Logger("DASHBOARD-API");

// GET /api/config
router.get("/", (req, res) => {
  try {
    const client = req.app.locals.client;

    const parts = (config.NODES?.[0]?.url || "").split(":");
    const lHost = parts[0] || "localhost";
    const lPort = parseInt(parts[1], 10) || 5555;
    const lSecure = config.NODES?.[0]?.secure ?? false;

    const safeConfig = {
      bot: {
        client_id: client?.user?.id ?? null,
        guild_id: config.DEV_GUILD_ID ?? null,
        owner_id: config.OWNER_ID ?? null,
        prefix: config.PREFIX ?? "k",
        bot_color: config.BOT_COLOR ?? "#5865F2",
        log_format: config.LOG_FORMAT ?? "pretty",
      },
      lavalink: {
        host: lHost,
        port: lPort,
        secure: lSecure,
      },
      youtube: {
        api_key_set: !!config.YOUTUBE_API_KEY,
        poll_interval_ms: constants.YOUTUBE_POLL_INTERVAL_MS ?? 60000,
        short_max_seconds: constants.YOUTUBE_SHORT_MAX_SECONDS ?? 180,
      },
      tiktok: {
        api_base: config.TIKTOK_API_BASE ?? null,
        poll_interval_ms: constants.TIKTOK_POLL_INTERVAL_MS ?? 45000,
      },
      dashboard: {
        host: config.DASHBOARD_HOST ?? "127.0.0.1",
        port: config.DASHBOARD_PORT ?? 4040,
      },
    };

    res.json(safeConfig);
  } catch (err) {
    logger.error(`GET /api/config: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch dashboard config" });
  }
});

const READONLY_FIELDS = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "OWNER_ID",
  "LAVALINK_HOST",
  "LAVALINK_PORT",
  "LAVALINK_PASSWORD",
  "LAVALINK_SECURE",
  "TOKEN",
  "YOUTUBE_API_KEY",
  "TIKTOK_API_BASE",
  "TIKTOK_API_KEY",
  "DEV_GUILD_ID",
  "DASHBOARD_HOST",
  "DASHBOARD_PORT",
];

// PATCH /api/config
router.patch("/", (req, res) => {
  try {
    const client = req.app.locals.client;

    const hasReadonly = Object.keys(req.body).some(
      (key) =>
        READONLY_FIELDS.includes(key.toUpperCase()) ||
        key.toUpperCase().startsWith("LAVALINK_"),
    );
    if (hasReadonly) {
      return res
        .status(403)
        .json({ error: "Access denied: Field is read-only at runtime" });
    }

    const { bot_color, prefix, log_format } = req.body;
    const overrides = {};
    let hasUpdates = false;

    if (bot_color !== undefined) {
      if (
        typeof bot_color !== "string" ||
        !/^#[0-9A-Fa-f]{6}$/.test(bot_color)
      ) {
        return res.status(400).json({
          error: "bot_color must be a valid hex color code (e.g., #5865F2)",
        });
      }
      overrides.bot_color = bot_color;
      hasUpdates = true;
    }

    if (prefix !== undefined) {
      if (
        typeof prefix !== "string" ||
        prefix.length < 1 ||
        prefix.length > 5
      ) {
        return res
          .status(400)
          .json({ error: "prefix must be between 1 and 5 characters" });
      }
      overrides.prefix = prefix;
      hasUpdates = true;
    }

    if (log_format !== undefined) {
      if (log_format !== "pretty" && log_format !== "json") {
        return res
          .status(400)
          .json({ error: "log_format must be either 'pretty' or 'json'" });
      }
      overrides.log_format = log_format;
      hasUpdates = true;
    }

    if (hasUpdates) {
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

      Object.assign(currentOverrides, overrides);

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

      if (overrides.bot_color) {
        config.BOT_COLOR = overrides.bot_color;
        if (client) client.color = overrides.bot_color;
      }
      if (overrides.prefix) {
        config.PREFIX = overrides.prefix;
        if (client) client.prefix = overrides.prefix;
      }
      if (overrides.log_format) {
        config.LOG_FORMAT = overrides.log_format;
      }
    }

    const parts = (config.NODES?.[0]?.url || "").split(":");
    const lHost = parts[0] || "localhost";
    const lPort = parseInt(parts[1], 10) || 5555;
    const lSecure = config.NODES?.[0]?.secure ?? false;

    const safeConfig = {
      bot: {
        client_id: client?.user?.id ?? null,
        guild_id: config.DEV_GUILD_ID ?? null,
        owner_id: config.OWNER_ID ?? null,
        prefix: config.PREFIX ?? "k",
        bot_color: config.BOT_COLOR ?? "#5865F2",
        log_format: config.LOG_FORMAT ?? "pretty",
      },
      lavalink: {
        host: lHost,
        port: lPort,
        secure: lSecure,
      },
      youtube: {
        api_key_set: !!config.YOUTUBE_API_KEY,
        poll_interval_ms: constants.YOUTUBE_POLL_INTERVAL_MS ?? 60000,
        short_max_seconds: constants.YOUTUBE_SHORT_MAX_SECONDS ?? 180,
      },
      tiktok: {
        api_base: config.TIKTOK_API_BASE ?? null,
        poll_interval_ms: constants.TIKTOK_POLL_INTERVAL_MS ?? 45000,
      },
      dashboard: {
        host: config.DASHBOARD_HOST ?? "127.0.0.1",
        port: config.DASHBOARD_PORT ?? 4040,
      },
    };

    res.json(safeConfig);
  } catch (err) {
    logger.error(`PATCH /api/config: ${err.message}`);
    res.status(500).json({ error: "Failed to update dashboard config" });
  }
});

module.exports = router;
