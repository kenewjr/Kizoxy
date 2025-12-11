const { InteractionType } = require("discord.js");
const Logger = require("../../utils/logger");

// Initialize logger
const logger = new Logger("BUTTON");

module.exports = async (client, interaction) => {
  try {
    // Check if this is a button interaction
    if (!interaction.isButton()) {
      return;
    }

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

    // Get the button handler
    const button = client.buttons.get(interaction.customId);

    if (!button) {
      logger.debug(
        `Unknown button ID: ${interaction.customId} (likely handled by collector)`,
      );
      return;
    }

    logger.debug(`Found handler for: ${interaction.customId}`);

    try {
      logger.debug(`Attempting to defer reply for: ${interaction.customId}`);
      await interaction.deferReply({ ephemeral: true });

      logger.debug(
        `Deferred status - Replied: ${interaction.replied}, Deferred: ${interaction.deferred}`,
      );

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
