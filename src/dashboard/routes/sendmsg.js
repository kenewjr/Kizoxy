const router = require("express").Router();
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
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

    const sendableTypes = [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ];

    const channels = [...guild.channels.cache.values()]
      .filter((c) => {
        try {
          if (!sendableTypes.includes(c.type)) return false;
          if (c.archived) return false;
          const perms = c.permissionsFor(client.user);
          return (
            perms &&
            perms.has(PermissionFlagsBits.ViewChannel) &&
            perms.has(PermissionFlagsBits.SendMessages)
          );
        } catch (_) {
          return false;
        }
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentName: c.parent ? c.parent.name : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(channels);
  } catch (err) {
    logger.error(`GET /api/sendmsg/channels/:guildId: ${err.message}`);
    res.json([]);
  }
});

// POST /api/sendmsg
router.post("/", async (req, res) => {
  try {
    const client = req.app.locals.client;
    const {
      guildId,
      channelId,
      message,
      messageType = "plain",
      embed = null,
      attachments = [],
    } = req.body;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required." });
    }
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required." });
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Guild not found." });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found." });
    }

    // Channel validation
    const sendableTypes = [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ];
    if (!sendableTypes.includes(channel.type)) {
      return res
        .status(400)
        .json({ error: "Channel is not a text channel or compatible thread." });
    }
    if (channel.archived) {
      return res.status(400).json({ error: "Channel is archived." });
    }

    // Permission check
    const perms = channel.permissionsFor(client.user);
    if (
      !perms ||
      !perms.has(PermissionFlagsBits.ViewChannel) ||
      !perms.has(PermissionFlagsBits.SendMessages)
    ) {
      return res.status(403).json({
        error:
          "Bot does not have View Channel or Send Messages permissions in this channel.",
      });
    }

    if (messageType === "embed" && !perms.has(PermissionFlagsBits.EmbedLinks)) {
      return res.status(403).json({
        error: "Bot does not have Embed Links permission in this channel.",
      });
    }

    if (
      attachments &&
      attachments.length > 0 &&
      !perms.has(PermissionFlagsBits.AttachFiles)
    ) {
      return res.status(403).json({
        error: "Bot does not have Attach Files permission in this channel.",
      });
    }

    // Build files / attachments
    const files = [];
    if (attachments && Array.isArray(attachments)) {
      let totalSize = 0;
      for (const att of attachments) {
        if (!att.name || !att.data) continue;
        let base64Data = att.data;
        if (base64Data.includes(";base64,")) {
          base64Data = base64Data.split(";base64,")[1];
        }
        const buffer = Buffer.from(base64Data, "base64");
        totalSize += buffer.length;
        files.push({
          attachment: buffer,
          name: att.name,
        });
      }
      if (totalSize > 8 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Attachments exceed size limit of 8MB." });
      }
    }

    // Check message length limit
    const cleanMsg = (message || "").trim();
    if (cleanMsg.length > 2000) {
      return res
        .status(400)
        .json({ error: "Message content cannot exceed 2000 characters." });
    }

    if (!cleanMsg && files.length === 0 && messageType !== "embed") {
      return res
        .status(400)
        .json({ error: "Message content or attachments are required." });
    }

    // Mention safety: extract every <@USER_ID> token present in cleanMsg via regex
    const userMentionRegex = /<@!?(\d+)>/g;
    const extractedIds = [];
    let match;
    while ((match = userMentionRegex.exec(cleanMsg)) !== null) {
      extractedIds.push(match[1]);
    }
    const uniqueUserIds = [...new Set(extractedIds)];

    // Construct allowedMentions
    const allowedMentions = {
      parse: [],
      users: uniqueUserIds,
      roles: [],
    };

    const payload = {
      content: cleanMsg || undefined,
      allowedMentions,
      files: files.length ? files : undefined,
    };

    if (messageType === "embed" && embed) {
      const embedBuilder = new EmbedBuilder();
      if (embed.title) embedBuilder.setTitle(embed.title);
      if (embed.description) {
        if (embed.description.length > 4096) {
          return res
            .status(400)
            .json({ error: "Embed description exceeds 4096 characters." });
        }
        embedBuilder.setDescription(embed.description);
      }
      if (embed.color) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(embed.color)) {
          return res
            .status(400)
            .json({ error: "Embed color must be a valid hex code." });
        }
        embedBuilder.setColor(embed.color);
      }
      if (embed.footer) embedBuilder.setFooter({ text: embed.footer });

      if (embed.thumbnail) {
        try {
          new URL(embed.thumbnail);
          embedBuilder.setThumbnail(embed.thumbnail);
        } catch (_) {
          return res
            .status(400)
            .json({ error: "Invalid embed thumbnail URL." });
        }
      }
      if (embed.image) {
        try {
          new URL(embed.image);
          embedBuilder.setImage(embed.image);
        } catch (_) {
          return res.status(400).json({ error: "Invalid embed image URL." });
        }
      }
      if (embed.author) embedBuilder.setAuthor({ name: embed.author });
      if (embed.timestamp) embedBuilder.setTimestamp();

      payload.embeds = [embedBuilder];
    }

    try {
      const sent = await channel.send(payload);
      res.json({ success: true, messageId: sent.id });
    } catch (sendErr) {
      logger.error(`Failed to send message: ${sendErr.message}`);
      res.status(500).json({ error: "Failed to send message." });
    }
  } catch (err) {
    logger.error(`POST /api/sendmsg: ${err.message}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
