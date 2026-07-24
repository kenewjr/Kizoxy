const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const fixembedStorage = require("../../../persistence/fixembedStorage");
const Embeds = require("../../../lib/embeds");
const { PLATFORM_GROUPS, PLATFORM_META } = require("./meta");

function buildPlatformsMainEmbed(client, guildId) {
  const s = fixembedStorage.getSettings(guildId);

  const fields = Object.entries(PLATFORM_GROUPS).map(
    ([groupKey, platforms]) => {
      const active = platforms.filter(
        (p) => s.platforms[p]?.enabled !== false,
      ).length;
      const emoji =
        groupKey === "social"
          ? "📸"
          : groupKey === "media"
            ? "▶️"
            : groupKey === "art"
              ? "🎨"
              : "🔌";
      return {
        name: `${emoji} ${groupKey.toUpperCase()}`,
        value: `${active} / ${platforms.length} platforms active.`,
        inline: true,
      };
    },
  );

  return Embeds.brand(client, {
    title: "🧩 Platform Embed Controls",
    description:
      "Manage individual platforms which will be intercepted and fixed.",
    fields,
  });
}

function buildPlatformsMainComponents() {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("fixembed_panel:select_platform_group")
      .setPlaceholder("Choose a platform category...")
      .addOptions([
        { label: "📸 Social Platforms", value: "social" },
        { label: "▶️ Media Platforms", value: "media" },
        { label: "🎨 Art Platforms", value: "art" },
        { label: "🔌 Universal (EmbedEZ)", value: "embedez" },
        { label: "🔙 Back to Main Settings", value: "back" },
      ]),
  );
  return [row];
}

function buildPlatformsGroupEmbed(client, guildId, groupKey) {
  const s = fixembedStorage.getSettings(guildId);
  const list = PLATFORM_GROUPS[groupKey] || [];

  const lines = list
    .map((p) => {
      const meta = PLATFORM_META[p];
      const enabled =
        s.platforms[p]?.enabled !== false ? "✅ Enabled" : "❌ Disabled";
      const mode =
        PLATFORM_META[p].viewModes.length > 0
          ? ` (${s.platforms[p]?.viewMode || "normal"})`
          : "";
      return `${meta.emoji} **${meta.label}** : ${enabled}${mode}`;
    })
    .join("\n");

  return Embeds.brand(client, {
    title: `🧩 Platform Category: ${groupKey.toUpperCase()}`,
    description: lines,
  });
}

function buildPlatformsGroupComponents(guildId, groupKey) {
  const list = PLATFORM_GROUPS[groupKey] || [];
  const options = list.map((p) => {
    const meta = PLATFORM_META[p];
    return {
      label: meta.label,
      value: p,
      emoji: meta.emoji,
    };
  });

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("fixembed_panel:select_platform")
      .setPlaceholder("Select a platform to configure...")
      .addOptions(options),
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fixembed_panel:back_to_platforms")
      .setLabel("🔙 Back to Categories")
      .setStyle(ButtonStyle.Secondary),
  );

  return [selectRow, backRow];
}

function buildPlatformDetailEmbed(client, guildId, platformKey) {
  const s = fixembedStorage.getSettings(guildId);
  const meta = PLATFORM_META[platformKey];
  const enabled =
    s.platforms[platformKey]?.enabled !== false ? "✅ Enabled" : "❌ Disabled";
  const viewMode = s.platforms[platformKey]?.viewMode || "normal";

  return Embeds.brand(client, {
    title: `${meta.emoji} Platform Settings: ${meta.label}`,
    fields: [
      { name: "Interception Status", value: enabled, inline: true },
      {
        name: "View Mode",
        value: meta.viewModes.length > 0 ? viewMode : "Not supported",
        inline: true,
      },
    ],
  });
}

function buildPlatformDetailComponents(guildId, platformKey) {
  const s = fixembedStorage.getSettings(guildId);
  const meta = PLATFORM_META[platformKey];
  const isEnabled = s.platforms[platformKey]?.enabled !== false;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fixembed_panel:toggle_platform:${platformKey}`)
      .setLabel(isEnabled ? "Disable Interception" : "Enable Interception")
      .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
  );

  if (meta.viewModes.length > 0) {
    const currentMode = s.platforms[platformKey]?.viewMode || "normal";
    const options = meta.viewModes.map((m) => ({
      label: `Mode: ${m}`,
      value: m.toLowerCase(),
      default: m.toLowerCase() === currentMode.toLowerCase(),
    }));

    row1.addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`fixembed_panel:select_viewmode:${platformKey}`)
        .setPlaceholder("Select view mode...")
        .addOptions(options),
    );
  }

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fixembed_panel:back_to_group:${platformKey}`)
      .setLabel("🔙 Back to Category")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

module.exports = {
  buildPlatformsMainEmbed,
  buildPlatformsMainComponents,
  buildPlatformsGroupEmbed,
  buildPlatformsGroupComponents,
  buildPlatformDetailEmbed,
  buildPlatformDetailComponents,
};
