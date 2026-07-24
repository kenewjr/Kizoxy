const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fixembedStorage = require("../../../persistence/fixembedStorage");
const Embeds = require("../../../lib/embeds");

function buildMainEmbed(client, guildId) {
  const s = fixembedStorage.getSettings(guildId);
  const status = s.enabled ? "✅ **Enabled**" : "❌ **Disabled**";
  const mapping = {
    suppress: "Suppress Embeds",
    delete: "Delete & Repost",
    none: "Send Alongside",
  };
  const behavior = mapping[s.deleteBehavior] || "Suppress Embeds";
  const spoiler = s.spoilerPassthrough ? "✅ Active" : "❌ Disabled";

  const totalPlatforms = 23;
  const disabledPlats = Object.entries(s.platforms || {})
    .filter(([_, cfg]) => cfg.enabled === false)
    .map(([key]) => key);
  const platformsStatus =
    disabledPlats.length > 0
      ? `⚠️ ${totalPlatforms - disabledPlats.length} / ${totalPlatforms} active (disabled: ${disabledPlats.join(", ")})`
      : `✅ All ${totalPlatforms} platforms active`;

  return Embeds.brand(client, {
    title: "🛠️ FixEmbed Guild Settings",
    description: "Manage automatic link embed fixes and ignore criteria.",
    fields: [
      { name: "Status", value: status, inline: true },
      { name: "Delete Behavior", value: behavior, inline: true },
      { name: "Spoiler Passthrough", value: spoiler, inline: true },
      { name: "Platforms", value: platformsStatus, inline: false },
      {
        name: "Ignore Filters",
        value: [
          `📢 Channels: ${s.ignoredChannels?.length || 0}`,
          `👤 Users: ${s.ignoredUsers?.length || 0}`,
          `🛡️ Roles: ${s.ignoredRoles?.length || 0}`,
          `🌐 Domains: ${s.ignoredDomains?.length || 0}`,
          `🔑 Keywords: ${s.ignoredKeywords?.length || 0}`,
        ].join("\n"),
        inline: false,
      },
    ],
  });
}

function buildMainComponents(guildId) {
  const s = fixembedStorage.getSettings(guildId);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fixembed_panel:toggle_enabled")
      .setLabel(s.enabled ? "Disable FixEmbed" : "Enable FixEmbed")
      .setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("fixembed_panel:toggle_behavior")
      .setLabel("Change Behavior")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("fixembed_panel:toggle_spoiler")
      .setLabel("Toggle Spoiler Fix")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("fixembed_panel:view_ignores")
      .setLabel("🛡️ Ignore Filters")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("fixembed_panel:view_platforms")
      .setLabel("🧩 Platform Controls")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("fixembed_panel:reset")
      .setLabel("Reset Settings")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

module.exports = {
  buildMainEmbed,
  buildMainComponents,
};
