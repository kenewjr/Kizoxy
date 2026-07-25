const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");

async function buildMainMenuEmbed(client, guildId) {
  const settings = await tempVcStorage.getSettings(guildId);
  const generators = await tempVcStorage.getAllGenerators(guildId);
  const templates = await tempVcStorage.getAllTemplates(guildId);
  const voiceRoles = await tempVcStorage.getVoiceRoles(guildId);

  const tier = settings.isPremium ? "Premium" : "Free";

  return Embeds.brand(client, {
    title: "⚡ TempVC Configuration Panel",
    description:
      "Manage automatic temporary voice channel settings, templates, and active role connections.",
    fields: [
      {
        name: "🎙️ Generators",
        value: `\`${generators.length} / ${settings.maxGenerators}\` configured.\n*Setup and manage voice channels that trigger creation of new temporary channels.*`,
        inline: false,
      },
      {
        name: "📋 Templates",
        value: `\`${templates.length} / ${settings.maxTemplates}\` configured.\n*Create permission patterns, name styles, and defaults for TempVCs.*`,
        inline: false,
      },
      {
        name: "🎭 Voice Roles",
        value: `\`${voiceRoles.length} / ${settings.maxVoiceRoles}\` configured.\n*Auto-assign roles to members while they reside in a TempVC.*`,
        inline: false,
      },
    ],
    footerText: `Server tier: ${tier}`,
  });
}

function buildMainMenuComponents(_client, _guildId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:generators")
      .setLabel("🎙️ Generators")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:templates")
      .setLabel("📋 Templates")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:voice_roles")
      .setLabel("🎭 Voice Roles")
      .setStyle(ButtonStyle.Primary),
  );
  return [row];
}

module.exports = {
  buildMainMenuEmbed,
  buildMainMenuComponents,
};
