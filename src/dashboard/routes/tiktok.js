const router = require("express").Router();
const Logger = require("../../lib/logger");
const tiktokStorage = require("../../persistence/tiktokStorage");
const { resolveProfile } = require("../../integrations/tiktok/resolver");
const { fetchProfile, TiktokAccountNotFoundError } = require("../../integrations/tiktok/client");

const logger = new Logger("DASHBOARD");

// GET /api/guilds/:id/tiktok
router.get("/:id/tiktok", async (req, res) => {
  try {
    const subs = await tiktokStorage.listSubscriptions(req.params.id);
    res.json(subs);
  } catch (err) {
    logger.error(`GET tiktok subs: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch TikTok subscriptions" });
  }
});

// POST /api/guilds/:id/tiktok
router.post("/:id/tiktok", async (req, res) => {
  try {
    const { id: guildId } = req.params;
    const { username_or_url, announce_channel_id } = req.body;

    if (!username_or_url || typeof username_or_url !== "string") {
      return res.status(400).json({ error: "username_or_url is required" });
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
      resolved = resolveProfile(username_or_url);
    } catch {
      return res.status(422).json({
        error: "Could not resolve TikTok username from that input.",
      });
    }

    const sub = await tiktokStorage.addSubscription(guildId, {
      username: resolved.username,
      profileUrl: resolved.profileUrl,
      discordChannelId: announce_channel_id,
      mentionRoleId: req.body.mention_role_id ?? null,
      customMessage: req.body.custom_message || null,
      notifyVideos: req.body.notify_posts !== false,
      notifyLive: req.body.notify_live !== false,
    });

    res.status(201).json(sub);
  } catch (err) {
    logger.error(`POST tiktok sub: ${err.message}`);
    res.status(500).json({ error: "Failed to add TikTok subscription" });
  }
});

// PATCH /api/guilds/:id/tiktok/:subId
router.patch("/:id/tiktok/:subId", async (req, res) => {
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
    if (req.body.notify_posts !== undefined)
      patch.notifyVideos = req.body.notify_posts;
    if (req.body.notify_live !== undefined)
      patch.notifyLive = req.body.notify_live;
    if (req.body.announce_channel_id !== undefined)
      patch.discordChannelId = req.body.announce_channel_id;
    if (req.body.mention_role_id !== undefined)
      patch.mentionRoleId = req.body.mention_role_id || null;
    if (req.body.custom_message !== undefined)
      patch.customMessage = req.body.custom_message || null;
    // Accept camelCase too.
    if (req.body.notifyVideos !== undefined && patch.notifyVideos === undefined)
      patch.notifyVideos = req.body.notifyVideos;
    if (req.body.notifyLive !== undefined && patch.notifyLive === undefined)
      patch.notifyLive = req.body.notifyLive;
    if (
      req.body.mentionRoleId !== undefined &&
      patch.mentionRoleId === undefined
    )
      patch.mentionRoleId = req.body.mentionRoleId || null;
    if (
      req.body.customMessage !== undefined &&
      patch.customMessage === undefined
    )
      patch.customMessage = req.body.customMessage || null;

    const updated = await tiktokStorage.updateSubscription(
      guildId,
      subId,
      patch,
    );
    if (!updated)
      return res.status(404).json({ error: "Subscription not found" });
    res.json(updated);
  } catch (err) {
    logger.error(`PATCH tiktok sub: ${err.message}`);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// DELETE /api/guilds/:id/tiktok/:subId
router.delete("/:id/tiktok/:subId", async (req, res) => {
  try {
    await tiktokStorage.removeSubscription(req.params.id, req.params.subId);
    res.json({ deleted: true });
  } catch (err) {
    logger.error(`DELETE tiktok sub: ${err.message}`);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

// GET /api/guilds/:id/tiktok/:subId/check
// Manual check: fetch live data from TikTok right now, return latest video +
// live status without triggering any notifications. Use to verify scraper works.
router.get("/:id/tiktok/:subId/check", async (req, res) => {
  try {
    const { id: guildId, subId } = req.params;

    // Verify subscription belongs to this guild.
    const subs = await tiktokStorage.listSubscriptions(guildId);
    const sub = subs.find((s) => s.id === subId);
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    let profile;
    try {
      profile = await fetchProfile(sub.username);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) {
        return res.status(404).json({
          error: `TikTok account @${sub.username} not found`,
          username: sub.username,
        });
      }
      return res.status(502).json({
        error: `Failed to fetch TikTok profile: ${err.message}`,
        username: sub.username,
      });
    }

    const latestVideo = profile.videos.find((v) => !v.isLive) || profile.videos[0] || null;

    res.json({
      username: profile.user.username,
      avatar: profile.user.avatar,
      live: profile.user.live,
      liveId: profile.user.liveId || null,
      liveUrl: profile.user.liveUrl,
      total_videos_fetched: profile.videos.length,
      latest_video: latestVideo
        ? {
            id: latestVideo.id,
            type: latestVideo.type,
            url: latestVideo.url,
            title: latestVideo.title || null,
            cover: latestVideo.cover || null,
            createTime: latestVideo.createTime || null,
            createTime_iso: latestVideo.createTime
              ? new Date(latestVideo.createTime * 1000).toISOString()
              : null,
          }
        : null,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`GET tiktok check: ${err.message}`);
    res.status(500).json({ error: "Failed to check TikTok profile" });
  }
});

module.exports = router;
