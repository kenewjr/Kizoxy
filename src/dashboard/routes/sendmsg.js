const router = require("express").Router();
const Logger = require("../../lib/logger");

const logger = new Logger("DASHBOARD-SENDMSG");

// GET /api/sendmsg/channels/:guildId
router.get("/channels/:guildId", async (req, res) => {
  try {
    const guild = req.app.locals.client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channels = [...guild.channels.cache.values()]
      .filter((ch) => {
        try {
          if (typeof ch.isTextBased === "function") {
            return ch.isTextBased() && !ch.isThread();
          }
          return [0, 5].includes(ch.type);
        } catch {
          return false;
        }
      })
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        position: ch.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position);

    return res.json(channels);
  } catch (err) {
    logger.error(`GET /api/sendmsg/channels/:guildId: ${err.message}`);
    return res.json([]);
  }
});

// GET /api/sendmsg/members/:guildId
router.get("/members/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;
    const q = (req.query.q || "").toLowerCase();
    const guild = req.app.locals.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    if (guild.members.cache.size < (guild.memberCount || 0)) {
      await guild.members.fetch().catch(() => {});
    }

    const matched = [...guild.members.cache.values()]
      .filter((m) => {
        const username = (m.user?.username || "").toLowerCase();
        const nickname = (m.nickname || "").toLowerCase();
        const displayName = (m.displayName || "").toLowerCase();
        return (
          m.id === q ||
          username.includes(q) ||
          nickname.includes(q) ||
          displayName.includes(q)
        );
      })
      .map((m) => ({
        id: m.id,
        username: m.user?.username || "",
        display_name: m.displayName || m.user?.username || "",
      }))
      .slice(0, 50);

    return res.json(matched);
  } catch (err) {
    logger.error(`GET /api/sendmsg/members/:guildId: ${err.message}`);
    return res.json([]);
  }
});

// POST /api/sendmsg
router.post("/", async (req, res) => {
  try {
    const {
      guild_id,
      channel_id,
      message,
      image_url,
      as_embed = false,
      embed_title,
      mentions,
    } = req.body;

    if (!guild_id) {
      return res.status(400).json({ error: "guild_id is required." });
    }
    if (!channel_id) {
      return res.status(400).json({ error: "channel_id is required." });
    }
    if (!message && !image_url) {
      return res
        .status(400)
        .json({ error: "message or image_url is required." });
    }

    const guild = req.app.locals.client.guilds.cache.get(guild_id);
    if (!guild) {
      return res.status(404).json({ error: "Guild not found." });
    }

    const channel = guild.channels.cache.get(channel_id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found." });
    }

    // Build final Discord message
    let content = message ?? "";

    // Prepend mentions if any
    if (mentions?.length) {
      const pings = mentions.map((id) => `<@${id}>`).join(" ");
      content = pings + (content ? "\n" + content : "");
    }

    // Build send options
    let sendOptions;
    if (as_embed) {
      const { EmbedBuilder } = require("discord.js");
      const embed = new EmbedBuilder();
      if (embed_title) embed.setTitle(embed_title);
      if (content) embed.setDescription(content);
      if (image_url) embed.setImage(image_url);
      sendOptions = { embeds: [embed] };
    } else {
      sendOptions = { content: content || undefined };
      if (image_url) {
        sendOptions.content =
          (sendOptions.content ? sendOptions.content + "\n" : "") + image_url;
      }
    }

    // Explicit mentions safety configuration
    const userMentionRegex = /<@!?(\d+)>/g;
    const extractedIds = [];
    let match;
    const combinedContent = (content || "") + (image_url || "");
    while ((match = userMentionRegex.exec(combinedContent)) !== null) {
      extractedIds.push(match[1]);
    }
    const uniqueUserIds = [...new Set(extractedIds)];

    sendOptions.allowedMentions = {
      parse: [],
      users: uniqueUserIds,
      roles: [],
    };

    try {
      const sent = await channel.send(sendOptions);
      return res.json({ sent: true, message_id: sent.id });
    } catch (e) {
      return res.status(422).json({ error: e.message });
    }
  } catch (err) {
    logger.error(`POST /api/sendmsg: ${err.message}`);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
