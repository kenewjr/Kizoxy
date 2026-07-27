const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError, replySuccess } = require("../../../lib/interactions");

async function handlePatternBtn(ctx) {
  return ctx.interaction.showModal(
    ctx.buildModal(
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
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleLimitBtn(ctx) {
  return ctx.interaction.showModal(
    ctx.buildModal(
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
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleToggleLocked(ctx) {
  ctx.pending.data.isLocked = !ctx.pending.data.isLocked;
  await ctx.interaction.deferUpdate();
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
}

async function handleToggleHidden(ctx) {
  ctx.pending.data.isHidden = !ctx.pending.data.isHidden;
  await ctx.interaction.deferUpdate();
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
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
  return ctx.updateList(interaction, client);
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
  return ctx.updateList(ctx.interaction, ctx.client);
}

module.exports = {
  handlePatternBtn,
  handlePatternModal,
  handleLimitBtn,
  handleLimitModal,
  handleToggleLocked,
  handleToggleHidden,
  handleSave,
  handleDeleteBtn,
  handleDeleteConfirm,
};
