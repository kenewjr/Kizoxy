const {
  ApplicationCommandOptionType,
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
  PermissionsBitField,
} = require("discord.js");
const fixembedStorage = require("../../../utils/fixembedStorage");

// ─── Shared builders (mirrors buttons/fixembed_settings.js) ──────────────────

function buildMainPage(s, guild, color) {
  const fmt = (arr, mentionFn) =>
    arr.length ? arr.map(mentionFn).join(", ") : "*None*";
  const actionLabel = {
    nothing: "Nothing",
    remove_embed: "Remove Embed",
    delete_message: "Delete Message",
  };
  const modeLabel = {
    normal: "Normal",
    direct: "Direct",
    gallery: "Gallery",
    text: "Text-only",
  };

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔗 FixEmbed — ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
    .addFields(
      {
        name: "Status",
        value: s.enabled ? "✅ Enabled" : "🚫 Disabled",
        inline: true,
      },
      {
        name: "Base Message Action",
        value: actionLabel[s.baseMessageAction] ?? s.baseMessageAction,
        inline: true,
      },
      {
        name: "View Mode",
        value: modeLabel[s.viewMode] ?? s.viewMode,
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

// ─── Command ──────────────────────────────────────────────────────────────────

module.exports = {
  name: ["fixembed"],
  description: "Configure the social media embed fixer for this server.",
  category: "Settings",
  options: [
    {
      name: "settings",
      description: "Open the interactive settings panel.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "ignore-keyword",
      description:
        "Toggle an ignored keyword (messages containing it are skipped).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "keyword",
          description: "The keyword to toggle.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  permissions: {
    bot: [PermissionsBitField.Flags.SendMessages],
    user: [PermissionsBitField.Flags.ManageGuild],
  },
  run: async (client, interaction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const color = client.color;

    // ── settings → open paginated UI ──────────────────────────────────────────
    if (sub === "settings") {
      const s = fixembedStorage.getSettings(guildId);
      return interaction.reply({
        embeds: [buildMainPage(s, interaction.guild, color)],
        components: [navRow(guildId, userId, "main")],
        ephemeral: true,
      });
    }

    // ── ignore-keyword ────────────────────────────────────────────────────────
    if (sub === "ignore-keyword") {
      const keyword = interaction.options.getString("keyword");
      const added = fixembedStorage.toggleKeyword(guildId, keyword);
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🔗 FixEmbed")
        .setDescription(
          added
            ? `➕ Keyword \`${keyword}\` added — messages containing it will be skipped.`
            : `➖ Keyword \`${keyword}\` removed.`,
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
