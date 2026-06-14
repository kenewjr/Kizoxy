const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const limit = interaction.options.getInteger("number");
    if (limit === null || limit === undefined) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Missing value",
            "Provide a user limit (0–99, 0 = unlimited).",
          ),
        ],
      });
    }
    await ctx.channel.setUserLimit(
      limit,
      `TempVC limit by ${interaction.user.id}`,
    );
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      limit,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [
        ok(
          client,
          "Limit updated",
          limit === 0
            ? "Channel is now unlimited."
            : `User limit set to **${limit}**.`,
        ),
      ],
    });
  },
};
