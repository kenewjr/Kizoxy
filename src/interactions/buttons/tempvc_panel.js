const { replyError } = require("../../lib/interactions");
const Logger = require("../../lib/logger");
const {
  buildMainMenuEmbed,
  buildMainMenuComponents,
} = require("../../features/tempvc/panelBuilders/mainMenuBuilder");

const logger = new Logger("TEMP_VC_PANEL");
const pendingConfigs = new Map();

function cleanPending(key) {
  const p = pendingConfigs.get(key);
  if (p && Date.now() > p.expiresAt) pendingConfigs.delete(key);
}

async function showMainMenu(interaction, client) {
  const embed = await buildMainMenuEmbed(client, interaction.guildId);
  const rows = await buildMainMenuComponents(client, interaction.guildId);
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: rows });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: rows,
      ephemeral: false,
    });
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
    const key = `${interaction.user.id}:${interaction.guildId}`;
    cleanPending(key);

    if (action === "main" || action === "cancel") {
      pendingConfigs.delete(key);
      return showMainMenu(interaction, client);
    }

    if (action === "generators" || action.startsWith("gen_")) {
      const generatorsActions = require("../../features/tempvc/panelActions/generatorsActions");
      return generatorsActions.execute(
        interaction,
        client,
        pendingConfigs,
        action,
        rest,
      );
    }

    if (action === "templates" || action.startsWith("tpl_")) {
      const templatesActions = require("../../features/tempvc/panelActions/templatesActions");
      return templatesActions.execute(
        interaction,
        client,
        pendingConfigs,
        action,
        rest,
      );
    }

    if (action === "voice_roles" || action.startsWith("vr_")) {
      const voiceRolesActions = require("../../features/tempvc/panelActions/voiceRolesActions");
      return voiceRolesActions.execute(
        interaction,
        client,
        pendingConfigs,
        action,
        rest,
      );
    }

    return replyError(interaction, `Unknown action: ${action}`);
  } catch (err) {
    logger.error(`Error in tempvc_panel: ${err.message}`);
    if (!interaction.replied && !interaction.deferred) {
      await replyError(interaction, err);
    }
  }
}

module.exports = {
  customId: "tempvc_panel",
  pendingConfigs,
  showMainMenu,
  execute,
};
