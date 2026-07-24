const { replyError, replySuccess } = require("../../lib/interactions");
const youtubeStorage = require("../../persistence/youtubeStorage");
const Logger = require("../../lib/logger");
const {
  buildYtListEmbed,
  buildYtListRows,
} = require("../../integrations/youtube/panelBuilder");
const actions = require("../../integrations/youtube/panelActions");

const logger = new Logger("YOUTUBE");

const pendingConfigs = new Map();
const searchQueries = new Map();

function cleanPending(key) {
  const p = pendingConfigs.get(key);
  if (p && Date.now() > p.expiresAt) pendingConfigs.delete(key);
}

async function execute(interaction, client) {
  try {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to use this panel.",
      );
    }

    const [, action, ...rest] = interaction.customId.split(":");
    const key = `${interaction.user.id}:${interaction.guildId}`;
    cleanPending(key);

    switch (action) {
      case "add":
        return actions.handleAdd(interaction, client);
      case "add_modal":
        return actions.handleAddModal(interaction, client);
      case "set_channel":
        return actions.handleSetChannel(interaction, client);
      case "channel_select":
        return actions.handleChannelSelect(interaction, client);
      case "toggle_types":
        return actions.handleToggleTypes(interaction, client);
      case "notify_select":
        return actions.handleNotifySelect(interaction, client);
      case "custom_msg":
        return actions.handleCustomMsg(interaction, client);
      case "custom_msg_modal":
        return actions.handleCustomMsgModal(interaction, client);
      case "clear_msg":
        return actions.handleClearMsg(interaction, client);
      case "save":
        return actions.handleSave(interaction, client);
      case "cancel":
        return actions.handleCancel(interaction, client);
      case "select_action":
        return actions.handleSelectAction(interaction, client);
      case "remove_confirm":
        return actions.handleRemoveConfirm(interaction, client);
      case "page":
        return actions.handlePage(
          interaction,
          client,
          parseInt(rest[0] ?? "0", 10),
        );
      case "refresh":
        return actions.handleRefresh(interaction, client);
      case "search_start": {
        const {
          ModalBuilder,
          TextInputBuilder,
          ActionRowBuilder,
          TextInputStyle,
        } = require("discord.js");
        const modal = new ModalBuilder()
          .setCustomId("youtube_panel:search_modal")
          .setTitle("Search YouTube Subscriptions");
        const input = new TextInputBuilder()
          .setCustomId("search_query")
          .setLabel("Channel name or keyword")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Lofi Girl")
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
      }
      case "search_clear": {
        const key = `${interaction.user.id}:${interaction.guildId}`;
        searchQueries.delete(key);
        return actions.handleRefresh(interaction, client);
      }
      case "search_modal": {
        await interaction.deferReply({ ephemeral: true });
        const key = `${interaction.user.id}:${interaction.guildId}`;
        const query = interaction.fields
          .getTextInputValue("search_query")
          .trim()
          .toLowerCase();
        if (query) {
          searchQueries.set(key, query);
        } else {
          searchQueries.delete(key);
        }
        const subs = await youtubeStorage.listSubscriptions(
          interaction.guildId,
        );
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
        await replySuccess(
          interaction,
          `Search query updated to "**${query}**".`,
        );
        try {
          await interaction.message?.edit({
            embeds: [embed],
            components: rows,
          });
        } catch {}
        return;
      }
    }
  } catch (err) {
    logger.error(`Error in youtube_panel: ${err.message}`);
  }
}

module.exports = {
  customId: "youtube_panel",
  pendingConfigs,
  searchQueries,
  execute,
};
