const helper = require("../tempVcHelper");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    await helper.applyLockState(interaction.guild, ctx.channel, true);
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      isLocked: true,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [ok(client, "Locked", "Only allowed users can join.")],
    });
  },
};
