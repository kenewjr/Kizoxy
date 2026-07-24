const router = require("express").Router();
const Logger = require("../../lib/logger");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("DASHBOARD-TEMPVC");

// GET /api/guilds/:id/tempvc/generators
router.get("/:id/tempvc/generators", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

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

// GET /api/guilds/:id/tempvc
router.get("/:id/tempvc", async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.app.locals.client;
    const guild = client.guilds.cache.get(id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

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
