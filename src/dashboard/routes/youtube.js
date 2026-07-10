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

module.exports = router;
