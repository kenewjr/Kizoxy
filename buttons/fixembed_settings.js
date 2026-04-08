/**
 * fixembed_settings.js
 * Handles ALL button/select interactions for the paginated /fixembed settings UI.
 *
 * customId format:  fxs:<action>:<guildId>:<invokerUserId>
 *
 * Rule: every action ends with a SINGLE interaction.editReply() — no followUp().
 * The embed itself updates to reflect the change (status line / field update).
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
} = require("discord.js");
const fixembedStorage = require("../utils/fixembedStorage");

// ─── Page embeds ─────────────────────────────────────────────────────────────

function fmt(arr, mentionFn) {
  return arr.length ? arr.map(mentionFn).join(", ") : "*None*";
}

function buildMainPage(s, guild, color, notice = "") {
  const actionLabel = { nothing: "Nothing", remove_embed: "Remove Embed", delete_message: "Delete Message" };
  const modeLabel   = { normal: "Normal", direct: "Direct", gallery: "Gallery", text: "Text-only" };

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔗 FixEmbed — ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
    .setDescription(notice || null)
    .addFields(
      { name: "Status",              value: s.enabled ? "✅ Enabled" : "🚫 Disabled",                                                                  inline: true },
      { name: "Base Message Action", value: actionLabel[s.baseMessageAction] ?? s.baseMessageAction,                                                   inline: true },
      { name: "View Mode",           value: modeLabel[s.viewMode] ?? s.viewMode,                                                                       inline: true },
      { name: "Ignored Channels",    value: fmt(s.disabledChannels, (id) => `<#${id}>`),                                                              inline: false },
      { name: "Ignored Users",       value: fmt(s.ignoredUsers, (id) => `<@${id}>`),                                                                  inline: false },
      { name: "Ignored Roles",       value: fmt(s.ignoredRoles, (id) => `<@&${id}>`),                                                                 inline: false },
      { name: "Ignored Keywords",    value: s.ignoredKeywords.length ? s.ignoredKeywords.map((k) => `\`${k}\``).join(", ") : "*None*",                inline: false },
    )
    .setFooter({ text: "📄 Page 1/3 — Status Overview" })
    .setTimestamp();
}

function buildBehaviorPage(s, color, notice = "") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("🔗 FixEmbed — Behavior Settings")
    .setDescription(
      (notice ? `> ${notice}\n\n` : "") +
      "**Base Message Action** — what happens to the original message\n" +
      "> `Nothing` — leave the original untouched\n" +
      "> `Remove Embed` — suppress the original link preview *(default)*\n" +
      "> `Delete Message` — delete the original message entirely\n\n" +
      "**View Mode** — which embed style to use *(where supported: Twitter, Bluesky, TikTok, Instagram)*\n" +
      "> `Normal` — standard embed *(default)*\n" +
      "> `Direct` — direct video/image file\n" +
      "> `Gallery` — gallery view (multiple images)\n" +
      "> `Text` — text-only view (no media)"
    )
    .addFields(
      { name: "Current: Base Action", value: `\`${s.baseMessageAction}\``, inline: true },
      { name: "Current: View Mode",   value: `\`${s.viewMode}\``,          inline: true },
    )
    .setFooter({ text: "📄 Page 2/3 — Behavior | Use dropdowns to change values" })
    .setTimestamp();
}

function buildIgnorePage(s, color, notice = "") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("🔗 FixEmbed — Ignore Lists")
    .setDescription(
      (notice ? `> ${notice}\n\n` : "") +
      "**➕ Add** — use a select menu below to pick a channel/user/role to ignore.\n" +
      "**➖ Remove** — select the same item again, or press a **Clear** button below.\n" +
      "**Keywords** — use `/fixembed ignore-keyword <word>` to add/remove keywords."
    )
    .addFields(
      { name: "🔇 Ignored Channels", value: fmt(s.disabledChannels, (id) => `<#${id}>`),  inline: false },
      { name: "🙈 Ignored Users",    value: fmt(s.ignoredUsers, (id) => `<@${id}>`),       inline: false },
      { name: "🏷️ Ignored Roles",   value: fmt(s.ignoredRoles, (id) => `<@&${id}>`),      inline: false },
      { name: "🔑 Ignored Keywords", value: s.ignoredKeywords.length ? s.ignoredKeywords.map((k) => `\`${k}\``).join(", ") : "*None*", inline: false },
    )
    .setFooter({ text: "📄 Page 3/3 — Ignore Lists" })
    .setTimestamp();
}

// ─── Component rows ───────────────────────────────────────────────────────────

function navRow(guildId, userId, currentPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fxs:page_main:${guildId}:${userId}`)
      .setLabel("📊 Status")
      .setStyle(currentPage === "main" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === "main"),
    new ButtonBuilder()
      .setCustomId(`fxs:page_behavior:${guildId}:${userId}`)
      .setLabel("⚙️ Behavior")
      .setStyle(currentPage === "behavior" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === "behavior"),
    new ButtonBuilder()
      .setCustomId(`fxs:page_ignore:${guildId}:${userId}`)
      .setLabel("🚫 Ignore Lists")
      .setStyle(currentPage === "ignore" ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === "ignore"),
    new ButtonBuilder()
      .setCustomId(`fxs:toggle_enabled:${guildId}:${userId}`)
      .setLabel("🔛 Toggle")
      .setStyle(ButtonStyle.Secondary),
  );
}

function actionSelectRow(guildId, userId, current) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fxs:set_action:${guildId}:${userId}`)
      .setPlaceholder(`Base Message Action: ${current}`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Nothing — leave original")        .setValue("nothing")        .setDefault(current === "nothing"),
        new StringSelectMenuOptionBuilder().setLabel("Remove Embed — suppress preview") .setValue("remove_embed")   .setDefault(current === "remove_embed"),
        new StringSelectMenuOptionBuilder().setLabel("Delete Message — delete original").setValue("delete_message") .setDefault(current === "delete_message"),
      )
  );
}

function viewSelectRow(guildId, userId, current) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fxs:set_view:${guildId}:${userId}`)
      .setPlaceholder(`View Mode: ${current}`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Normal — standard embed")             .setValue("normal")  .setDefault(current === "normal"),
        new StringSelectMenuOptionBuilder().setLabel("Direct — direct media (video/image)") .setValue("direct")  .setDefault(current === "direct"),
        new StringSelectMenuOptionBuilder().setLabel("Gallery — gallery view")              .setValue("gallery") .setDefault(current === "gallery"),
        new StringSelectMenuOptionBuilder().setLabel("Text — text-only view")               .setValue("text")    .setDefault(current === "text"),
      )
  );
}

function channelSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`fxs:toggle_channel:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a channel")
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1).setMaxValues(1)
  );
}

function userSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`fxs:toggle_user:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a user")
      .setMinValues(1).setMaxValues(1)
  );
}

function roleSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`fxs:toggle_role:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a role")
      .setMinValues(1).setMaxValues(1)
  );
}

// Row 5: clear-all buttons for each list
function clearAllRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fxs:clear_channels:${guildId}:${userId}`)
      .setLabel("✖ Channels")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`fxs:clear_users:${guildId}:${userId}`)
      .setLabel("✖ Users")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`fxs:clear_roles:${guildId}:${userId}`)
      .setLabel("✖ Roles")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`fxs:clear_keywords:${guildId}:${userId}`)
      .setLabel("✖ Keywords")
      .setStyle(ButtonStyle.Danger),
  );
}

function ignorePage(s, color, notice, guildId, userId) {
  return {
    embeds: [buildIgnorePage(s, color, notice)],
    components: [
      navRow(guildId, userId, "ignore"),
      channelSelectRow(guildId, userId),
      userSelectRow(guildId, userId),
      roleSelectRow(guildId, userId),
      clearAllRow(guildId, userId),
    ],
  };
}

function behaviorPage(s, color, notice, guildId, userId) {
  return {
    embeds: [buildBehaviorPage(s, color, notice)],
    components: [
      navRow(guildId, userId, "behavior"),
      actionSelectRow(guildId, userId, s.baseMessageAction),
      viewSelectRow(guildId, userId, s.viewMode),
    ],
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = {
  customId: "fxs",
  execute: async (interaction, client) => {
    const parts         = interaction.customId.split(":");
    const action        = parts[1];
    const guildId       = parts[2];
    const invokerUserId = parts[3];

    // Only the original invoker can use these controls
    if (interaction.user.id !== invokerUserId) {
      return interaction.editReply({
        content: "❌ Only the person who ran `/fixembed` can use these controls.",
      });
    }

    const guild = interaction.guild;
    const color = client.color;
    let s = fixembedStorage.getSettings(guildId);

    // ── toggle_enabled ────────────────────────────────────────────────────────
    if (action === "toggle_enabled") {
      fixembedStorage.setEnabled(guildId, !s.enabled);
      s = fixembedStorage.getSettings(guildId);
      const notice = s.enabled ? "✅ Embed fixer **enabled**." : "🚫 Embed fixer **disabled**.";
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
      const labels = { nothing: "Nothing", remove_embed: "Remove Embed", delete_message: "Delete Message" };
      const notice = `✅ Base message action set to **${labels[s.baseMessageAction]}**.`;
      return interaction.editReply(behaviorPage(s, color, notice, guildId, invokerUserId));
    }

    // ── set_view ──────────────────────────────────────────────────────────────
    if (action === "set_view") {
      const value = interaction.values?.[0];
      if (value) fixembedStorage.setViewMode(guildId, value);
      s = fixembedStorage.getSettings(guildId);
      const labels = { normal: "Normal", direct: "Direct", gallery: "Gallery", text: "Text-only" };
      const notice = `✅ View mode set to **${labels[s.viewMode]}**.`;
      return interaction.editReply(behaviorPage(s, color, notice, guildId, invokerUserId));
    }

    // ── toggle_channel ────────────────────────────────────────────────────────
    if (action === "toggle_channel") {
      const channelId = interaction.values?.[0];
      let notice = "";
      if (channelId) {
        const added = fixembedStorage.toggleChannel(guildId, channelId);
        notice = added ? `➕ <#${channelId}> added to ignore list.` : `➖ <#${channelId}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, notice, guildId, invokerUserId));
    }

    // ── toggle_user ───────────────────────────────────────────────────────────
    if (action === "toggle_user") {
      const userId2 = interaction.values?.[0];
      let notice = "";
      if (userId2) {
        const added = fixembedStorage.toggleUser(guildId, userId2);
        notice = added ? `➕ <@${userId2}> added to ignore list.` : `➖ <@${userId2}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, notice, guildId, invokerUserId));
    }

    // ── toggle_role ───────────────────────────────────────────────────────────
    if (action === "toggle_role") {
      const roleId = interaction.values?.[0];
      let notice = "";
      if (roleId) {
        const added = fixembedStorage.toggleRole(guildId, roleId);
        notice = added ? `➕ <@&${roleId}> added to ignore list.` : `➖ <@&${roleId}> removed from ignore list.`;
      }
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, notice, guildId, invokerUserId));
    }

    // ── clear_channels ────────────────────────────────────────────────────────
    if (action === "clear_channels") {
      fixembedStorage.saveSettings(guildId, { disabledChannels: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, "✅ All ignored channels cleared.", guildId, invokerUserId));
    }

    // ── clear_users ───────────────────────────────────────────────────────────
    if (action === "clear_users") {
      fixembedStorage.saveSettings(guildId, { ignoredUsers: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, "✅ All ignored users cleared.", guildId, invokerUserId));
    }

    // ── clear_roles ───────────────────────────────────────────────────────────
    if (action === "clear_roles") {
      fixembedStorage.saveSettings(guildId, { ignoredRoles: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, "✅ All ignored roles cleared.", guildId, invokerUserId));
    }

    // ── clear_keywords ────────────────────────────────────────────────────────
    if (action === "clear_keywords") {
      fixembedStorage.saveSettings(guildId, { ignoredKeywords: [] });
      s = fixembedStorage.getSettings(guildId);
      return interaction.editReply(ignorePage(s, color, "✅ All ignored keywords cleared.", guildId, invokerUserId));
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
      return interaction.editReply(behaviorPage(s, color, "", guildId, invokerUserId));
    }

    // ── page_ignore ───────────────────────────────────────────────────────────
    if (action === "page_ignore") {
      return interaction.editReply(ignorePage(s, color, "", guildId, invokerUserId));
    }
  },
};
