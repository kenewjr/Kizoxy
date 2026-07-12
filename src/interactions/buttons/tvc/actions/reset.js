const helper = require("../../../../features/tempvc/tempVcHelper");
const tempVcStorage = require("../../../../persistence/tempVcStorage");
const tempVcService = require("../../../../features/tempvc/tempVcService");
const { okEmbed, ensureDeferred, refreshPanel, logger } = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  await ensureDeferred(interaction, "update");
  const { tempRecord, channel } = ctx;

  const generator = tempRecord.generatorId
    ? await tempVcStorage.getGenerator(
        interaction.guildId,
        tempRecord.generatorId,
      )
    : null;

  const defaultName = generator?.defaultName ?? "{username}'s Channel";
  const defaultLimit = generator?.defaultLimit ?? 0;
  const renderedName = tempVcService.renderChannelName(
    defaultName,
    interaction.member,
    1,
  );

  await channel
    .edit({ name: renderedName, userLimit: defaultLimit })
    .catch((err) =>
      logger.warning(`reset channel edit failed ${channel.id}: ${err.message}`),
    );

  const userOverwrites = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 1,
  );
  for (const ow of userOverwrites.values()) {
    await ow.delete("TempVC reset").catch(() => {});
  }

  await helper.applyLockState(interaction.guild, channel, false);
  await helper.applyHideState(interaction.guild, channel, false);

  await channel.permissionOverwrites
    .edit(interaction.user.id, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});

  await tempVcStorage.updateTempChannel(interaction.guildId, channel.id, {
    name: renderedName,
    limit: defaultLimit,
    isLocked: false,
    isHidden: false,
    allowedUsers: [],
    bannedUsers: [],
  });

  await refreshPanel(interaction.guild, channel.id);
  await interaction
    .followUp({
      embeds: [okEmbed(client, "Channel reset to defaults.", "Reset")],
      ephemeral: true,
    })
    .catch(() => {});
};
