module.exports = {
  customId: "fixembed_delete",
  execute: async (interaction, _client) => {
    const originalAuthorId = interaction.customId.split(":")[1];
    if (interaction.user.id !== originalAuthorId) {
      return interaction.editReply({
        content: "❌ Only the original message author can delete this.",
      });
    }

    try {
      await interaction.message.delete();
      await interaction.deleteReply().catch(() => { });
    } catch (_err) {
      return interaction.editReply({
        content:
          "❌ Failed to delete — I may be missing `Manage Messages` permission.",
      });
    }
  },
};
