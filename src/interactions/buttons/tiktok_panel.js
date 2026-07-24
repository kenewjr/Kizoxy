const { replyError } = require("../../lib/interactions");
const Logger = require("../../lib/logger");
const actions = require("../../integrations/tiktok/panelActions");

const logger = new Logger("TIKTOK");

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
      case "status":
        return actions.handleStatus(interaction, client, rest[0]);
      case "test":
        return actions.handleTest(interaction, client, rest[0]);
      case "search_start":
        return actions.handleSearchStart(interaction, client);
      case "search_clear":
        return actions.handleSearchClear(interaction, client);
      case "search_modal":
        return actions.handleSearchModal(interaction, client);
    }
  } catch (err) {
    logger.error(`Error in tiktok_panel: ${err.message}`);
  }
}

module.exports = {
  customId: "tiktok_panel",
  pendingConfigs,
  searchQueries,
  execute,
};
