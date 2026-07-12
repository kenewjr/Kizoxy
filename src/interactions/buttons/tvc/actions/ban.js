const tempVcStorage = require("../../../../persistence/tempVcStorage");
const helper = require("../../../../features/tempvc/tempVcHelper");
const {
  errEmbed,
  okEmbed,
  ensureDeferred,
  refreshPanel,
  buildTextModal,
  parseUserId,
} = require("../_shared");

async function showModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:ban-modal:${channelId}`,
    label: "Ban user",
    customId: "userIdOrMention",
    placeholder: "User ID or @mention",
    max: 100,
  });
  await interaction.showModal(modal);
}

async function handleModal(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("userIdOrMention");
  const userId = parseUserId(raw);
  if (!userId) {
    return interaction.editReply({
      embeds: [
        errEmbed(
          interaction.client,
          "Could not parse a user ID or mention from your input.",
        ),
      ],
    });
  }
  if (userId === interaction.user.id) {
    return interaction.editReply({
      embeds: [errEmbed(interaction.client, "You can't ban yourself.")],
    });
  }
  await helper.applyBanUser(interaction.guild, ctx.channel, userId);
  const banned = Array.from(
    new Set([...(ctx.tempRecord.bannedUsers || []), userId]),
  );
  const allowed = (ctx.tempRecord.allowedUsers || []).filter(
    (id) => id !== userId,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    bannedUsers: banned,
    allowedUsers: allowed,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> has been banned from this channel.`,
        "Banned",
      ),
    ],
  });
}

module.exports = {
  showModal,
  handleModal,
};
