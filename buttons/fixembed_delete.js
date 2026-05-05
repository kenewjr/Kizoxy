/**
 * fixembed_delete.js
 * Allows only the original message author (OP) to delete the bot's fixed-link reply.
 * customId format: fixembed_delete:<originalAuthorId>
 *
 * Uses deferReply(ephemeral) so any response is ONLY visible to the clicker —
 * the original bot message is never touched unless the OP explicitly deletes it.
 */

module.exports = {
  customId: "fixembed_delete",
  execute: async (interaction, client) => {
    const originalAuthorId = interaction.customId.split(":")[1];

    // Non-OP: show a silent ephemeral error — original message is untouched
    if (interaction.user.id !== originalAuthorId) {
      return interaction.editReply({
        content: "❌ Only the original message author can delete this.",
      });
    }

    // OP: delete the bot's message, then clean up the ephemeral reply
    try {
      await interaction.message.delete();
      // Delete the ephemeral "thinking" reply so nothing lingers
      await interaction.deleteReply().catch(() => {});
    } catch (err) {
      return interaction.editReply({
        content:
          "❌ Failed to delete — I may be missing `Manage Messages` permission.",
      });
    }
  },
};
