const {
  replySuccess,
  replyError,
  safeReply,
} = require("../../lib/interactions");
const youtubeStorage = require("../../persistence/youtubeStorage");
const {
  buildYtListEmbed,
  buildYtListRows,
  buildYtConfigEmbed,
  buildYtConfigRows,
} = require("./panelBuilder");

// Lazily retrieved to avoid circular require issues
function getPanel() {
  return require("../../interactions/buttons/youtube_panel");
}

async function handleAdd(interaction) {
  const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
  } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId("youtube_panel:add_modal")
    .setTitle("Add YouTube Subscription");
  const input = new TextInputBuilder()
    .setCustomId("channel_input")
    .setLabel("YouTube Channel URL or @handle")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://www.youtube.com/@NinjaZombieCh or UC...")
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleAddModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const input = interaction.fields.getTextInputValue("channel_input");
  const channelResolver = require("./channelResolver");
  let resolved;
  try {
    resolved = await channelResolver.resolve(input);
  } catch (e) {
    return replyError(
      interaction,
      `Could not resolve that YouTube channel.\n${e.message}`,
    );
  }
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.set(key, {
    channelId: resolved.youtubeChannelId,
    channelName: resolved.youtubeChannelTitle ?? resolved.youtubeChannelId,
    announceChannelId: null,
    notifyVideos: true,
    notifyShorts: true,
    notifyLive: true,
    notifyUpcoming: true,
    customMessage: null,
    editSubId: null,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const pending = getPanel().pendingConfigs.get(key);
  const embed = buildYtConfigEmbed(client, pending, false);
  const rows = buildYtConfigRows(pending);
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
      .setCustomId("youtube_panel:channel_select")
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
    return interaction.reply({
      content: "Session expired. Please start over.",
      ephemeral: true,
    });
  pending.announceChannelId = interaction.values[0];
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildYtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildYtConfigRows(pending);
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
      .setCustomId("youtube_panel:notify_select")
      .setPlaceholder("Select notification types...")
      .setMinValues(0)
      .setMaxValues(4)
      .addOptions([
        { label: "📺 Videos", value: "videos", default: pending.notifyVideos },
        { label: "📱 Shorts", value: "shorts", default: pending.notifyShorts },
        { label: "🔴 Live", value: "live", default: pending.notifyLive },
        {
          label: "🗓️ Upcoming",
          value: "upcoming",
          default: pending.notifyUpcoming,
        },
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
  pending.notifyShorts = interaction.values.includes("shorts");
  pending.notifyLive = interaction.values.includes("live");
  pending.notifyUpcoming = interaction.values.includes("upcoming");
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildYtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildYtConfigRows(pending);
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
    .setCustomId("youtube_panel:custom_msg_modal")
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
  const embed = buildYtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildYtConfigRows(pending);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleClearMsg(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return interaction.reply({ content: "Session expired.", ephemeral: true });
  pending.customMessage = null;
  pending.expiresAt = Date.now() + 5 * 60 * 1000;
  const embed = buildYtConfigEmbed(client, pending, !!pending.editSubId);
  const rows = buildYtConfigRows(pending);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleSave(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const pending = getPanel().pendingConfigs.get(key);
  if (!pending)
    return replyError(
      interaction,
      "Session expired. Please start over by running /youtube again.",
    );
  if (!pending.announceChannelId)
    return replyError(interaction, "Please set an announcement channel first.");

  const sub = {
    youtubeChannelId: pending.channelId,
    youtubeChannelTitle: pending.channelName,
    youtubeChannelUrl: `https://www.youtube.com/channel/${pending.channelId}`,
    announceChannelId: pending.announceChannelId,
    notifyVideos: pending.notifyVideos,
    notifyShorts: pending.notifyShorts,
    notifyLive: pending.notifyLive,
    notifyUpcoming: pending.notifyUpcoming,
    customMessage: pending.customMessage,
  };

  try {
    if (pending.editSubId) {
      await youtubeStorage.updateSubscription(
        interaction.guildId,
        pending.editSubId,
        sub,
      );
    } else {
      await youtubeStorage.addSubscription(interaction.guildId, sub);
    }
    getPanel().pendingConfigs.delete(key);
  } catch (e) {
    return replyError(interaction, `Failed to save: ${e.message}`);
  }

  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildYtListEmbed(client, subs, 0, totalPages);
  const rows = buildYtListRows(subs, 0, totalPages, 5);

  const action = pending.editSubId ? "updated" : "added";
  await replySuccess(
    interaction,
    `Subscription **${pending.channelName}** ${action} successfully.`,
  );
  try {
    await interaction.message?.edit({ embeds: [embed], components: rows });
  } catch {}
}

async function handleCancel(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.delete(key);
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildYtListEmbed(client, subs, 0, totalPages);
  const rows = buildYtListRows(subs, 0, totalPages, 5);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleSelectAction(interaction, client) {
  const [actionType, subId] = interaction.values[0].split(":");
  if (actionType === "edit") return handleEditStart(interaction, client, subId);
  if (actionType === "remove")
    return handleRemoveStart(interaction, client, subId);
}

async function handleEditStart(interaction, client, subId) {
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const sub = subs.find((s) => (s.id ?? s.youtubeChannelId) === subId);
  if (!sub) return replyError(interaction, "Subscription not found.");
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.set(key, {
    channelId: sub.youtubeChannelId ?? sub.channel_id,
    channelName:
      sub.youtubeChannelTitle ?? sub.channel_name ?? sub.youtubeChannelId,
    announceChannelId: sub.announceChannelId ?? sub.announce_channel_id,
    notifyVideos: sub.notifyVideos ?? true,
    notifyShorts: sub.notifyShorts ?? true,
    notifyLive: sub.notifyLive ?? true,
    notifyUpcoming: sub.notifyUpcoming ?? true,
    customMessage: sub.customMessage ?? null,
    editSubId: subId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const pending = getPanel().pendingConfigs.get(key);
  const embed = buildYtConfigEmbed(client, pending, true);
  const rows = buildYtConfigRows(pending);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleRemoveStart(interaction, client, subId) {
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const sub = subs.find((s) => (s.id ?? s.youtubeChannelId) === subId);
  const name = sub?.youtubeChannelTitle ?? sub?.channel_name ?? subId;
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`youtube_panel:remove_confirm:${subId}`)
      .setLabel(`Remove ${name.slice(0, 50)}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("youtube_panel:refresh")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  await safeReply(interaction, {
    content: `⚠️ Remove subscription for **${name}**? This cannot be undone.`,
    components: [row],
  });
}

async function handleRemoveConfirm(interaction, client) {
  const subId = interaction.customId.split(":")[2];
  try {
    await youtubeStorage.removeSubscription(interaction.guildId, subId);
  } catch (e) {
    return replyError(interaction, `Failed to remove: ${e.message}`);
  }
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildYtListEmbed(client, subs, 0, totalPages);
  const rows = buildYtListRows(subs, 0, totalPages, 5);
  await interaction.editReply({
    content: "✅ Subscription removed successfully.",
    embeds: [embed],
    components: rows,
  });
}

async function handlePage(interaction, client, page) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const query = getPanel().searchQueries.get(key) || null;
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const filtered = query
    ? subs.filter((s) =>
        (
          s.channel_name ??
          s.youtubeChannelTitle ??
          s.channel_id ??
          s.youtubeChannelId ??
          ""
        )
          .toLowerCase()
          .includes(query),
      )
    : subs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const embed = buildYtListEmbed(client, filtered, page, totalPages, query);
  const rows = buildYtListRows(filtered, page, totalPages, 5, query);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleRefresh(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const query = getPanel().searchQueries.get(key) || null;
  const subs = await youtubeStorage.listSubscriptions(interaction.guildId);
  const filtered = query
    ? subs.filter((s) =>
        (
          s.channel_name ??
          s.youtubeChannelTitle ??
          s.channel_id ??
          s.youtubeChannelId ??
          ""
        )
          .toLowerCase()
          .includes(query),
      )
    : subs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const embed = buildYtListEmbed(client, filtered, 0, totalPages, query);
  const rows = buildYtListRows(filtered, 0, totalPages, 5, query);
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
  handleSelectAction,
  handleRemoveConfirm,
  handlePage,
  handleRefresh,
};
