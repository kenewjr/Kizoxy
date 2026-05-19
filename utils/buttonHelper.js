// utils/buttonHelper.js
// Helper to manage button behavior (disable after 5 seconds)

const { ActionRowBuilder, ButtonBuilder } = require("discord.js");

/**
 * Disable buttons in now playing message after 5 seconds
 * @param {Message} message - Discord message object (interaction.message)
 */
async function disableButtonsAfterDelay(message) {
  if (!message) return;

  // Wait 5 seconds
  setTimeout(async () => {
    try {
      // Get current components
      const row = message.components[0];
      if (!row) return;

      // Disable all buttons (grayed out, not removed)
      const disabledButtons = row.components.map((button) =>
        ButtonBuilder.from(button).setDisabled(true),
      );

      const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);

      // Update message with buttons disabled
      await message.edit({ components: [disabledRow] });
    } catch (err) {
      console.error("[buttonHelper] Failed to disable buttons:", err.message);
    }
  }, 5000);
}

module.exports = {
  disableButtonsAfterDelay,
};
