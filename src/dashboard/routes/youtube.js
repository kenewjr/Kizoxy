const router = require("express").Router();
const Logger = require("../../lib/logger");
const youtubeStorage = require("../../persistence/youtubeStorage");
const {
  resolveChannel,
} = require("../../integrations/youtube/channelResolver");

const logger = new Logger("DASHBOARD");

// GET /api/guilds/:id/youtube
router.get("/:id/youtube", async (req, res) => {
  try {
    const subs = await youtubeStorage.listSubscriptions(req.params.id);
    res.json(subs);
  } catch (err) {
    logger.error(`GET youtube subs: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch YouTube subscriptions" });
  }
});

// POST /api/guilds/:id/youtube
router.post("/:id/youtube", async (req, res) => {
  try {
    const { id: guildId } = req.params;
    const { channel_input, announce_channel_id } = req.body;

    if (!channel_input || typeof channel_input !== "string") {
      return res.status(400).json({ error: "channel_input is required" });
    }
    if (!announce_channel_id || typeof announce_channel_id !== "string") {
      return res.status(400).json({ error: "announce_channel_id is required" });
    }

    const custom_message = req.body.custom_message;
    if (custom_message !== undefined && custom_message !== null) {
      if (typeof custom_message !== "string") {
        return res
          .status(400)
          .json({ error: "custom_message must be a string" });
      }
      if (custom_message.length > 500) {
        return res
          .status(400)
          .json({ error: "custom_message must be at most 500 characters" });
      }
    }

    let resolved;
    try {
      resolved = await resolveChannel(channel_input);
    } catch {
      return res.status(422).json({
        error:
          "Could not resolve channel. Try pasting the UC... Channel ID directly.",
      });
    }

    const sub = await youtubeStorage.addSubscription(guildId, {
      youtubeChannelId: resolved.youtubeChannelId,
      youtubeChannelTitle: resolved.youtubeChannelTitle,
      youtubeChannelUrl: `https://www.youtube.com/channel/${resolved.youtubeChannelId}`,
      announceChannelId: announce_channel_id,
      mentionRoleId: req.body.mention_role_id ?? null,
      customMessage: req.body.custom_message || null,
      notifyVideos: req.body.notify_videos !== false,
      notifyShorts: req.body.notify_shorts !== false,
      notifyLive: req.body.notify_live !== false,
      notifyUpcoming: req.body.notify_upcoming !== false,
    });

    res.status(201).json(sub);
  } catch (err) {
    logger.error(`POST youtube sub: ${err.message}`);
    res.status(500).json({ error: "Failed to add YouTube subscription" });
  }
});

