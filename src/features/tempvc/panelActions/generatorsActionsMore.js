const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { replyError, replySuccess } = require("../../../lib/interactions");

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

async function handleBitrateBtn(ctx) {
  return ctx.showModal(
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
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
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
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
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
  return ctx.showConfig(ctx.interaction, ctx.client, ctx.pending);
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
  return ctx.updateList(interaction, client);
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
  return ctx.updateList(ctx.interaction, ctx.client);
}

module.exports = {
  handleBitrateBtn,
  handleBitrateModal,
  handleRegionBtn,
  handleSelectRegion,
  handleTemplateBtn,
  handleSelectTemplate,
  handleSave,
  handleDeleteBtn,
  handleDeleteConfirm,
};
