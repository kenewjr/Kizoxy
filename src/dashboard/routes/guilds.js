const router = require("express").Router();
const Logger = require("../../lib/logger");
const { getGuildList, getGuildDetail } = require("../helpers/guildData");

const logger = new Logger("DASHBOARD");

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

// GET /api/guilds/:id/player/filters
router.get("/:id/player/filters", (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const player = client.manager?.players?.get(id);

    if (!player) {
      return res.json({ active_filters: {} });
    }

    res.json({ active_filters: player.filtersState || {} });
  } catch (err) {
    logger.error(
      `GET /api/guilds/${req.params.id}/player/filters: ${err.message}`,
    );
    res.status(500).json({ error: "Failed to fetch player filters" });
  }
});

// PATCH /api/guilds/:id/player/filters
router.patch("/:id/player/filters", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount } = req.body;
    const client = req.app.locals.client;
    const player = client.manager?.players?.get(id);

    if (!player) {
      return res.status(404).json({
        error:
          "No active music player in this server. Start playing music first!",
      });
    }

    if (!client.applyPlayerFilter) {
      client.applyPlayerFilter = async function (
        guildId,
        filterType,
        amt = null,
      ) {
        const p = client.manager.players.get(guildId);
        if (!p) throw new Error("No player found");
        if (!p.filtersState) p.filtersState = {};

        if (filterType === "reset") {
          p.filtersState = {};
          await p.shoukaku.setFilters({});
          await p.setVolume(100);
          return p.filtersState;
        }

        if (filterType === "3d") {
          if (p.filtersState.rotation) delete p.filtersState.rotation;
          else p.filtersState.rotation = { rotationHz: 0.2 };
        } else if (filterType === "bassboost") {
          if (p.filtersState.equalizer) delete p.filtersState.equalizer;
          else {
            const val = amt !== null ? amt : 5;
            p.filtersState.equalizer = [
              { band: 0, gain: val / 10 },
              { band: 1, gain: val / 10 },
              { band: 2, gain: val / 10 },
              { band: 3, gain: val / 10 },
              { band: 4, gain: val / 10 },
              { band: 5, gain: val / 10 },
              { band: 6, gain: val / 10 },
              { band: 7, gain: 0 },
              { band: 8, gain: 0 },
              { band: 9, gain: 0 },
              { band: 10, gain: 0 },
              { band: 11, gain: 0 },
              { band: 12, gain: 0 },
              { band: 13, gain: 0 },
            ];
          }
        } else if (filterType === "doubletime") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else p.filtersState.timescale = { speed: 1.5, pitch: 1.0, rate: 1.0 };
        } else if (filterType === "slowmotion") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else p.filtersState.timescale = { speed: 0.7, pitch: 1.0, rate: 1.0 };
        } else if (filterType === "nightcore") {
          if (p.filtersState.timescale) delete p.filtersState.timescale;
          else
            p.filtersState.timescale = {
              speed: 1.165,
              pitch: 1.125,
              rate: 1.05,
            };
        } else if (filterType === "karaoke") {
          if (p.filtersState.karaoke) delete p.filtersState.karaoke;
          else
            p.filtersState.karaoke = {
              level: 1.0,
              monoLevel: 1.0,
              filterBand: 220.0,
              filterWidth: 100.0,
            };
        } else if (filterType === "vibrato") {
          if (p.filtersState.vibrato) delete p.filtersState.vibrato;
          else p.filtersState.vibrato = { frequency: 2.0, depth: 0.5 };
        }

        await p.shoukaku.setFilters(p.filtersState);
        return p.filtersState;
      };
    }

    const updatedState = await client.applyPlayerFilter(id, type, amount);
    res.json({ active_filters: updatedState });
  } catch (err) {
    logger.error(
      `PATCH /api/guilds/${req.params.id}/player/filters: ${err.message}`,
    );
    res
      .status(500)
      .json({ error: err.message || "Failed to update player filters" });
  }
});

module.exports = router;