// PATCH /api/guilds/:id/youtube/:subId
router.patch("/:id/youtube/:subId", async (req, res) => {
  try {
    const { id: guildId, subId } = req.params;

    const customMessageVal =
      req.body.custom_message !== undefined
        ? req.body.custom_message
        : req.body.customMessage;
    if (customMessageVal !== undefined && customMessageVal !== null) {
      if (typeof customMessageVal !== "string") {
        return res
          .status(400)
          .json({ error: "custom_message must be a string" });
      }
      if (customMessageVal.length > 500) {
        return res
          .status(400)
          .json({ error: "custom_message must be at most 500 characters" });
      }
    }

    const patch = {};
    if (req.body.notify_videos !== undefined)
      patch.notifyVideos = req.body.notify_videos;
    if (req.body.notify_shorts !== undefined)
      patch.notifyShorts = req.body.notify_shorts;
    if (req.body.notify_live !== undefined)
      patch.notifyLive = req.body.notify_live;
    if (req.body.notify_upcoming !== undefined)
      patch.notifyUpcoming = req.body.notify_upcoming;
    if (req.body.announce_channel_id !== undefined)
      patch.announceChannelId = req.body.announce_channel_id;
    if (req.body.mention_role_id !== undefined)
      patch.mentionRoleId = req.body.mention_role_id || null;
    if (req.body.custom_message !== undefined)
      patch.customMessage = req.body.custom_message || null;
    // Also accept camelCase directly.
    for (const f of [
      "notifyVideos",
      "notifyShorts",
      "notifyLive",
      "notifyUpcoming",
      "announceChannelId",
      "mentionRoleId",
      "customMessage",
    ]) {
      if (req.body[f] !== undefined && patch[f] === undefined)
        patch[f] = req.body[f];
    }

    const updated = await youtubeStorage.updateSubscription(
      guildId,
      subId,
      patch,
    );
    if (!updated)
      return res.status(404).json({ error: "Subscription not found" });
    res.json(updated);
  } catch (err) {
    logger.error(`PATCH youtube sub: ${err.message}`);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// DELETE /api/guilds/:id/youtube/:subId
router.delete("/:id/youtube/:subId", async (req, res) => {
  try {
    await youtubeStorage.removeSubscription(req.params.id, req.params.subId);
    res.json({ deleted: true });
  } catch (err) {
    logger.error(`DELETE youtube sub: ${err.message}`);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

// GET /api/guilds/:id/youtube/:subId/check
// Manual check: fetch latest RSS entry & video details from YouTube right now.
// Returns latest video status without triggering any notifications.
router.get("/:id/youtube/:subId/check", async (req, res) => {
  try {
    const { id: guildId, subId } = req.params;
    const subs = await youtubeStorage.listSubscriptions(guildId);
    const sub = subs.find(
      (s) => s.id === subId || s.youtubeChannelId === subId,
    );
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const {
      fetchLatestFeedEntry,
      fetchVideoDetails,
    } = require("../../integrations/youtube/client");
    const { classify } = require("../../integrations/youtube/classifier");

    let entry;
    try {
      entry = await fetchLatestFeedEntry(sub.youtubeChannelId);
    } catch (err) {
      return res.status(502).json({
        error: `Failed to fetch YouTube feed: ${err.message}`,
        youtubeChannelId: sub.youtubeChannelId,
      });
    }

    if (!entry || !entry.videoId) {
      return res.json({
        youtubeChannelId: sub.youtubeChannelId,
        youtubeChannelTitle: sub.youtubeChannelTitle || "Unknown",
        youtubeChannelUrl:
          sub.youtubeChannelUrl ||
          `https://www.youtube.com/channel/${sub.youtubeChannelId}`,
        latest_video: null,
        checked_at: new Date().toISOString(),
      });
    }

    let videoItem = null;
    try {
      videoItem = await fetchVideoDetails(entry.videoId);
    } catch (_) {}

    if (!videoItem) {
      videoItem = {
        id: entry.videoId,
        snippet: {
          title: entry.title || "New video",
          channelTitle: sub.youtubeChannelTitle || entry.author || "YouTube",
          publishedAt: entry.publishedAt,
          thumbnails: {
            high: {
              url: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
            },
          },
        },
      };
    }

    const type = await classify(videoItem);

    res.json({
      youtubeChannelId: sub.youtubeChannelId,
      youtubeChannelTitle:
        sub.youtubeChannelTitle ||
        videoItem.snippet?.channelTitle ||
        entry.author ||
        "YouTube",
      youtubeChannelUrl:
        sub.youtubeChannelUrl ||
        `https://www.youtube.com/channel/${sub.youtubeChannelId}`,
      latest_video: {
        id: entry.videoId,
        type: type || "video",
        url: `https://www.youtube.com/watch?v=${entry.videoId}`,
        title: videoItem.snippet?.title || entry.title || null,
        thumbnail:
          videoItem.snippet?.thumbnails?.high?.url ||
          `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
        publishedAt: entry.publishedAt || null,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`GET youtube check: ${err.message}`);
    res.status(500).json({ error: "Failed to check YouTube channel" });
  }
});

// POST /api/guilds/:id/youtube/:subId/force-notify
// Force-send a notification right now using current YouTube data.
// Bypasses scheduler dedup state and updates state storage.
router.post("/:id/youtube/:subId/force-notify", async (req, res) => {
  try {
    const { id: guildId, subId } = req.params;
    const subs = await youtubeStorage.listSubscriptions(guildId);
    const sub = subs.find(
      (s) => s.id === subId || s.youtubeChannelId === subId,
    );
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const discordClient = req.app.locals.client;
    if (!discordClient) {
      return res.status(503).json({ error: "Discord client not available" });
    }

    const {
      fetchLatestFeedEntry,
      fetchVideoDetails,
    } = require("../../integrations/youtube/client");
    const { classify } = require("../../integrations/youtube/classifier");
    const {
      buildAnnouncementEmbed,
      buildWatchRow,
    } = require("../../integrations/youtube/formatter");
    const { buildContent } = require("../../lib/notificationTemplate");
    const youtubeStateStorage = require("../../persistence/youtubeStateStorage");
    const { ChannelType } = require("discord.js");

    let entry;
    try {
      entry = await fetchLatestFeedEntry(sub.youtubeChannelId);
    } catch (err) {
      return res
        .status(502)
        .json({ error: `Failed to fetch YouTube feed: ${err.message}` });
    }

    if (!entry || !entry.videoId) {
      return res
        .status(404)
        .json({ error: "No video entries found in channel feed" });
    }

    let videoItem = null;
    try {
      videoItem = await fetchVideoDetails(entry.videoId);
    } catch (_) {}

    if (!videoItem) {
      videoItem = {
        id: entry.videoId,
        snippet: {
          title: entry.title || "New video",
          channelTitle: sub.youtubeChannelTitle || entry.author || "YouTube",
          publishedAt: entry.publishedAt,
          thumbnails: {
            high: {
              url: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
            },
          },
        },
      };
    }

    const type = await classify(videoItem);

    const TYPE_CONTENT = {
      live: (name) => `🔴 [LIVE] ${name} is now streaming live!`,
      upcoming: (name) => `🗓️ [UPCOMING] ${name} has a stream coming up`,
      short: (name) => `📱 [SHORT] ${name} posted a new Short`,
      video: (name) => `📺 [VIDEO] ${name} uploaded a new video`,
    };

    const channelName = sub.youtubeChannelTitle || entry.author || "YouTube";
    const typePrefix = (TYPE_CONTENT[type] || TYPE_CONTENT.video)(channelName);
    const embed = buildAnnouncementEmbed(discordClient, {
      videoItem,
      type,
      channelTitle: channelName,
    });
    const components = [buildWatchRow(entry.videoId)];
    const content = buildContent({
      customMessage: sub.customMessage,
      mentionRoleId: sub.mentionRoleId,
      defaultPrefix: typePrefix,
      vars: {
        name: channelName,
        url: `https://www.youtube.com/watch?v=${entry.videoId}`,
        title: videoItem.snippet?.title || entry.title || "",
        type,
      },
    });

    const channel = await discordClient.channels
      .fetch(sub.announceChannelId)
      .catch(() => null);
    if (!channel) {
      return res
        .status(404)
        .json({ error: `Announce channel ${sub.announceChannelId} not found` });
    }

    const sentMsg = await channel
      .send({ content, embeds: [embed], components })
      .catch((e) => {
        logger.error(
          `[YOUTUBE_DASHBOARD] Force-notify failed for channel ${channel.id}: ${e.message}`,
        );
        return null;
      });

    if (!sentMsg) {
      return res
        .status(500)
        .json({ error: "Failed to send message to Discord channel" });
    }

    if (
      channel.type === ChannelType.GuildAnnouncement ||
      sentMsg.crosspostable
    ) {
      await sentMsg.crosspost().catch(() => {});
    }

    // Mark as seen in state storage
    const state =
      (await youtubeStateStorage.getState(sub.youtubeChannelId)) || {};
    const seenVideoIds = Array.isArray(state.seenVideoIds)
      ? state.seenVideoIds
      : [];
    await youtubeStateStorage.setState(sub.youtubeChannelId, {
      lastVideoId: entry.videoId,
      lastPublishedAt: entry.publishedAt || state.lastPublishedAt,
      seenVideoIds: [...new Set([entry.videoId, ...seenVideoIds])].slice(0, 50),
    });

    return res.json({
      sent: true,
      type,
      video: {
        id: entry.videoId,
        title: videoItem.snippet?.title || entry.title || null,
        url: `https://www.youtube.com/watch?v=${entry.videoId}`,
        publishedAt: entry.publishedAt || null,
      },
    });
  } catch (err) {
    logger.error(`POST youtube force-notify: ${err.message}`);
    res.status(500).json({ error: "Failed to send force notification" });
  }
});

module.exports = router;
