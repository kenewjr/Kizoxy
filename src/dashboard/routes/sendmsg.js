const router = require("express").Router();
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const config = require("../../config/config");
const Logger = require("../../lib/logger");

const logger = new Logger("DASHBOARD-SENDMSG");

// GET /api/sendmsg/channels/:guildId
router.get("/channels/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;
    const client = req.app.locals.client;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const channels = Array.from(guild.channels.cache.values())
      .filter((c) => {
        if (
          c.type !== ChannelType.GuildText &&
          c.type !== ChannelType.GuildAnnouncement
        ) {
          return false;
        }
        const perms = c.permissionsFor(client.user);
        return perms && perms.has(PermissionFlagsBits.SendMessages);
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(channels);
  } catch (err) {
    logger.error(`GET /api/sendmsg/channels: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// POST /api/sendmsg
router.post("/", async (req, res) => {
  try {
    const client = req.app.locals.client;
    const { guild_id, channel_id, message, image_url, embed } = req.body;

    if (!guild_id || !channel_id) {
      return res
        .status(400)
        .json({ error: "guild_id and channel_id are required." });
    }

    const guild = client.guilds.cache.get(guild_id);
    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const perms = channel.permissionsFor(client.user);
    if (!perms || !perms.has(PermissionFlagsBits.SendMessages)) {
      return res.status(403).json({
        error: "Bot does not have permission to send messages in this channel.",
      });
    }

    const hasEmbed = !!embed;
    const hasImage = !!image_url;
    const cleanMsg = (message || "").trim();

    if (!cleanMsg && !hasImage) {
      return res
        .status(400)
        .json({ error: "Message content or image URL is required." });
    }

    if (cleanMsg.length > 2000) {
      return res
        .status(400)
        .json({ error: "Message content cannot exceed 2000 characters." });
    }

    if (image_url) {
      try {
        new URL(image_url);
      } catch (_) {
        return res.status(400).json({ error: "Invalid image URL format." });
      }
    }

    const payload = {};
    if (hasEmbed) {
      const brandColor = config.BOT_COLOR || "#5865F2";
      const embedObj = new EmbedBuilder()
        .setColor(brandColor)
        .setTimestamp()
        .setFooter({ text: "Sent from Web Dashboard" });

      if (cleanMsg) {
        embedObj.setDescription(cleanMsg);
      }
      if (image_url) {
        embedObj.setImage(image_url);
      }
      payload.embeds = [embedObj];
    } else {
      payload.content = cleanMsg || undefined;
      if (image_url) {
        payload.files = [image_url];
      }
    }

    const sent = await channel.send(payload);
    res.json({ success: true, message_id: sent.id });
  } catch (err) {
    logger.error(`POST /api/sendmsg: ${err.message}`);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

module.exports = router;
