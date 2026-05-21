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

const ACTION_LABELS = {
  nothing: "Nothing",
  remove_embed: "Remove Embed",
  delete_message: "Delete Message",
};

const VIEW_MODE_LABELS = {
  normal: "Normal",
  direct: "Direct",
  gallery: "Gallery",
  text: "Text-only",
};

const ACTION_OPTIONS = [
  { label: "Nothing — leave original", value: "nothing" },
  { label: "Remove Embed — suppress preview", value: "remove_embed" },
  { label: "Delete Message — delete original", value: "delete_message" },
];

const VIEW_OPTIONS = [
  { label: "Normal — standard embed", value: "normal" },
  { label: "Direct — direct media (video/image)", value: "direct" },
  { label: "Gallery — gallery view", value: "gallery" },
  { label: "Text — text-only view", value: "text" },
];

function buildOptions(options, current) {
  return options.map((o) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(o.label)
      .setValue(o.value)
      .setDefault(o.value === current),
  );
}

function fmt(arr, mentionFn) {
  return arr.length ? arr.map(mentionFn).join(", ") : "*None*";
}

// ── Embed builders ──────────────────────────────────────────────────
function buildMainPage(s, guild, color, notice = "") {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔗 FixEmbed — ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
    .setDescription(notice || null)
    .addFields(
      {
        name: "Status",
        value: s.enabled ? "✅ Enabled" : "🚫 Disabled",
        inline: true,
      },
      {
        name: "Base Message Action",
        value: ACTION_LABELS[s.baseMessageAction] ?? s.baseMessageAction,
        inline: true,
      },
      {
        name: "View Mode",
        value: VIEW_MODE_LABELS[s.viewMode] ?? s.viewMode,
        inline: true,
      },
      {
        name: "Ignored Channels",
        value: fmt(s.disabledChannels, (id) => `<#${id}>`),
        inline: false,
      },
      {
        name: "Ignored Users",
        value: fmt(s.ignoredUsers, (id) => `<@${id}>`),
        inline: false,
      },
      {
        name: "Ignored Roles",
        value: fmt(s.ignoredRoles, (id) => `<@&${id}>`),
        inline: false,
      },
      {
        name: "Ignored Keywords",
        value: s.ignoredKeywords.length
          ? s.ignoredKeywords.map((k) => `\`${k}\``).join(", ")
          : "*None*",
        inline: false,
      },
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
      "> `Text` — text-only view (no media)",
    )
    .addFields(
      {
        name: "Current: Base Action",
        value: `\`${s.baseMessageAction}\``,
        inline: true,
      },
      { name: "Current: View Mode", value: `\`${s.viewMode}\``, inline: true },
    )
    .setFooter({
      text: "📄 Page 2/3 — Behavior | Use dropdowns to change values",
    })
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
      "**Keywords** — use `/fixembed ignore-keyword <word>` to add/remove keywords.",
    )
    .addFields(
      {
        name: "🔇 Ignored Channels",
        value: fmt(s.disabledChannels, (id) => `<#${id}>`),
        inline: false,
      },
      {
        name: "🙈 Ignored Users",
        value: fmt(s.ignoredUsers, (id) => `<@${id}>`),
        inline: false,
      },
      {
        name: "🏷️ Ignored Roles",
        value: fmt(s.ignoredRoles, (id) => `<@&${id}>`),
        inline: false,
      },
      {
        name: "🔑 Ignored Keywords",
        value: s.ignoredKeywords.length
          ? s.ignoredKeywords.map((k) => `\`${k}\``).join(", ")
          : "*None*",
        inline: false,
      },
    )
    .setFooter({ text: "📄 Page 3/3 — Ignore Lists" })
    .setTimestamp();
}

// ── Component rows ──────────────────────────────────────────────────
function navRow(guildId, userId, currentPage) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fxs:page_main:${guildId}:${userId}`)
      .setLabel("📊 Status")
      .setStyle(
        currentPage === "main" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
      .setDisabled(currentPage === "main"),
    new ButtonBuilder()
      .setCustomId(`fxs:page_behavior:${guildId}:${userId}`)
      .setLabel("⚙️ Behavior")
      .setStyle(
        currentPage === "behavior"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
      )
      .setDisabled(currentPage === "behavior"),
    new ButtonBuilder()
      .setCustomId(`fxs:page_ignore:${guildId}:${userId}`)
      .setLabel("🚫 Ignore Lists")
      .setStyle(
        currentPage === "ignore" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      )
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
      .addOptions(...buildOptions(ACTION_OPTIONS, current)),
  );
}

function viewSelectRow(guildId, userId, current) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fxs:set_view:${guildId}:${userId}`)
      .setPlaceholder(`View Mode: ${current}`)
      .addOptions(...buildOptions(VIEW_OPTIONS, current)),
  );
}

function channelSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`fxs:toggle_channel:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a channel")
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function userSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`fxs:toggle_user:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a user")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function roleSelectRow(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`fxs:toggle_role:${guildId}:${userId}`)
      .setPlaceholder("Toggle ignore: select a role")
      .setMinValues(1)
      .setMaxValues(1),
  );
}

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

// ── Page assemblers ─────────────────────────────────────────────────
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

module.exports = {
  ACTION_LABELS,
  VIEW_MODE_LABELS,
  fmt,
  buildMainPage,
  buildBehaviorPage,
  buildIgnorePage,
  navRow,
  actionSelectRow,
  viewSelectRow,
  channelSelectRow,
  userSelectRow,
  roleSelectRow,
  clearAllRow,
  ignorePage,
  behaviorPage,
};
