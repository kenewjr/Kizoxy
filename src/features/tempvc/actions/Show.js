const helper = require("../tempVcHelper");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    await helper.applyHideState(interaction.guild, ctx.channel, false);
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      isHidden: false,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [ok(client, "Visible", "Channel visible to everyone.")],
    });
  },
};
