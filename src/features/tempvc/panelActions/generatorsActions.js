const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError, replySuccess } = require("../../../lib/interactions");
const {
  buildGeneratorsListEmbed,
  buildGeneratorsListComponents,
  buildGeneratorConfigEmbed,
  buildGeneratorConfigComponents,
} = require("../panelBuilders/generatorsBuilder");

const REGIONS = [
  { label: "Automatic (recommended)", value: "auto" },
  { label: "Brazil", value: "brazil" },
  { label: "Hong Kong", value: "hongkong" },
  { label: "India", value: "india" },
  { label: "Japan", value: "japan" },
  { label: "Rotterdam", value: "rotterdam" },
  { label: "Russia", value: "russia" },
  { label: "Singapore", value: "singapore" },
  { label: "South Africa", value: "southafrica" },
  { label: "Sydney", value: "sydney" },
  { label: "US Central", value: "us-central" },
  { label: "US East", value: "us-east" },
  { label: "US South", value: "us-south" },
  { label: "US West", value: "us-west" },
];

async function updateList(interaction, client) {
  const generators = await tempVcStorage.getAllGenerators(interaction.guildId);
  const embed = await buildGeneratorsListEmbed(client, interaction.guildId);
  const components = buildGeneratorsListComponents(generators);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

async function showConfig(interaction, client, pending) {
  const isNew = pending.mode === "add";
  const embed = buildGeneratorConfigEmbed(client, pending.data, isNew);
  const components = buildGeneratorConfigComponents(pending.data, isNew);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

// ── Action handlers (each extracted to keep cyclomatic complexity low) ──

async function handleList(ctx) {
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
}

async function handleAddFlow(ctx) {
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("tempvc_panel:gen_select_channel")
      .setPlaceholder("Select a voice channel to register...")
      .addChannelTypes(ChannelType.GuildVoice),
  );
  return ctx.interaction.reply({
    content: "Select the voice channel that will act as the TempVC generator:",
    components: [row],
    ephemeral: true,
  });
}

async function handleSelectChannel(ctx) {
  const { interaction, pendingConfigs, key, client } = ctx;
  const channelId = interaction.values[0];
  const channel = await interaction.guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    return replyError(
      interaction,
      "Set up a temporary voice channel generator.",
    );
  }
  if (
    (await tempVcStorage.getTempChannel(interaction.guildId, channelId)) ||
    (await tempVcStorage.getGenerator(interaction.guildId, channelId))
  ) {
    return replyError(interaction, "Channel in use or already registered.");
  }
  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const existing = await tempVcStorage.getAllGenerators(interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxGenerators) {
    return replyError(
      interaction,
      `Limit reached: max ${settings.maxGenerators} generators.`,
    );
  }
  pendingConfigs.set(key, {
    screen: "generator_config",
    mode: "add",
    editId: channelId,
    data: {
      id: channelId,
      categoryId: channel.parentId ?? null,
      defaultName: "{username}'s Channel",
      defaultLimit: 0,
      defaultBitrate: channel.bitrate || 64000,
      bitrate: channel.bitrate ? Math.round(channel.bitrate / 1000) : 64,
      rtcRegion: null,
      templateId: null,
      createdAt: Date.now(),
    },
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  await interaction.reply({
    content: "Generator channel validated.",
    ephemeral: true,
  });
  return showConfig(interaction, client, pendingConfigs.get(key));
}

async function handleEdit(ctx) {
  const { interaction, pendingConfigs, key, client, action, rest } = ctx;
  const channelId =
    action === "gen_edit" ? rest[0] : interaction.values[0].split(":")[1];
  const existing = await tempVcStorage.getGenerator(
    interaction.guildId,
    channelId,
  );
  if (!existing)
    return replyError(interaction, "Generator channel settings not found.");
  pendingConfigs.set(key, {
    screen: "generator_config",
    mode: "edit",
    editId: channelId,
    data: { ...existing },
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return showConfig(interaction, client, pendingConfigs.get(key));
}

function showModal(interaction, customId, title, fieldId, label, value) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId(fieldId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setValue(String(value))
    .setRequired(true)
    .setMaxLength(100);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function handleCategoryBtn(ctx) {
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("tempvc_panel:gen_select_category")
      .setPlaceholder("Select category channel (or None)...")
      .addChannelTypes(ChannelType.GuildCategory),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_select_category:none")
      .setLabel("Clear/No Category")
      .setStyle(ButtonStyle.Danger),
  );
  return ctx.interaction.reply({
    content: "Select the category where temporary channels should be created:",
    components: [row, row2],
    ephemeral: true,
  });
}

async function handleSelectCategory(ctx) {
  ctx.pending.data.categoryId =
    ctx.rest[0] === "none" ? null : ctx.interaction.values?.[0] || null;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleNameBtn(ctx) {
  return showModal(
    ctx.interaction,
    "tempvc_panel:gen_set_name_modal",
    "Default Channel Name",
    "default_name",
    "Channel Name Pattern",
    ctx.pending.data.defaultName,
  );
}
async function handleNameModal(ctx) {
  ctx.pending.data.defaultName = ctx.interaction.fields
    .getTextInputValue("default_name")
    .trim();
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleLimitBtn(ctx) {
  return showModal(
    ctx.interaction,
    "tempvc_panel:gen_set_limit_modal",
    "Default User Limit",
    "user_limit",
    "Limit (0 to 99, 0 = unlimited)",
    ctx.pending.data.defaultLimit,
  );
}
async function handleLimitModal(ctx) {
  const limit = parseInt(
    ctx.interaction.fields.getTextInputValue("user_limit").trim(),
    10,
  );
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
    return replyError(
      ctx.interaction,
      "Limit must be an integer between 0 and 99.",
    );
  }
  ctx.pending.data.defaultLimit = limit;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleBitrateBtn(ctx) {
  return showModal(
    ctx.interaction,
    "tempvc_panel:gen_set_bitrate_modal",
    "Default Bitrate (kbps)",
    "bitrate",
    "Bitrate (8 to 384)",
    ctx.pending.data.bitrate,
  );
}
async function handleBitrateModal(ctx) {
  const bitrate = parseInt(
    ctx.interaction.fields.getTextInputValue("bitrate").trim(),
    10,
  );
  if (!Number.isInteger(bitrate) || bitrate < 8 || bitrate > 384) {
    return replyError(
      ctx.interaction,
      "Bitrate must be between 8 and 384 kbps.",
    );
  }
  ctx.pending.data.bitrate = bitrate;
  ctx.pending.data.defaultBitrate = bitrate * 1000;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleRegionBtn(ctx) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("tempvc_panel:gen_select_region")
      .setPlaceholder("Select voice region...")
      .addOptions(REGIONS.slice(0, 25)),
  );
  return ctx.interaction.reply({
    content: "Select the Discord RTC region:",
    components: [row],
    ephemeral: true,
  });
}
async function handleSelectRegion(ctx) {
  ctx.pending.data.rtcRegion =
    ctx.interaction.values[0] === "auto" ? null : ctx.interaction.values[0];
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleTemplateBtn(ctx) {
  const templates = await tempVcStorage.getAllTemplates(
    ctx.interaction.guildId,
  );
  const options = [{ label: "No Template (use default)", value: "none" }];
  templates.forEach((t) =>
    options.push({ label: `${t.name} (${t.id})`, value: t.id }),
  );
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("tempvc_panel:gen_select_template")
      .setPlaceholder("Select template...")
      .addOptions(options.slice(0, 25)),
  );
  return ctx.interaction.reply({
    content: "Select the templates to inherit permissions from:",
    components: [row],
    ephemeral: true,
  });
}
async function handleSelectTemplate(ctx) {
  ctx.pending.data.templateId =
    ctx.interaction.values[0] === "none" ? null : ctx.interaction.values[0];
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleSave(ctx) {
  const { interaction, pendingConfigs, key, client, pending } = ctx;
  if (pending.mode === "add") {
    await tempVcStorage.addGenerator(interaction.guildId, pending.data);
    await replySuccess(interaction, "Successfully added new voice generator.");
  } else {
    await tempVcStorage.updateGenerator(
      interaction.guildId,
      pending.editId,
      pending.data,
    );
    await replySuccess(
      interaction,
      "Successfully updated voice generator settings.",
    );
  }
  pendingConfigs.delete(key);
  return updateList(interaction, client);
}

async function handleDeleteBtn(ctx) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_delete_confirm")
      .setLabel("Yes, Delete")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:gen_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  return ctx.interaction.reply({
    content: `Are you sure you want to delete the generator <#${ctx.pending.editId}>?`,
    components: [row],
    ephemeral: true,
  });
}
async function handleDeleteConfirm(ctx) {
  await tempVcStorage.removeGenerator(
    ctx.interaction.guildId,
    ctx.pending.editId,
  );
  await replySuccess(ctx.interaction, "Successfully removed voice generator.");
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
}

// ── Action map ──
const PRE_SESSION = {
  generators: handleList,
  gen_cancel: handleList,
  gen_add_flow: handleAddFlow,
  gen_select_channel: handleSelectChannel,
  gen_edit: handleEdit,
  gen_select_to_edit: handleEdit,
};

const SESSION_ACTIONS = {
  gen_set_category_btn: handleCategoryBtn,
  gen_select_category: handleSelectCategory,
  gen_set_name_btn: handleNameBtn,
  gen_set_name_modal: handleNameModal,
  gen_set_limit_btn: handleLimitBtn,
  gen_set_limit_modal: handleLimitModal,
  gen_set_bitrate_btn: handleBitrateBtn,
  gen_set_bitrate_modal: handleBitrateModal,
  gen_set_region_btn: handleRegionBtn,
  gen_select_region: handleSelectRegion,
  gen_set_template_btn: handleTemplateBtn,
  gen_select_template: handleSelectTemplate,
  gen_save: handleSave,
  gen_delete_btn: handleDeleteBtn,
  gen_delete_confirm: handleDeleteConfirm,
};

async function execute(interaction, client, pendingConfigs, action, rest) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = pendingConfigs.get(key);
  const ctx = {
    interaction,
    client,
    pendingConfigs,
    key,
    pending,
    action,
    rest,
  };

  const preFn = PRE_SESSION[action];
  if (preFn) return preFn(ctx);

  if (!pending || pending.screen !== "generator_config") {
    return replyError(
      interaction,
      "Your session has expired. Please run `/tempvc` again.",
    );
  }

  const fn = SESSION_ACTIONS[action];
  if (fn) return fn(ctx);
}

module.exports = { execute };
