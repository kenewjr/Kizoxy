const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError } = require("../../../lib/interactions");
const {
  buildGeneratorsListEmbed,
  buildGeneratorsListComponents,
  buildGeneratorConfigEmbed,
  buildGeneratorConfigComponents,
} = require("../panelBuilders/generatorsBuilder");
const {
  handleBitrateBtn,
  handleBitrateModal,
  handleRegionBtn,
  handleSelectRegion,
  handleTemplateBtn,
  handleSelectTemplate,
  handleSave,
  handleDeleteBtn,
  handleDeleteConfirm,
} = require("./generatorsActionsMore");

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
    updateList,
    showConfig,
    showModal,
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
