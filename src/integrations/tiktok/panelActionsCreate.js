const {
  replyError,
  replySuccess,
  safeReply,
} = require("../../lib/interactions");
const tiktokStorage = require("../../persistence/tiktokStorage");
const {
  buildTtListEmbed,
  buildTtListRows,
  buildTtConfigEmbed,
  buildTtConfigRows,
} = require("./panelBuilder");

// Lazily retrieved to avoid circular require issues
function getPanel() {
  return require("../../interactions/buttons/tiktok_panel");
}

async function handleAdd(interaction) {
  const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
  } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId("tiktok_panel:add_modal")
    .setTitle("Add TikTok Subscription");
  const input = new TextInputBuilder()
    .setCustomId("tiktok_url")
    .setLabel("TikTok Profile URL or @username")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. @therock or https://www.tiktok.com/@therock")
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleAddModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const input = interaction.fields.getTextInputValue("tiktok_url");
  const tiktokResolver = require("./resolver");
  let resolved;
  try {
    resolved = await tiktokResolver.resolve(input);
  } catch (e) {
    return replyError(
      interaction,
      `Could not resolve that TikTok account.\n${e.message}`,
    );
  }
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.set(key, {
    username: resolved.username,
    profileUrl: resolved.profileUrl,
    announceChannelId: null,
    notifyVideos: true,
    notifyLive: true,
    customMessage: null,
    editSubId: null,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const pending = getPanel().pendingConfigs.get(key);
  const embed = buildTtConfigEmbed(client, pending, false);
  const rows = buildTtConfigRows(pending);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleSetChannel(interaction) {
  const {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
  } = require("discord.js");
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("tiktok_panel:channel_select")
      .setPlaceholder("Choose announcement channel...")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  );
  await interaction.reply({
    content: "Select the announcement channel:",
    components: [row],
    ephemeral: true,
  });
}

async function handleChannelSelect(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return interaction.followUp({
      content: "Session expired. Please start over.",
      ephemeral: true,
    });
  pending.announceChannelId = interaction.values[0];
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildTtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildTtConfigRows(pending);
  await safeReply(interaction, {
    content: null,
    embeds: [embed],
    components: rows,
  });
}

async function handleToggleTypes(interaction) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return interaction.followUp({
      content: "Session expired.",
      ephemeral: true,
    });
  const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("tiktok_panel:notify_select")
      .setPlaceholder("Select notification types...")
      .setMinValues(0)
      .setMaxValues(2)
      .addOptions([
        { label: "🎥 Videos", value: "videos", default: pending.notifyVideos },
        { label: "🔴 Live", value: "live", default: pending.notifyLive },
      ]),
  );
  await interaction.followUp({
    content:
      "Select which notification types to enable (you can select multiple or none):",
    components: [row],
    ephemeral: true,
  });
}

async function handleNotifySelect(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return safeReply(interaction, {
      content: "Session expired.",
      components: [],
    });
  pending.notifyVideos = interaction.values.includes("videos");
  pending.notifyLive = interaction.values.includes("live");
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildTtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildTtConfigRows(pending);
  await safeReply(interaction, {
    content: null,
    embeds: [embed],
    components: rows,
  });
}

async function handleCustomMsg(interaction) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return interaction.followUp({
      content: "Session expired.",
      ephemeral: true,
    });
  const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
  } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId("tiktok_panel:custom_msg_modal")
    .setTitle("Custom Notification Message");
  const input = new TextInputBuilder()
    .setCustomId("custom_message")
    .setLabel("Message template (leave blank for default)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(pending.customMessage ?? "")
    .setPlaceholder("Available: {title} {url} {channelName} {type}")
    .setRequired(false)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleCustomMsgModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return replyError(interaction, "Session expired. Please start over.");
  const msg = interaction.fields.getTextInputValue("custom_message").trim();
  pending.customMessage = msg || null;
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildTtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildTtConfigRows(pending);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleClearMsg(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return interaction.reply({ content: "Session expired.", ephemeral: true });
  pending.customMessage = null;
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildTtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildTtConfigRows(pending);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleSave(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return replyError(
      interaction,
      "Session expired. Please start over by running /tiktok again.",
    );
  if (!pending.announceChannelId)
    return replyError(interaction, "Please set an announcement channel first.");

  const sub = {
    username: pending.username,
    profileUrl: pending.profileUrl,
    discordChannelId: pending.announceChannelId,
    notifyVideos: pending.notifyVideos,
    notifyLive: pending.notifyLive,
    customMessage: pending.customMessage,
  };

  try {
    if (pending.editSubId) {
      await tiktokStorage.updateSubscription(
        interaction.guildId,
        pending.editSubId,
        sub,
      );
    } else {
      await tiktokStorage.addSubscription(interaction.guildId, sub);
    }
    getPanel().pendingConfigs.delete(key);
  } catch (e) {
    return replyError(interaction, `Failed to save: ${e.message}`);
  }

  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildTtListEmbed(client, subs, 0, totalPages);
  const rows = buildTtListRows(subs, 0, totalPages, 5);

  const action = pending.editSubId ? "updated" : "added";
  await replySuccess(
    interaction,
    `Subscription **@${pending.username}** ${action} successfully.`,
  );
  try {
    await interaction.message?.edit({ embeds: [embed], components: rows });
  } catch {}
}

async function handleCancel(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.delete(key);
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildTtListEmbed(client, subs, 0, totalPages);
  const rows = buildTtListRows(subs, 0, totalPages, 5);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

module.exports = {
  handleAdd,
  handleAddModal,
  handleSetChannel,
  handleChannelSelect,
  handleToggleTypes,
  handleNotifySelect,
  handleCustomMsg,
  handleCustomMsgModal,
  handleClearMsg,
  handleSave,
  handleCancel,
};
