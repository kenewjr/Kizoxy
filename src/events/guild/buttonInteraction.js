const Logger = require("../../lib/logger");

// Initialize logger
const logger = new Logger("BUTTON");

module.exports = async (client, interaction) => {
  try {
    // Accept buttons, ALL select menu types, and modal submissions.
    // Modal submissions are routed here from interactionCreate.js for
    // alarm_* customIds; without this gate they were silently dropped.
    const isButton = interaction.isButton?.();
    const isSelect =
      interaction.isStringSelectMenu?.() ||
      interaction.isChannelSelectMenu?.() ||
      interaction.isUserSelectMenu?.() ||
      interaction.isRoleSelectMenu?.();
    const isModalSubmit = interaction.isModalSubmit?.();
    if (!isButton && !isSelect && !isModalSubmit) return;

    logger.debug(
      `Received button interaction: ${interaction.customId} by ${interaction.user.tag}`,
    );

    // Ignore buttons that are handled by specific command collectors
    const COLLECTOR_BUTTONS = [
      "refresh_alarms",
      "cancel_alarms",
      "refresh_admin_alarms",
      "cancel_admin_alarms",
    ];
    if (COLLECTOR_BUTTONS.includes(interaction.customId)) {
      logger.debug(
        `Ignoring collector-handled button: ${interaction.customId}`,
      );
      return;
    }

    // Get the button handler — support dynamic prefixed IDs:
    //   - "fxs:..." (colon-separated prefix)
    //   - "fixembed_delete:..." (colon-separated prefix)
    //   - "alarm", "alarm_*", "alarm_*_page:*" (alarm prefix family)
    const PREFIXED_HANDLERS = ["fxs", "fixembed_delete", "alarm"];
    let button = client.buttons.get(interaction.customId);

    if (!button) {
      // First try colon-separated prefix lookup
      const colonPrefix = interaction.customId.split(":")[0];
      if (PREFIXED_HANDLERS.includes(colonPrefix)) {
        button = client.buttons.get(colonPrefix);
      }

      // Then try startsWith for alarm family (alarm_refresh, alarm_list_page:..., etc.)
      if (!button && interaction.customId.startsWith("alarm")) {
        button = client.buttons.get("alarm");
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

      // Buttons whose handler will call interaction.showModal() — must NOT
      // be deferred, otherwise showModal throws "already acknowledged".
      // Modal submissions also skip auto-defer because their handler calls
      // deferReply itself with the appropriate ephemeral flag.
      const isShowModalButton =
        interaction.customId === "alarm_new" ||
        interaction.customId.startsWith("alarm_edit_modal:");
      const skipDefer = isShowModalButton || isModalSubmit;

      // fxs + alarm: update the existing message in-place
      // everything else (including fixembed_delete) gets its own ephemeral reply
      const useDeferUpdate =
        prefix === "fxs" || interaction.customId.startsWith("alarm_");

      if (skipDefer) {
        logger.debug(`Skipping defer (modal) for: ${interaction.customId}`);
      } else if (useDeferUpdate) {
        logger.debug(
          `Deferring update (in-place) for: ${interaction.customId}`,
        );
        await interaction.deferUpdate();
      } else {
        logger.debug(
          `Deferring new ephemeral reply for: ${interaction.customId}`,
        );
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
          content: "❌ Failed to process the button action. Please try again.",
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
