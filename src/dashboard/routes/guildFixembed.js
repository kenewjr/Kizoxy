const router = require("express").Router();
const Logger = require("../../lib/logger");
const fixembedStorage = require("../../persistence/fixembedStorage");

const logger = new Logger("DASHBOARD-FIXEMBED");

const VALID_VIEW_MODES = ["normal", "direct", "gallery", "text"];

const KNOWN_PLATFORMS = [
  "twitter",
  "instagram",
  "tiktok",
  "reddit",
  "threads",
  "bluesky",
  "facebook",
  "tumblr",
  "mastodon",
  "youtube",
  "twitch",
  "bilibili",
  "spotify",
  "pixiv",
  "deviantart",
  "newgrounds",
  "furaffinity",
  "snapchat",
  "pinterest",
  "imgur",
  "ifunny",
  "booru",
  "danbooru",
  "weibo",
];

const PLATFORM_VIEW_MODES = {
  twitter: ["normal", "gallery", "direct", "text"],
  instagram: ["normal", "gallery", "direct"],
  tiktok: ["normal", "direct"],
  bluesky: ["normal", "gallery", "direct", "text"],
};

// GET /api/guilds/:id/fixembed
router.get("/:id/fixembed", (req, res) => {
  try {
    const { id } = req.params;
    const settings = fixembedStorage.getSettings(id);
    res.json(settings);
  } catch (err) {
    logger.error(`GET /api/guilds/${req.params.id}/fixembed: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch fixembed settings" });
  }
});

// PATCH /api/guilds/:id/fixembed
router.patch("/:id/fixembed", (req, res) => {
  try {
    const { id } = req.params;
    const {
      enabled,
      deleteBehavior,
      spoilerPassthrough,
      ignoredChannels,
      ignoredDomains,
      ignoredUsers,
      ignoredRoles,
      ignoredKeywords,
      platforms,
      view_mode,
      viewMode,
    } = req.body;

    const updates = {};

    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      updates.enabled = enabled;
    }

    if (deleteBehavior !== undefined) {
      if (!["suppress", "delete", "none"].includes(deleteBehavior)) {
        return res.status(400).json({
          error: "deleteBehavior must be 'suppress', 'delete', or 'none'",
        });
      }
      updates.deleteBehavior = deleteBehavior;
    }

    if (spoilerPassthrough !== undefined) {
      if (typeof spoilerPassthrough !== "boolean") {
        return res
          .status(400)
          .json({ error: "spoilerPassthrough must be a boolean" });
      }
      updates.spoilerPassthrough = spoilerPassthrough;
    }

    if (ignoredChannels !== undefined) {
      if (!Array.isArray(ignoredChannels)) {
        return res
          .status(400)
          .json({ error: "ignoredChannels must be an array" });
      }
      for (const ch of ignoredChannels) {
        if (typeof ch !== "string" || !/^\d{17,20}$/.test(ch)) {
          return res.status(400).json({ error: `Invalid channel ID: ${ch}` });
        }
      }
      updates.ignoredChannels = ignoredChannels;
    }

    if (ignoredDomains !== undefined) {
      if (!Array.isArray(ignoredDomains)) {
        return res
          .status(400)
          .json({ error: "ignoredDomains must be an array" });
      }
      for (const d of ignoredDomains) {
        if (typeof d !== "string" || !d || d.length > 100) {
          return res
            .status(400)
            .json({ error: `Invalid domain pattern: ${d}` });
        }
      }
      updates.ignoredDomains = ignoredDomains;
    }

    if (ignoredUsers !== undefined) {
      if (!Array.isArray(ignoredUsers)) {
        return res.status(400).json({ error: "ignoredUsers must be an array" });
      }
      for (const u of ignoredUsers) {
        if (typeof u !== "string" || !/^\d{17,20}$/.test(u)) {
          return res.status(400).json({ error: `Invalid user ID: ${u}` });
        }
      }
      updates.ignoredUsers = ignoredUsers;
    }

    if (ignoredRoles !== undefined) {
      if (!Array.isArray(ignoredRoles)) {
        return res.status(400).json({ error: "ignoredRoles must be an array" });
      }
      for (const r of ignoredRoles) {
        if (typeof r !== "string" || !/^\d{17,20}$/.test(r)) {
          return res.status(400).json({ error: `Invalid role ID: ${r}` });
        }
      }
      updates.ignoredRoles = ignoredRoles;
    }

    if (ignoredKeywords !== undefined) {
      if (!Array.isArray(ignoredKeywords)) {
        return res
          .status(400)
          .json({ error: "ignoredKeywords must be an array" });
      }
      for (const kw of ignoredKeywords) {
        if (typeof kw !== "string" || !kw || kw.length > 100) {
          return res
            .status(400)
            .json({ error: `Invalid keyword pattern: ${kw}` });
        }
      }
      updates.ignoredKeywords = ignoredKeywords;
    }

    // Keep old global viewMode compatibility
    const finalGlobalViewMode = view_mode !== undefined ? view_mode : viewMode;
    if (finalGlobalViewMode !== undefined) {
      if (!VALID_VIEW_MODES.includes(finalGlobalViewMode)) {
        return res.status(400).json({
          error: `viewMode must be one of: ${VALID_VIEW_MODES.join(", ")}`,
        });
      }
      updates.viewMode = finalGlobalViewMode;
    }

    if (platforms !== undefined) {
      if (typeof platforms !== "object" || platforms === null) {
        return res.status(400).json({ error: "platforms must be an object" });
      }
      const validatedPlatforms = {};
      const current = fixembedStorage.getSettings(id);

      for (const [key, val] of Object.entries(platforms)) {
        if (!KNOWN_PLATFORMS.includes(key)) {
          return res.status(400).json({ error: `Unknown platform: ${key}` });
        }
        if (val !== undefined && (typeof val !== "object" || val === null)) {
          return res
            .status(400)
            .json({ error: `Platform settings for ${key} must be an object` });
        }

        const platConfig = { ...(current.platforms?.[key] || {}) };
        if (val.enabled !== undefined) {
          if (typeof val.enabled !== "boolean") {
            return res
              .status(400)
              .json({ error: `Platform ${key} enabled must be a boolean` });
          }
          platConfig.enabled = val.enabled;
        }

        if (val.viewMode !== undefined) {
          const allowedModes = PLATFORM_VIEW_MODES[key];
          if (allowedModes) {
            if (!allowedModes.includes(val.viewMode)) {
              return res.status(400).json({
                error: `Platform ${key} viewMode must be one of: ${allowedModes.join(", ")}`,
              });
            }
            platConfig.viewMode = val.viewMode;
          }
        }
        validatedPlatforms[key] = platConfig;
      }
      updates.platforms = {
        ...(current.platforms || {}),
        ...validatedPlatforms,
      };
    }

    const updated = fixembedStorage.saveSettings(id, updates);
    res.json(updated);
  } catch (err) {
    logger.error(`PATCH /api/guilds/${req.params.id}/fixembed: ${err.message}`);
    res.status(500).json({ error: "Failed to update fixembed settings" });
  }
});

module.exports = router;
