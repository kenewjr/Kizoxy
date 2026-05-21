const { ActionRowBuilder, ButtonBuilder } = require("discord.js");

async function disableButtonsAfterDelay(message) {
  if (!message) return;
  setTimeout(async () => {
    try {
      const row = message.components[0];
      if (!row) return;
      const disabledButtons = row.components.map((button) =>
        ButtonBuilder.from(button).setDisabled(true),
      );

      const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);

      await message.edit({ components: [disabledRow] });
    } catch (err) {
      console.error("[buttonHelper] Failed to disable buttons:", err.message);
    }
  }, 5000);
}

module.exports = {
  disableButtonsAfterDelay,
};
