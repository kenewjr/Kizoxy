const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError, replySuccess } = require("../../../lib/interactions");
const {
  buildTemplatesListEmbed,
  buildTemplatesListComponents,
  buildTemplateConfigEmbed,
  buildTemplateConfigComponents,
} = require("../panelBuilders/templatesBuilder");

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

async function handlePatternBtn(ctx) {
  return ctx.interaction.showModal(
    buildModal(
      "tempvc_panel:tpl_set_pattern_modal",
      "Name Template Pattern",
      "pattern",
      "Pattern (e.g. {owner}'s Room)",
      ctx.pending.data.namePattern || "",
      {
        required: false,
        placeholder: "tokens: {owner} · {game} · {number} · {guild}",
      },
    ),
  );
}
async function handlePatternModal(ctx) {
  const val = ctx.interaction.fields.getTextInputValue("pattern").trim();
  ctx.pending.data.namePattern = val || null;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleLimitBtn(ctx) {
  return ctx.interaction.showModal(
    buildModal(
      "tempvc_panel:tpl_set_limit_modal",
      "Default User Limit",
      "user_limit",
      "Limit (0 to 99, 0 = unlimited)",
      ctx.pending.data.limit,
    ),
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
  ctx.pending.data.limit = limit;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleToggleLocked(ctx) {
  ctx.pending.data.isLocked = !ctx.pending.data.isLocked;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleToggleHidden(ctx) {
  ctx.pending.data.isHidden = !ctx.pending.data.isHidden;
  await ctx.interaction.deferUpdate();
  return showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleSave(ctx) {
  const { interaction, pendingConfigs, key, client, pending } = ctx;
  if (pending.mode === "add") {
    await tempVcStorage.addTemplate(interaction.guildId, pending.data);
    await replySuccess(interaction, "Successfully added new voice template.");
  } else {
    await tempVcStorage.updateTemplate(
      interaction.guildId,
      pending.editId,
      pending.data,
    );
    await replySuccess(
      interaction,
      "Successfully updated voice template settings.",
    );
  }
  pendingConfigs.delete(key);
  return updateList(interaction, client);
}

async function handleDeleteBtn(ctx) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_delete_confirm")
      .setLabel("Yes, Delete")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("tempvc_panel:tpl_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  return ctx.interaction.reply({
    content: `Are you sure you want to delete template **${ctx.pending.data.name}** (\`${ctx.pending.editId}\`)?`,
    components: [row],
    ephemeral: true,
  });
}

async function handleDeleteConfirm(ctx) {
  await tempVcStorage.removeTemplate(
    ctx.interaction.guildId,
    ctx.pending.editId,
  );
  await replySuccess(ctx.interaction, "Successfully removed voice template.");
  ctx.pendingConfigs.delete(ctx.key);
  return updateList(ctx.interaction, ctx.client);
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
