const { replyError, safeReply } = require("../../lib/interactions");
const tiktokStorage = require("../../persistence/tiktokStorage");
const Logger = require("../../lib/logger");
const {
  buildTtListEmbed,
  buildTtListRows,
  buildTtConfigEmbed,
  buildTtConfigRows,
} = require("./panelBuilder");

const logger = new Logger("TIKTOK_MANAGE_ACTIONS");

function getPanel() {
  return require("../../interactions/buttons/tiktok_panel");
}

async function handleSelectAction(interaction, client) {
  const [actionType, subId] = interaction.values[0].split(":");
  if (actionType === "edit") return handleEditStart(interaction, client, subId);
  if (actionType === "remove")
    return handleRemoveStart(interaction, client, subId);
}

async function handleEditStart(interaction, client, subId) {
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const sub = subs.find((s) => (s.id ?? s.username) === subId);
  if (!sub) return replyError(interaction, "Subscription not found.");
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().pendingConfigs.set(key, {
    username: sub.username,
    profileUrl: sub.profileUrl,
    announceChannelId: sub.discordChannelId ?? sub.announce_channel_id,
    notifyVideos: sub.notifyVideos ?? true,
    notifyLive: sub.notifyLive ?? true,
    customMessage: sub.customMessage ?? null,
    editSubId: subId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const pending = getPanel().pendingConfigs.get(key);
  const embed = buildTtConfigEmbed(client, pending, true);
  const rows = buildTtConfigRows(pending);
  await interaction.editReply({ embeds: [embed], components: rows });
}

async function handleRemoveStart(interaction, client, subId) {
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const sub = subs.find((s) => (s.id ?? s.username) === subId);
  const name = sub?.username ?? subId;
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tiktok_panel:remove_confirm:${subId}`)
      .setLabel(`Remove @${name.slice(0, 50)}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("tiktok_panel:refresh")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  await safeReply(interaction, {
    content: `⚠️ Remove subscription for **@${name}**? This cannot be undone.`,
    components: [row],
  });
}

async function handleRemoveConfirm(interaction, client) {
  const subId = interaction.customId.split(":")[2];
  try {
    await tiktokStorage.removeSubscription(interaction.guildId, subId);
  } catch (e) {
    return replyError(interaction, `Failed to remove: ${e.message}`);
  }
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const totalPages = Math.max(1, Math.ceil(subs.length / 5));
  const embed = buildTtListEmbed(client, subs, 0, totalPages);
  const rows = buildTtListRows(subs, 0, totalPages, 5);
  await interaction.editReply({
    content: "✅ Subscription removed successfully.",
    embeds: [embed],
    components: rows,
  });
}

async function handlePage(interaction, client, page) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const query = getPanel().searchQueries.get(key) || null;
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const filtered = query
    ? subs.filter((s) =>
        (s.username ?? s.tiktokUserId ?? "").toLowerCase().includes(query),
      )
    : subs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const embed = buildTtListEmbed(client, filtered, page, totalPages, query);
  const rows = buildTtListRows(filtered, page, totalPages, 5, query);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleRefresh(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const query = getPanel().searchQueries.get(key) || null;
  const subs = await tiktokStorage.listSubscriptions(interaction.guild.id);
  const filtered = query
    ? subs.filter((s) =>
        (s.username ?? s.tiktokUserId ?? "").toLowerCase().includes(query),
      )
    : subs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const embed = buildTtListEmbed(client, filtered, 0, totalPages, query);
  const rows = buildTtListRows(filtered, 0, totalPages, 5, query);
  await safeReply(interaction, { embeds: [embed], components: rows });
}

async function handleStatus(interaction, client, subId) {
  const tiktokStateStorage = require("../../persistence/tiktokStateStorage");
  const Embeds = require("../../lib/embeds");

  try {
    const sub = await tiktokStorage.getSubscription(interaction.guildId, subId);
    if (!sub) {
      return interaction.followUp({
        content: "❌ Subscription not found.",
        ephemeral: true,
      });
    }

    const state = (await tiktokStateStorage.getState(sub.username)) || {};
    const lastChecked = state.lastCheckedAt
      ? `<t:${Math.floor(new Date(state.lastCheckedAt).getTime() / 1000)}:R>`
      : "Never";
    const health =
      state.consecutiveFailures > 0
        ? `⚠️ ${state.consecutiveFailures} consecutive failure(s) — account may be deleted/renamed or provider is down`
        : "✅ Healthy";

    const embed = Embeds.brand(client, {
      title: `TikTok Status — @${sub.username}`,
      url: sub.profileUrl,
      fields: [
        {
          name: "Channel",
          value: `<#${sub.discordChannelId}>`,
          inline: true,
        },
        {
          name: "Live now",
          value: state.isLive ? "🔴 Yes" : "No",
          inline: true,
        },
        { name: "Last checked", value: lastChecked, inline: true },
        {
          name: "Last video ID",
          value: state.lastVideoId || "—",
          inline: true,
        },
        {
          name: "Notify",
          value: `Videos ${sub.notifyVideos ? "✅" : "❌"} • Live ${sub.notifyLive ? "✅" : "❌"}`,
          inline: true,
        },
        { name: "Health", value: health, inline: false },
      ],
    });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error(`Error in handleStatus: ${error.message}`);
    await interaction.followUp({
      content: "❌ An error occurred while fetching the status.",
      ephemeral: true,
    });
  }
}

async function handleTest(interaction, client, subId) {
  const notifier = require("./notifier");

  try {
    const sub = await tiktokStorage.getSubscription(interaction.guildId, subId);
    if (!sub) {
      return interaction.followUp({
        content: "❌ Subscription not found.",
        ephemeral: true,
      });
    }

    const sampleVideo = {
      id: "0000000000000000000",
      url: sub.profileUrl,
      cover: null,
      title: "Sample notification — this is what a new video looks like.",
      createTime: Math.floor(Date.now() / 1000),
      isLive: false,
    };
    const embed = notifier.buildVideoEmbed(client, {
      username: sub.username,
      video: sampleVideo,
      avatar: null,
    });
    const row = notifier.buildLinkRow("Watch on TikTok", sampleVideo.url);

    const delivered = await notifier.send(client, sub, {
      embed,
      row,
      content: notifier.mentionContent(sub),
    });

    if (!delivered) {
      return interaction.followUp({
        content: `❌ Couldn't post to <#${sub.discordChannelId}>. Check the bot's permissions there.`,
        ephemeral: true,
      });
    }

    return interaction.followUp({
      content: `✅ Sent a test notification to <#${sub.discordChannelId}> for **@${sub.username}**.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error(`Error in handleTest: ${error.message}`);
    return interaction.followUp({
      content: "❌ An error occurred while sending the test notification.",
      ephemeral: true,
    });
  }
}

async function handleSearchStart(interaction) {
  const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
  } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId("tiktok_panel:search_modal")
    .setTitle("Search TikTok Subscriptions");
  const input = new TextInputBuilder()
    .setCustomId("search_query")
    .setLabel("Username or keyword")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. kenewjr")
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleSearchClear(interaction, client) {
  const key = `${interaction.user.id}:${interaction.guildId}`;
  getPanel().searchQueries.delete(key);
  return handleRefresh(interaction, client);
}

async function handleSearchModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  const key = `${interaction.user.id}:${interaction.guildId}`;
  const query = interaction.fields
    .getTextInputValue("search_query")
    .trim()
    .toLowerCase();
  if (query) {
    getPanel().searchQueries.set(key, query);
  } else {
    getPanel().searchQueries.delete(key);
  }
  const subs = await tiktokStorage.listSubscriptions(interaction.guildId);
  const filtered = query
    ? subs.filter((s) =>
        (s.username ?? s.tiktokUserId ?? "").toLowerCase().includes(query),
      )
    : subs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
  const embed = buildTtListEmbed(client, filtered, 0, totalPages, query);
  const rows = buildTtListRows(filtered, 0, totalPages, 5, query);
  const { replySuccess } = require("../../lib/interactions");
  await replySuccess(interaction, `Search query updated to "**${query}**".`);
  try {
    await interaction.message?.edit({
      embeds: [embed],
      components: rows,
    });
  } catch {}
}

module.exports = {
  handleSelectAction,
  handleEditStart,
  handleRemoveStart,
  handleRemoveConfirm,
  handlePage,
  handleRefresh,
  handleStatus,
  handleTest,
  handleSearchStart,
  handleSearchClear,
  handleSearchModal,
};
