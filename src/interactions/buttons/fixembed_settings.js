const fixembedStorage = require("../../persistence/fixembedStorage");
const {
  ACTION_LABELS,
  VIEW_MODE_LABELS,
  buildMainPage,
  navRow,
  ignorePage,
  behaviorPage,
} = require("../../features/fixembed/fixembedSettingsHelper");

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = {
  customId: "fxs",
  execute: async (interaction, client) => {
    const parts = interaction.customId.split(":");
    const action = parts[1];
    const guildId = parts[2];
    const invokerUserId = parts[3];

    // Only the original invoker can use these controls
    if (interaction.user.id !== invokerUserId) {
      return interaction.editReply({
        content:
          "❌ Only the person who ran `/fixembed` can use these controls.",
      });
    }

    const guild = interaction.guild;
    const color = client.color;
    let s = fixembedStorage.getSettings(guildId);

    // ── toggle_enabled ────────────────────────────────────────────────────────
    if (action === "toggle_enabled") {
      fixembedStorage.setEnabled(guildId, !s.enabled);
      s = fixembedStorage.getSettings(guildId);
      const notice = s.enabled
        ? "✅ Embed fixer **enabled**."
        : "🚫 Embed fixer **disabled**.";
      return interaction.editReply({
        embeds: [buildMainPage(s, guild, color, notice)],
        components: [navRow(guildId, invokerUserId, "main")],
      });
    }

    // ── set_action ────────────────────────────────────────────────────────────
    if (action === "set_action") {
      const value = interaction.values?.[0];
      if (value) fixembedStorage.setBaseMessageAction(guildId, value);
      s = fixembedStorage.getSettings(guildId);
      const notice = `✅ Base message action set to **${ACTION_LABELS[s.baseMessageAction]}**.`;
      return interaction.editReply(
        behaviorPage(s, color, notice, guildId, invokerUserId),
      );
    }

    // ── set_view ──────────────────────────────────────────────────────────────
    if (action === "set_view") {
      const value = interaction.values?.[0];
      if (value) fixembedStorage.setViewMode(guildId, value);
      s = fixembedStorage.getSettings(guildId);
      const notice = `✅ View mode set to **${VIEW_MODE_LABELS[s.viewMode]}**.`;
      return interaction.editReply(
        behaviorPage(s, color, notice, guildId, invokerUserId),
      );
    }

    // ── toggle_channel ────────────────────────────────────────────────────────
    if (action === "toggle_channel") {
      const channelId = interaction.values?.[0];
      let notice = "";
      if (channelId) {
        const added = fixembedStorage.toggleChannel(guildId, channelId);
        notice = added
          ? `➕ <#${channelId}> added to ignore list.`
          : `➖ <#${channelId}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(s, color, notice, guildId, invokerUserId),
      );
    }

    // ── toggle_user ───────────────────────────────────────────────────────────
    if (action === "toggle_user") {
      const userId2 = interaction.values?.[0];
      let notice = "";
      if (userId2) {
        const added = fixembedStorage.toggleUser(guildId, userId2);
        notice = added
          ? `➕ <@${userId2}> added to ignore list.`
          : `➖ <@${userId2}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(s, color, notice, guildId, invokerUserId),
      );
    }

    // ── toggle_role ───────────────────────────────────────────────────────────
    if (action === "toggle_role") {
      const roleId = interaction.values?.[0];
      let notice = "";
      if (roleId) {
        const added = fixembedStorage.toggleRole(guildId, roleId);
        notice = added
          ? `➕ <@&${roleId}> added to ignore list.`
          : `➖ <@&${roleId}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(s, color, notice, guildId, invokerUserId),
      );
    }

    // ── clear_channels ────────────────────────────────────────────────────────
    if (action === "clear_channels") {
      fixembedStorage.saveSettings(guildId, { disabledChannels: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(
          s,
          color,
          "✅ All ignored channels cleared.",
          guildId,
          invokerUserId,
        ),
      );
    }

    // ── clear_users ───────────────────────────────────────────────────────────
    if (action === "clear_users") {
      fixembedStorage.saveSettings(guildId, { ignoredUsers: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(
          s,
          color,
          "✅ All ignored users cleared.",
          guildId,
          invokerUserId,
        ),
      );
    }

    // ── clear_roles ───────────────────────────────────────────────────────────
    if (action === "clear_roles") {
      fixembedStorage.saveSettings(guildId, { ignoredRoles: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(
          s,
          color,
          "✅ All ignored roles cleared.",
          guildId,
          invokerUserId,
        ),
      );
    }

    // ── clear_keywords ────────────────────────────────────────────────────────
    if (action === "clear_keywords") {
      fixembedStorage.saveSettings(guildId, { ignoredKeywords: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(
        ignorePage(
          s,
          color,
          "✅ All ignored keywords cleared.",
          guildId,
          invokerUserId,
        ),
      );
    }

    // ── page_main ─────────────────────────────────────────────────────────────
    if (action === "page_main") {
      return interaction.editReply({
        embeds: [buildMainPage(s, guild, color)],
        components: [navRow(guildId, invokerUserId, "main")],
      });
    }

    // ── page_behavior ─────────────────────────────────────────────────────────
    if (action === "page_behavior") {
      return interaction.editReply(
        behaviorPage(s, color, "", guildId, invokerUserId),
      );
    }

    // ── page_ignore ───────────────────────────────────────────────────────────
    if (action === "page_ignore") {
      return interaction.editReply(
        ignorePage(s, color, "", guildId, invokerUserId),
      );
    }
  },
};
