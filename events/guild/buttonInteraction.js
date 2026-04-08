const { InteractionType } = require("discord.js");
const Logger = require("../../utils/logger");

// Initialize logger
const logger = new Logger("BUTTON");

module.exports = async (client, interaction) => {
  try {
    // Accept buttons and ALL select menu types (string, channel, user, role)
    const isButton = interaction.isButton?.();
    const isSelect =
      interaction.isStringSelectMenu?.() ||
      interaction.isChannelSelectMenu?.() ||
      interaction.isUserSelectMenu?.()    ||
      interaction.isRoleSelectMenu?.();
    if (!isButton && !isSelect) return;

    logger.debug(
      `Received button interaction: ${interaction.customId} by ${interaction.user.tag}`,
    );

    // Ignore buttons that are handled by specific command collectors
    if (
      interaction.customId === "refresh_alarms" ||
      interaction.customId === "cancel_alarms"
    ) {
      logger.debug(
        `Ignoring collector-handled button: ${interaction.customId}`,
      );
      return;
    }

    // Dalam buttonInteraction.js, tambahkan ignore untuk button admin
    if (
      interaction.customId === "refresh_admin_alarms" ||
      interaction.customId === "cancel_admin_alarms"
    ) {
      logger.debug(`Ignoring admin button: ${interaction.customId}`);
      return;
    }

    // Get the button handler — support dynamic prefixed IDs (e.g. fxs:*, fixembed_delete:*)
    const PREFIXED_HANDLERS = ["fxs", "fixembed_delete"];
    let button = client.buttons.get(interaction.customId);

    if (!button) {
      // Try prefix-based lookup
      const prefix = interaction.customId.split(":")[0];
      if (PREFIXED_HANDLERS.includes(prefix)) {
        button = client.buttons.get(prefix);
      }
    }

    if (!button) {
      logger.debug(
        `Unknown button ID: ${interaction.customId} (likely handled by collector)`,
      );
      return;
    }

    logger.debug(`Found handler for: ${interaction.customId}`);

    try {
      const prefix = interaction.customId.split(":")[0];
      // fxs: update the existing settings message in-place
      // everything else (including fixembed_delete) gets its own ephemeral reply
      const useDeferUpdate = prefix === "fxs";

      if (useDeferUpdate) {
        logger.debug(`Deferring update (in-place) for: ${interaction.customId}`);
        await interaction.deferUpdate();
      } else {
        logger.debug(`Deferring new ephemeral reply for: ${interaction.customId}`);
        await interaction.deferReply({ ephemeral: true });
      }

      logger.info(`Executing handler for: ${interaction.customId}`);
      await button.execute(interaction, client);
      logger.success(`Successfully processed: ${interaction.customId}`);
    } catch (error) {
      logger.error(
        `Error in button interaction ${interaction.customId}: ${error.message}`,
      );

      if (!error.message.includes("already been acknowledged")) {
        logger.error(error.stack);
      }

      try {
        await interaction.followUp({
          content: "❌ Gagal memproses aksi button. Mohon coba lagi.",
          ephemeral: true,
        });
      } catch (followUpError) {
        logger.error(
          `Failed to send follow-up error message: ${followUpError.message}`,
        );
      }
    }
  } catch (error) {
    // Catch any unexpected errors in the main function
    console.error("Unexpected error in buttonInteraction:", error);
  }
};
