const tempVcStorage = require("../../../../persistence/tempVcStorage");
const { okEmbed, ensureDeferred, refreshPanel } = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  await ensureDeferred(interaction, "update");
  const { channel } = ctx;

  const banOverwrites = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 1 && ow.deny.has("Connect"),
  );

  for (const ow of banOverwrites.values()) {
    await ow.delete("TempVC unbanAll").catch(() => {});
  }

  await tempVcStorage.updateTempChannel(interaction.guildId, channel.id, {
    bannedUsers: [],
  });

  await refreshPanel(interaction.guild, channel.id);
  await interaction
    .followUp({
      embeds: [okEmbed(client, "All user bans removed.", "Unbanned All")],
      ephemeral: true,
    })
    .catch(() => {});
};
