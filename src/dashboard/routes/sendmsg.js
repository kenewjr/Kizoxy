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
        try {
          // Skip if channel.isTextBased is defined and returns false
          if (
            c.isTextBased &&
            typeof c.isTextBased === "function" &&
            !c.isTextBased()
          )
            return false;
          if (
            c.type !== ChannelType.GuildText &&
            c.type !== ChannelType.GuildAnnouncement
          ) {
            return false;
          }
          const perms = c.permissionsFor(client.user);
          return perms && perms.has(PermissionFlagsBits.SendMessages);
        } catch (_) {
          return false;
        }
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

// GET /api/sendmsg/members/:guildId
router.get("/members/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;
    const q = req.query.q || "";
    const client = req.app.locals.client;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.json([]);
    }

    const filterFn = (m) => {
      const u = m.user;
      if (!u) return false;
      if (u.bot && q !== "") return false;
      if (!q) return true;
      const term = q.toLowerCase();
      return (
        m.displayName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
      );
    };

    let matched = Array.from(guild.members.cache.values()).filter(filterFn);

    if (matched.length < 10 && q.trim().length > 0) {
      try {
        const fetched = await guild.members.fetch({
          query: q,
          limit: 10,
          withPresences: false,
        });
        for (const m of fetched.values()) {
          if (!guild.members.cache.has(m.id)) {
            guild.members.cache.set(m.id, m);
          }
        }
        matched = Array.from(guild.members.cache.values()).filter(filterFn);
      } catch (err) {
        logger.debug(`Failed to fetch members for query ${q}: ${err.message}`);
      }
    }

    const results = matched.slice(0, 20).map((m) => ({
      id: m.id,
      username: m.user.username,
      display_name: m.displayName,
      avatar_url: m.user.displayAvatarURL({ size: 64 }) || null,
      bot: m.user.bot,
    }));

    res.json(results);
  } catch (err) {
    logger.error(`GET /api/sendmsg/members: ${err.message}`);
    // return empty list on failure rather than 500
    res.json([]);
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

    try {
      const sent = await channel.send(payload);
      res.json({ success: true, message_id: sent.id });
    } catch (sendErr) {
      // Return 422 on failed sending due to permissions or structure
      res
        .status(422)
        .json({ error: sendErr.message || "Failed to send message" });
    }
  } catch (err) {
    logger.error(`POST /api/sendmsg: ${err.message}`);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

module.exports = router;
