const Logger = require("../../lib/logger");

const logger = new Logger("BUTTON");

module.exports = async (client, interaction) => {
  try {
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

    const PREFIXED_HANDLERS = [
      "fxs",
      "fixembed_delete",
      "alarm",
      "tvc",
      "youtube_panel",
      "tiktok_panel",
      "fixembed_panel",
      "help_category",
    ];
    let button = client.buttons.get(interaction.customId);

    if (!button) {
      const colonPrefix = interaction.customId.split(":")[0];
      if (PREFIXED_HANDLERS.includes(colonPrefix)) {
        button = client.buttons.get(colonPrefix);
      }
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
      const isShowModalButton =
        interaction.customId === "alarm_new" ||
        interaction.customId.startsWith("alarm_edit_modal:") ||
        interaction.customId === "youtube_panel:add" ||
        interaction.customId === "tiktok_panel:add" ||
        interaction.customId === "youtube_panel:custom_msg" ||
        interaction.customId === "tiktok_panel:custom_msg" ||
        interaction.customId === "youtube_panel:search_start" ||
        interaction.customId === "tiktok_panel:search_start" ||
        interaction.customId === "fixembed_panel:add_domain_btn" ||
        interaction.customId === "fixembed_panel:add_keyword_btn";
      // tvc owns its own defer lifecycle (mix of modal-open / toggle / select).
      const isTvc = prefix === "tvc";
      const skipDefer = isShowModalButton || isModalSubmit || isTvc;
      const useDeferUpdate =
        prefix === "fxs" ||
        interaction.customId.startsWith("alarm_") ||
        prefix === "help_category" ||
        (prefix === "youtube_panel" &&
          interaction.customId !== "youtube_panel:add" &&
          interaction.customId !== "youtube_panel:custom_msg" &&
          interaction.customId !== "youtube_panel:search_start") ||
        (prefix === "tiktok_panel" &&
          interaction.customId !== "tiktok_panel:add" &&
          interaction.customId !== "tiktok_panel:custom_msg" &&
          interaction.customId !== "tiktok_panel:search_start") ||
        (prefix === "fixembed_panel" &&
          interaction.customId !== "fixembed_panel:add_domain_btn" &&
          interaction.customId !== "fixembed_panel:add_keyword_btn");

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
    logger.error(`Unexpected error in buttonInteraction: ${error.message}`);
  }
};
