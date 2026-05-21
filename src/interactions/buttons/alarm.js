const ACTIONS = require("../../features/alarm/alarmActions");
const Logger = require("../../lib/logger");
const logger = new Logger("ALARM-BTN");

const STATIC_ROUTES = {
  alarm_new: ACTIONS.handleNewModal,
  alarm_refresh: ACTIONS.handleRefresh,
  alarm_close: ACTIONS.handleClose,
  alarm_cancel_select: ACTIONS.handleOpenCancelPicker,
  alarm_cancel_do: ACTIONS.handleCancelDo,
  alarm_edit_select: ACTIONS.handleOpenEditPicker,
  alarm_edit_show: ACTIONS.handleShowDetail,
  alarm_toggle_select: ACTIONS.handleOpenTogglePicker,
  alarm_toggle_do: ACTIONS.handleToggleDo,
  alarm_new_submit: ACTIONS.handleNewSubmit,
};

const PREFIX_ROUTES = [
  ["alarm_edit_modal:", ACTIONS.handleEditModal],
  ["alarm_edit_submit:", ACTIONS.handleEditSubmit],
  ["alarm_recurring_change:", ACTIONS.handleRecurringChange],
  ["alarm_recurring_set:", ACTIONS.handleRecurringSet],
  ["alarm_detail_toggle:", ACTIONS.handleDetailToggle],
  ["alarm_detail_delete:", ACTIONS.handleDetailDelete],
  ["alarm_detail_channel:", ACTIONS.handleDetailChannel],
  ["alarm_detail_role:", ACTIONS.handleDetailRole],
];

function findPrefixHandler(customId) {
  for (const [prefix, handler] of PREFIX_ROUTES) {
    if (customId.startsWith(prefix)) return handler;
  }
  return null;
}

module.exports = {
  customId: "alarm",
  execute: async (interaction, client) => {
    const action = interaction.customId;
    const userId = interaction.user.id;
    const scheduler = client.alarmScheduler;
    const ctx = { interaction, client, scheduler, userId };

    try {
      if (await ACTIONS.handlePagination(ctx)) return;

      const handler =
        STATIC_ROUTES[action] || findPrefixHandler(action);

      if (!handler) {
        logger.debug(`Unhandled alarm customId: ${action}`);
        return;
      }

      await handler(ctx);
    } catch (error) {
      logger.error(`Alarm button error (${action}): ${error.message}`);
      try {
        await interaction.editReply({
          content: "❌ An error occurred. Please try again.",
          components: [],
        });
      } catch (_) {
        /* swallowed — interaction may already be closed */
      }
    }
  },
};
