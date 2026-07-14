const router = require("express").Router();
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Logger = require("../../lib/logger");

const logger = new Logger("DASHBOARD-SENDMSG");

// GET /api/guilds/:guildId/send-message/members
router.get("/:guildId/send-message/members", async (req, res) => {
  try {
    const { guildId } = req.params;
    const q = req.query.q || "";
    const client = req.app.locals.client;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    const filterFn = (m) => {
      const u = m.user;
      if (!u) return false;
      if (u.bot) return false; // Exclude bots
      if (!q) return true;
      const term = q.toLowerCase();
      return (
        m.displayName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        m.id.includes(term)
      );
    };

    let matched = Array.from(guild.members.cache.values()).filter(filterFn);

    if (matched.length < 15 && q.trim().length > 0) {
      try {
        const fetched = await guild.members.fetch({
          query: q,
          limit: 15,
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
    }));

    res.json(results);
  } catch (err) {
    logger.error(
      `GET /api/guilds/:guildId/send-message/members: ${err.message}`,
    );
    res.json([]);
  }
});

// POST /api/guilds/:guildId/send-message
router.post("/:guildId/send-message", async (req, res) => {
  try {
    const { guildId } = req.params;
    const client = req.app.locals.client;
    const {
      channelId,
      message,
      mentionUsers = [],
      mentionRoles = [],
      mentionEveryone = false,
      mentionHere = false,
      messageType = "plain",
      embed = null,
      attachments = [],
    } = req.body;

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

    // Mention permission check
    if (
      (mentionEveryone || mentionHere) &&
      !perms.has(PermissionFlagsBits.MentionEveryone)
    ) {
      return res.status(403).json({
        error: "Bot does not have Mention Everyone permission in this channel.",
      });
    }

    // Validate users are in the guild
    if (mentionUsers && Array.isArray(mentionUsers)) {
      for (const userId of mentionUsers) {
        if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId)) {
          return res.status(400).json({ error: `Invalid user ID: ${userId}` });
        }
        if (!guild.members.cache.has(userId)) {
          try {
            await guild.members.fetch(userId);
          } catch (_) {
            return res.status(400).json({
              error: `Member ${userId} does not belong to this guild.`,
            });
          }
        }
      }
    }

    // Validate roles are in the guild
    if (mentionRoles && Array.isArray(mentionRoles)) {
      for (const roleId of mentionRoles) {
        if (typeof roleId !== "string" || !/^\d{17,20}$/.test(roleId)) {
          return res.status(400).json({ error: `Invalid role ID: ${roleId}` });
        }
        if (!guild.roles.cache.has(roleId)) {
          return res
            .status(400)
            .json({ error: `Role ${roleId} does not belong to this guild.` });
        }
      }
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

    // Generate final content with mentions
    // Order: Everyone/Here -> Users -> Roles -> Message
    const prefixLines = [];
    if (mentionEveryone) prefixLines.push("@everyone");
    if (mentionHere) prefixLines.push("@here");
    if (mentionUsers && mentionUsers.length) {
      prefixLines.push(mentionUsers.map((id) => `<@${id}>`).join(" "));
    }
    if (mentionRoles && mentionRoles.length) {
      prefixLines.push(mentionRoles.map((id) => `<@&${id}>`).join(" "));
    }

    let finalContent = "";
    if (prefixLines.length) {
      finalContent = prefixLines.join("\n") + "\n" + cleanMsg;
    } else {
      finalContent = cleanMsg;
    }
    finalContent = finalContent.trim();

    // Construct allowedMentions
    const allowedMentions = {
      parse: [],
      users: mentionUsers,
      roles: mentionRoles,
    };
    if (mentionEveryone) allowedMentions.parse.push("everyone");
    if (mentionHere) allowedMentions.parse.push("everyone");

    const payload = {
      content: finalContent || undefined,
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
      res
        .status(500)
        .json({ error: sendErr.message || "Failed to send message." });
    }
  } catch (err) {
    logger.error(`POST /api/guilds/:guildId/send-message: ${err.message}`);
    res.status(500).json({ error: err.message || "Internal server error." });
  }
});

module.exports = router;
