const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");

async function buildVoiceRolesListEmbed(client, guildId) {
  const all = await tempVcStorage.getVoiceRoles(guildId);
  const settings = await tempVcStorage.getSettings(guildId);

  let description =
    "Configure roles to automatically assign to members connected to specific voice channels.\n\n";
  if (all.length === 0) {
    description +=
      "*No voice roles configured. Click **Add Voice Role** below to get started.*";
  } else {
    description += all
      .map((vr, idx) => {
        return (
          `**${idx + 1}. Role: <@&${vr.roleId}>**\n` +
          `• Channel: <#${vr.channelId}>\n` +
          `• Scope: \`${vr.ownerOnly ? "Owner Only" : "Anyone in channel"}\`\n` +
          `• ID: \`${vr.id}\``
        );
      })
      .join("\n\n");
  }

  return Embeds.brand(client, {
    title: `🎭 Voice Roles (${all.length}/${settings.maxVoiceRoles})`,
    description,
    footerText: settings.isPremium ? "Premium tier" : "Free tier",
  });
}

function buildVoiceRolesListComponents(all) {
  const rows = [];

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:vr_add_flow")
      .setLabel("➕ Add Voice Role")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:main")
      .setLabel("🔙 Main Menu")
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(row1);

  if (all.length > 0) {
    const options = all.slice(0, 25).map((vr) => ({
      label: `Role ID: ${vr.roleId} (${vr.ownerOnly ? "Owner" : "All"})`,
      value: `vr_remove:${vr.id}`,
    }));
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("tempvc_panel:vr_select_to_remove")
        .setPlaceholder("Choose a voice role to remove...")
        .addOptions(options),
    );
    rows.push(row2);
  }

  return rows;
}

function buildVoiceRoleConfigEmbed(client, voiceRole) {
  return Embeds.brand(client, {
    title: "🎭 Voice Role Attachment Configuration",
    description: "🆕 Configuring new voice role assignment",
    fields: [
      {
        name: "Voice Channel",
        value: `<#${voiceRole.channelId}>`,
        inline: true,
      },
      {
        name: "Role to Assign",
        value: `<@&${voiceRole.roleId}>`,
        inline: true,
      },
      {
        name: "Assignment Scope",
        value: voiceRole.ownerOnly
          ? "🔒 **Owner Only** (Only assign to the TempVC creator)"
          : "👥 **Anyone** (Assign to all members in the channel)",
        inline: false,
      },
    ],
  });
}

function buildVoiceRoleConfigComponents(voiceRole) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:vr_toggle_owner_btn")
      .setLabel(
        voiceRole.ownerOnly ? "🔒 Scope: Owner Only" : "👥 Scope: Anyone",
      )
      .setStyle(
        voiceRole.ownerOnly ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:vr_save")
      .setLabel("✅ Save Voice Role")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:vr_cancel")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

module.exports = {
  buildVoiceRolesListEmbed,
  buildVoiceRolesListComponents,
  buildVoiceRoleConfigEmbed,
  buildVoiceRoleConfigComponents,
};
