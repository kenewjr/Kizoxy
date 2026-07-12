const tempVcService = require("../../../../features/tempvc/tempVcService");
const {
  errEmbed,
  okEmbed,
  safeReplyEphemeral,
  refreshPanel,
} = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  const { tempRecord, channel } = ctx;
  const userId = interaction.user.id;

  const voiceChanId = interaction.member?.voice?.channelId;
  if (voiceChanId !== channel.id) {
    return safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(client, "You must be inside this voice channel to claim it."),
      ],
    });
  }

  if (tempRecord.ownerId === userId) {
    return safeReplyEphemeral(interaction, {
      embeds: [errEmbed(client, "You already own this channel.")],
    });
  }

  const ownerInChannel = channel.members?.has(tempRecord.ownerId);
  if (ownerInChannel) {
    return safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          client,
          `The current owner (<@${tempRecord.ownerId}>) is still in the channel.`,
        ),
      ],
    });
  }

  await tempVcService.transferOwnership(
    interaction.guildId,
    channel.id,
    userId,
  );
  await channel.permissionOverwrites
    .edit(userId, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});

  await refreshPanel(interaction.guild, channel.id);
  return safeReplyEphemeral(interaction, {
    embeds: [
      okEmbed(client, "You are now the owner of this channel.", "Claimed"),
    ],
  });
};
