const router = require("express").Router();
const Logger = require("../../lib/logger");
const tiktokStorage = require("../../persistence/tiktokStorage");
const { resolveProfile } = require("../../integrations/tiktok/resolver");
const {
  fetchProfile,
  TiktokAccountNotFoundError,
} = require("../../integrations/tiktok/client");

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

    const latestVideo =
      profile.videos.find((v) => !v.isLive) || profile.videos[0] || null;

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
      diagnostic: profile.diagnostic || null,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`GET tiktok check: ${err.message}`);
    res.status(500).json({ error: "Failed to check TikTok profile" });
  }
});

// POST /api/guilds/:id/tiktok/:subId/force-notify
// Force-send a notification right now using live data from TikTok.
// Bypasses scheduler dedup state — use for manual testing only.
// Body (optional): { "type": "video" | "live" }  — defaults to "video"
router.post("/:id/tiktok/:subId/force-notify", async (req, res) => {
  try {
    const { id: guildId, subId } = req.params;
    const notifyType = req.body?.type === "live" ? "live" : "video";

    const subs = await tiktokStorage.listSubscriptions(guildId);
    const sub = subs.find((s) => s.id === subId);
    if (!sub) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    const discordClient = req.app.locals.client;
    if (!discordClient) {
      return res.status(503).json({ error: "Discord client not available" });
    }

    let profile;
    try {
      profile = await fetchProfile(sub.username);
    } catch (err) {
      if (err instanceof TiktokAccountNotFoundError) {
        return res.status(404).json({
          error: `TikTok account @${sub.username} not found`,
        });
      }
      return res.status(502).json({
        error: `Failed to fetch TikTok profile: ${err.message}`,
      });
    }

    const tiktokStateStorage = require("../../persistence/tiktokStateStorage");
    const notifier = require("../../integrations/tiktok/notifier");
    const { buildContent } = require("../../lib/notificationTemplate");

    if (notifyType === "live") {
      if (!profile.user.live) {
        return res.status(409).json({
          error: `@${sub.username} is not currently live`,
          live: false,
        });
      }
      const liveUrl = profile.user.liveUrl;
      const embed = notifier.buildLiveEmbed(discordClient, {
        username: sub.username,
        liveUrl,
        avatar: profile.user.avatar,
      });
      const row = notifier.buildLinkRow("Join the live", liveUrl);
      const content = buildContent({
        customMessage: sub.customMessage,
        mentionRoleId: sub.mentionRoleId,
        defaultPrefix: `🔴 [TIKTOK LIVE] @${sub.username} is live on TikTok!`,
        vars: {
          name: `@${sub.username}`,
          url: liveUrl,
          title: `@${sub.username} is live`,
          type: "live",
        },
      });
      await notifier.send(discordClient, sub, { embed, row, content });

      await tiktokStateStorage.setState(sub.username, {
        isLive: true,
        lastLiveId: profile.user.liveId || "live",
      });

      return res.json({ sent: true, type: "live", liveUrl });
    }

    // type === "video"
    const latest = profile.videos.find((v) => !v.isLive) || profile.videos[0];
    if (!latest) {
      return res.status(404).json({
        error: `No videos or posts found for @${sub.username}`,
      });
    }

    const embed = notifier.buildVideoEmbed(discordClient, {
      username: sub.username,
      video: latest,
      avatar: profile.user.avatar,
    });
    const row = notifier.buildLinkRow("Watch on TikTok", latest.url);
    const content = buildContent({
      customMessage: sub.customMessage,
      mentionRoleId: sub.mentionRoleId,
      defaultPrefix: `📲 [TIKTOK] @${sub.username} posted a new video`,
      vars: {
        name: `@${sub.username}`,
        url: latest.url,
        title: latest.title || "",
        type: "video",
      },
    });
    await notifier.send(discordClient, sub, { embed, row, content });

    // Mark as seen in state storage so background scheduler won't re-trigger notification
    const state = (await tiktokStateStorage.getState(sub.username)) || {};
    const seenVideoIds = Array.isArray(state.seenVideoIds)
      ? state.seenVideoIds
      : [];
    let latestTime = latest.createTime ? Number(latest.createTime) : 0;
    if (!latestTime && latest.id) {
      try {
        latestTime = Number(BigInt(latest.id) >> 32n);
      } catch (_) {}
    }
    await tiktokStateStorage.setState(sub.username, {
      lastVideoId: latest.id,
      lastVideoCreateTime: Math.max(latestTime, state.lastVideoCreateTime || 0),
      seenVideoIds: [...new Set([latest.id, ...seenVideoIds])].slice(0, 50),
    });

    return res.json({
      sent: true,
      type: "video",
      video: {
        id: latest.id,
        url: latest.url,
        title: latest.title || null,
        createTime: latest.createTime || null,
        createTime_iso: latest.createTime
          ? new Date(latest.createTime * 1000).toISOString()
          : null,
      },
    });
  } catch (err) {
    logger.error(`POST tiktok force-notify: ${err.message}`);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

module.exports = router;
