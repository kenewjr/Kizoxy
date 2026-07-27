const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError } = require("../../../lib/interactions");
const {
  buildTemplatesListEmbed,
  buildTemplatesListComponents,
  buildTemplateConfigEmbed,
  buildTemplateConfigComponents,
} = require("../panelBuilders/templatesBuilder");
const {
  handlePatternBtn,
  handlePatternModal,
  handleLimitBtn,
  handleLimitModal,
  handleToggleLocked,
  handleToggleHidden,
  handleSave,
  handleDeleteBtn,
  handleDeleteConfirm,
} = require("./templatesActionsMore");

async function updateList(interaction, client) {
  const templates = await tempVcStorage.getAllTemplates(interaction.guildId);
  const embed = await buildTemplatesListEmbed(client, interaction.guildId);
  const components = buildTemplatesListComponents(templates);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

async function showConfig(interaction, client, pending) {
  const isNew = pending.mode === "add";
  const embed = buildTemplateConfigEmbed(client, pending.data, isNew);
  const components = buildTemplateConfigComponents(pending.data, isNew);
  const pay = { embeds: [embed], components, ephemeral: false };
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(pay);
  return interaction.reply(pay);
}

function buildModal(customId, title, fieldId, label, value, opts = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId(fieldId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setValue(String(value ?? ""))
    .setRequired(opts.required !== false)
    .setMaxLength(opts.maxLen || 100);
  if (opts.placeholder) input.setPlaceholder(opts.placeholder);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ── Action handlers ──

async function handleList(ctx) {
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
}

async function handleAddFlow(ctx) {
  const settings = await tempVcStorage.getSettings(ctx.interaction.guildId);
  const existing = await tempVcStorage.getAllTemplates(ctx.interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxTemplates) {
    return replyError(
      ctx.interaction,
      `Limit reached: max ${settings.maxTemplates} templates.`,
    );
  }
  return ctx.interaction.showModal(
    buildModal(
      "tempvc_panel:tpl_add_modal",
      "Create New Template",
      "template_name",
      "Template Name",
      "",
      { placeholder: "e.g. Default Permissions Template", maxLen: 64 },
    ),
  );
}

async function handleAddModal(ctx) {
  const name = ctx.interaction.fields.getTextInputValue("template_name").trim();
  ctx.pendingConfigs.set(ctx.key, {
    screen: "template_config",
    mode: "add",
    editId: null,
    data: {
      name,
      channelName: "{username}'s Channel",
      namePattern: null,
      limit: 0,
      bitrate: 64000,
      isLocked: false,
      isHidden: false,
      createdBy: ctx.interaction.user.id,
      createdAt: Date.now(),
    },
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  await ctx.interaction.reply({
    content: "Template initialized.",
    ephemeral: true,
  });
  return showConfig(
    ctx.interaction,
    ctx.client,
    ctx.pendingConfigs.get(ctx.key),
  );
}

async function handleEdit(ctx) {
  const templateId =
    ctx.action === "tpl_edit"
      ? ctx.rest[0]
      : ctx.interaction.values[0].split(":")[1];
  const existing = await tempVcStorage.getTemplate(
    ctx.interaction.guildId,
    templateId,
  );
  if (!existing)
    return replyError(ctx.interaction, "Template settings not found.");
  ctx.pendingConfigs.set(ctx.key, {
    screen: "template_config",
    mode: "edit",
    editId: templateId,
    data: { ...existing },
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return showConfig(
    ctx.interaction,
    ctx.client,
    ctx.pendingConfigs.get(ctx.key),
  );
}

async function handleNameBtn(ctx) {
  return ctx.interaction.showModal(
    buildModal(
      "tempvc_panel:tpl_set_name_modal",
      "Template Name",
      "name",
      "Display Name",
      ctx.pending.data.name,
      { maxLen: 64 },
    ),
  );
}
async function handleNameModal(ctx) {
  ctx.pending.data.name = ctx.interaction.fields
    .getTextInputValue("name")
    .trim();
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleChannelNameBtn(ctx) {
  return ctx.interaction.showModal(
    buildModal(
      "tempvc_panel:tpl_set_channel_name_modal",
      "Channel Name Pattern",
      "channel_name",
      "Default Channel Name Template",
      ctx.pending.data.channelName,
    ),
  );
}
async function handleChannelNameModal(ctx) {
  ctx.pending.data.channelName = ctx.interaction.fields
    .getTextInputValue("channel_name")
    .trim();
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

// ── Action map ──
const PRE_SESSION = {
  templates: handleList,
  tpl_cancel: handleList,
  tpl_add_flow: handleAddFlow,
  tpl_add_modal: handleAddModal,
  tpl_edit: handleEdit,
  tpl_select_to_edit: handleEdit,
};

const SESSION_ACTIONS = {
  tpl_set_name_btn: handleNameBtn,
  tpl_set_name_modal: handleNameModal,
  tpl_set_channel_name_btn: handleChannelNameBtn,
  tpl_set_channel_name_modal: handleChannelNameModal,
  tpl_set_pattern_btn: handlePatternBtn,
  tpl_set_pattern_modal: handlePatternModal,
  tpl_set_limit_btn: handleLimitBtn,
  tpl_set_limit_modal: handleLimitModal,
  tpl_toggle_locked_btn: handleToggleLocked,
  tpl_toggle_hidden_btn: handleToggleHidden,
  tpl_save: handleSave,
  tpl_delete_btn: handleDeleteBtn,
  tpl_delete_confirm: handleDeleteConfirm,
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
    buildModal,
  };

  const preFn = PRE_SESSION[action];
  if (preFn) return preFn(ctx);

  if (!pending || pending.screen !== "template_config") {
    return replyError(
      interaction,
      "Your session has expired. Please run `/tempvc` again.",
    );
  }

  const fn = SESSION_ACTIONS[action];
  if (fn) return fn(ctx);
}

module.exports = { execute };
