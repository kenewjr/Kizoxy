const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");

async function buildGeneratorsListEmbed(client, guildId) {
  const generators = await tempVcStorage.getAllGenerators(guildId);
  const settings = await tempVcStorage.getSettings(guildId);

  let description =
    "Configure channels that automatically create a new TempVC when joined.\n\n";
  if (generators.length === 0) {
    description +=
      "*No generators configured. Click **Add Generator** below to get started.*";
  } else {
    description += generators
      .map((g, idx) => {
        const cat = g.categoryId ? `<#${g.categoryId}>` : "None";
        const tpl = g.templateId ? `\`${g.templateId}\`` : "None";
        return (
          `**${idx + 1}. <#${g.id}>**\n` +
          `• Name: \`${g.defaultName}\`\n` +
          `• Limit: \`${g.defaultLimit || "Unlimited"}\` • Bitrate: \`${g.bitrate} kbps\`\n` +
          `• Region: \`${g.rtcRegion || "Automatic"}\` • Category: ${cat}\n` +
          `• Template: ${tpl}`
        );
      })
      .join("\n\n");
  }

  return Embeds.brand(client, {
    title: `🎙️ Voice Generators (${generators.length}/${settings.maxGenerators})`,
    description,
    footerText: settings.isPremium ? "Premium tier" : "Free tier",
  });
}

function buildGeneratorsListComponents(generators) {
  const rows = [];

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_add_flow")
      .setLabel("➕ Add Generator")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:main")
      .setLabel("🔙 Main Menu")
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(row1);

  if (generators.length > 0) {
    const options = generators.slice(0, 25).map((g) => ({
      label: `Channel ID: ${g.id}`,
      value: `gen_edit:${g.id}`,
    }));
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("tempvc_panel:gen_select_to_edit")
        .setPlaceholder("Choose a generator to edit or remove...")
        .addOptions(options),
    );
    rows.push(row2);
  }

  return rows;
}

function buildGeneratorConfigEmbed(client, generator, isNew = false) {
  const cat = generator.categoryId ? `<#${generator.categoryId}>` : "—";
  const tpl = generator.templateId ? `\`${generator.templateId}\`` : "—";
  const status = isNew
    ? "🆕 Creating new generator"
    : "✏️ Editing generator settings";

  return Embeds.brand(client, {
    title: "🎙️ Generator Settings Configuration",
    description: status,
    fields: [
      { name: "Channel", value: `<#${generator.id}>`, inline: true },
      { name: "Spawn Category", value: cat, inline: true },
      {
        name: "Default Name",
        value: `\`${generator.defaultName}\``,
        inline: false,
      },
      {
        name: "Limit",
        value: generator.defaultLimit
          ? `${generator.defaultLimit} users`
          : "Unlimited",
        inline: true,
      },
      { name: "Bitrate", value: `${generator.bitrate} kbps`, inline: true },
      {
        name: "Voice Region",
        value: generator.rtcRegion || "Automatic (recommended)",
        inline: true,
      },
      { name: "Linked Template", value: tpl, inline: false },
    ],
  });
}

function buildGeneratorConfigComponents(generator, isNew = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_category_btn")
      .setLabel("Set Category")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_name_btn")
      .setLabel("Set Default Name")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_limit_btn")
      .setLabel("Set User Limit")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_bitrate_btn")
      .setLabel("Set Bitrate")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_region_btn")
      .setLabel("Set Voice Region")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_set_template_btn")
      .setLabel("Link Template")
      .setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_save")
      .setLabel("✅ Save Settings")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_cancel")
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  if (!isNew) {
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId("tempvc_panel:gen_delete_btn")
        .setLabel("🗑️ Delete")
        .setStyle(ButtonStyle.Danger),
    );
  }

  return [row1, row2, row3];
}

module.exports = {
  buildGeneratorsListEmbed,
  buildGeneratorsListComponents,
  buildGeneratorConfigEmbed,
  buildGeneratorConfigComponents,
};
