const helper = require("../../../../features/tempvc/tempVcHelper");
const tempVcStorage = require("../../../../persistence/tempVcStorage");
const { okEmbed, ensureDeferred, refreshPanel } = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  await ensureDeferred(interaction, "update");
  await helper.applyLockState(interaction.guild, ctx.channel, true);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    isLocked: true,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  await interaction
    .followUp({
      embeds: [okEmbed(client, "Channel locked.")],
      ephemeral: true,
    })
    .catch(() => {});
};
