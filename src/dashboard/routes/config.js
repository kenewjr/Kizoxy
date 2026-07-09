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

module.exports = router;
