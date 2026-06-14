const tempVcService = require("../tempVcService");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const templateId = interaction.options.getString("template");
    if (!templateId) {
      return interaction.editReply({
        embeds: [bad(client, "Missing template", "Provide a template ID.")],
      });
    }
    const template = await tempVcStorage.getTemplate(
      interaction.guildId,
      templateId,
    );
    if (!template) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Template not found",
            `No template with id \`${templateId}\`.`,
          ),
        ],
      });
    }
    const applied = await tempVcService.applyTemplate(
      interaction.guild,
      ctx.channel,
      templateId,
      interaction.guildId,
    );
    if (!applied) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Apply failed",
            "Could not apply template; check bot permissions.",
          ),
        ],
      });
    }
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [
        ok(
          client,
          "Template applied",
          `**${applied.name}** is now active on this channel.`,
        ),
      ],
    });
  },
};
