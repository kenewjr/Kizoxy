const { replyError } = require("../../lib/interactions");
const Logger = require("../../lib/logger");
const actions = require("../../features/fixembed/fixembedPanelActions");

const logger = new Logger("FIXEMBED_PANEL");
const pendingStates = new Map();

async function showMain(interaction, client) {
  const stateObj = actions.getOrCreateState(
    pendingStates,
    interaction.user.id,
    interaction.guildId,
  );
  stateObj.page = "main";
  const {
    buildMainEmbed,
    buildMainComponents,
  } = require("../../features/fixembed/panelBuilders/mainBuilder");
  const embed = buildMainEmbed(client, interaction.guildId);
  const components = buildMainComponents(interaction.guildId);

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components });
  } else {
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
  }
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

    switch (action) {
      case "toggle_enabled":
        return actions.handleToggleEnabled(interaction, client, pendingStates);
      case "toggle_behavior":
        return actions.handleToggleBehavior(interaction, client, pendingStates);
      case "toggle_spoiler":
        return actions.handleToggleSpoiler(interaction, client, pendingStates);
      case "view_ignores":
        return actions.handleViewIgnores(interaction, client, pendingStates);
      case "select_ignore_list":
        return actions.handleSelectIgnoreList(
          interaction,
          client,
          pendingStates,
        );
      case "add_channel":
        return actions.handleAddChannel(interaction, client, pendingStates);
      case "add_user":
        return actions.handleAddUser(interaction, client, pendingStates);
      case "add_role":
        return actions.handleAddRole(interaction, client, pendingStates);
      case "remove_channel":
      case "remove_user":
      case "remove_role":
        return actions.handleRemoveChannelUserRole(
          interaction,
          client,
          pendingStates,
        );
      case "add_domain_btn":
        return actions.handleAddDomainKeywordBtn(interaction, client, "domain");
      case "add_keyword_btn":
        return actions.handleAddDomainKeywordBtn(
          interaction,
          client,
          "keyword",
        );
      case "add_domain_modal":
        return actions.handleAddDomainKeywordModal(
          interaction,
          client,
          "domain",
        );
      case "add_keyword_modal":
        return actions.handleAddDomainKeywordModal(
          interaction,
          client,
          "keyword",
        );
      case "remove_domain":
        return actions.handleRemoveDomainKeyword(
          interaction,
          client,
          pendingStates,
          "domain",
        );
      case "remove_keyword":
        return actions.handleRemoveDomainKeyword(
          interaction,
          client,
          pendingStates,
          "keyword",
        );
      case "view_platforms":
        return actions.handleViewPlatforms(interaction, client, pendingStates);
      case "select_platform_group":
        return actions.handleSelectPlatformGroup(
          interaction,
          client,
          pendingStates,
        );
      case "select_platform":
        return actions.handleSelectPlatform(interaction, client, pendingStates);
      case "toggle_platform":
        return actions.handleTogglePlatform(
          interaction,
          client,
          pendingStates,
          rest[0],
        );
      case "select_viewmode":
        return actions.handleSelectViewmode(
          interaction,
          client,
          pendingStates,
          rest[0],
        );
      case "back_to_ignores":
        return actions.handleBackToIgnores(interaction, client, pendingStates);
      case "back_to_platforms":
        return actions.handleBackToPlatforms(
          interaction,
          client,
          pendingStates,
        );
      case "back_to_group":
        return actions.handleBackToGroup(
          interaction,
          client,
          pendingStates,
          rest[0],
        );
      case "reset":
        return actions.handleReset(interaction, client, pendingStates);
    }
  } catch (err) {
    logger.error(`Error handling fixembed interaction: ${err.message}`);
  }
}

module.exports = {
  customId: "fixembed_panel",
  pendingStates,
  showMain,
  execute,
};
