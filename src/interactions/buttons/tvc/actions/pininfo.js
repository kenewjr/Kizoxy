const tempVcStorage = require("../../../../persistence/tempVcStorage");
const Embeds = require("../../../../lib/embeds");
const { okEmbed, safeReplyEphemeral, logger } = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  const { tempRecord, channel } = ctx;
  const guild = interaction.guild;

  const ownerMember = tempRecord.ownerId
    ? guild.members.cache.get(tempRecord.ownerId)
    : null;
  const avatarUrl = ownerMember?.displayAvatarURL() ?? null;

  const locked = Boolean(tempRecord.isLocked);
  const hidden = Boolean(tempRecord.isHidden);
  const limitDisplay =
    !tempRecord.limit || tempRecord.limit === 0
      ? "Unlimited"
      : String(tempRecord.limit);

  const infoEmbed = Embeds.info(client, {
    title: tempRecord.name || channel.name || "Channel Info",
    fields: [
      {
        name: "Owner",
        value: tempRecord.ownerId ? `<@${tempRecord.ownerId}>` : "—",
        inline: true,
      },
      { name: "Limit", value: limitDisplay, inline: true },
      { name: "Locked", value: locked ? "Yes" : "No", inline: true },
      { name: "Hidden", value: hidden ? "Yes" : "No", inline: true },
    ],
    thumbnailUrl: avatarUrl ?? undefined,
    footerText: "Channel Info",
  });

  let pinnedMsg = null;
  if (tempRecord.pinnedInfoMessageId) {
    pinnedMsg = await channel.messages
      .fetch(tempRecord.pinnedInfoMessageId)
      .catch(() => null);
  }

  if (pinnedMsg) {
    await pinnedMsg
      .edit({ embeds: [infoEmbed] })
      .catch((err) =>
        logger.warning(`pininfo edit failed for ${channel.id}: ${err.message}`),
      );
  } else {
    const newMsg = await channel.send({ embeds: [infoEmbed] }).catch((err) => {
      logger.warning(`pininfo send failed for ${channel.id}: ${err.message}`);
      return null;
    });
    if (newMsg) {
      await newMsg.pin("TempVC pinned info").catch(() => {});
      await tempVcStorage.updateTempChannel(interaction.guildId, channel.id, {
        pinnedInfoMessageId: newMsg.id,
      });
    }
  }

  await safeReplyEphemeral(interaction, {
    embeds: [okEmbed(client, "Channel info pinned.", "Pinned")],
  });
};
