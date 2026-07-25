const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");

async function buildTemplatesListEmbed(client, guildId) {
  const templates = await tempVcStorage.getAllTemplates(guildId);
  const settings = await tempVcStorage.getSettings(guildId);

  let description =
    "Configure permission, visibility, and name patterns for voice channels.\n\n";
  if (templates.length === 0) {
    description +=
      "*No templates configured. Click **Add Template** below to get started.*";
  } else {
    description += templates
      .map((t, idx) => {
        return (
          `**${idx + 1}. ${t.name}** (\`${t.id}\`)\n` +
          `• Channel name: \`${t.channelName}\`\n` +
          `• Name pattern: \`${t.namePattern || "—"}\`\n` +
          `• Limit: \`${t.limit || "Unlimited"}\` • Bitrate: \`${Math.round((t.bitrate || 0) / 1000)} kbps\`\n` +
          `• Locked: \`${t.isLocked ? "Yes" : "No"}\` • Hidden: \`${t.isHidden ? "Yes" : "No"}\``
        );
      })
      .join("\n\n");
  }

  return Embeds.brand(client, {
    title: `📋 Voice Templates (${templates.length}/${settings.maxTemplates})`,
    description,
    footerText: settings.isPremium ? "Premium tier" : "Free tier",
  });
}

function buildTemplatesListComponents(templates) {
  const rows = [];

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_add_flow")
      .setLabel("➕ Add Template")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:main")
      .setLabel("🔙 Main Menu")
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(row1);

  if (templates.length > 0) {
    const options = templates.slice(0, 25).map((t) => ({
      label: `${t.name.slice(0, 50)} (${t.id})`,
      value: `tpl_edit:${t.id}`,
    }));
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("tempvc_panel:tpl_select_to_edit")
        .setPlaceholder("Choose a template to edit or remove...")
        .addOptions(options),
    );
    rows.push(row2);
  }

  return rows;
}

function buildTemplateConfigEmbed(client, template, isNew = false) {
  const status = isNew
    ? "🆕 Creating new template"
    : "✏️ Editing template settings";

  return Embeds.brand(client, {
    title: "📋 Template Configuration",
    description: status,
    fields: [
      { name: "Template ID", value: `\`${template.id}\``, inline: true },
      { name: "Display Name", value: template.name, inline: true },
      {
        name: "Channel Name",
        value: `\`${template.channelName}\``,
        inline: false,
      },
      {
        name: "Name Pattern",
        value: template.namePattern
          ? `\`${template.namePattern}\``
          : "— (none)",
        inline: false,
      },
      {
        name: "User Limit",
        value: template.limit ? `${template.limit} users` : "Unlimited",
        inline: true,
      },
      {
        name: "Default Locked",
        value: template.isLocked ? "Yes" : "No",
        inline: true,
      },
      {
        name: "Default Hidden",
        value: template.isHidden ? "Yes" : "No",
        inline: true,
      },
    ],
  });
}

function buildTemplateConfigComponents(template, isNew = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_set_name_btn")
      .setLabel("Set Name")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_set_channel_name_btn")
      .setLabel("Set Channel Name")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_set_pattern_btn")
      .setLabel("Set Name Pattern")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_set_limit_btn")
      .setLabel("Set User Limit")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_toggle_locked_btn")
      .setLabel(template.isLocked ? "🔒 Locked: YES" : "🔓 Locked: NO")
      .setStyle(
        template.isLocked ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_toggle_hidden_btn")
      .setLabel(template.isHidden ? "🙈 Hidden: YES" : "👁️ Hidden: NO")
      .setStyle(
        template.isHidden ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_save")
      .setLabel("✅ Save Template")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_cancel")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  if (!isNew) {
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId("tempvc_panel:tpl_delete_btn")
        .setLabel("🗑️ Delete")
        .setStyle(ButtonStyle.Danger),
    );
  }

  return [row1, row2, row3];
}

module.exports = {
  buildTemplatesListEmbed,
  buildTemplatesListComponents,
  buildTemplateConfigEmbed,
  buildTemplateConfigComponents,
};
