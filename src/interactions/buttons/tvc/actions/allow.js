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
    modalId: `tvc:allow-modal:${channelId}`,
    label: "Allow user",
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
  await helper.applyAllowUser(ctx.channel, userId);
  const allowed = Array.from(
    new Set([...(ctx.tempRecord.allowedUsers || []), userId]),
  );
  const banned = (ctx.tempRecord.bannedUsers || []).filter(
    (id) => id !== userId,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    allowedUsers: allowed,
    bannedUsers: banned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(interaction.client, `<@${userId}> can now join.`, "Allowed"),
    ],
  });
}

module.exports = {
  showModal,
  handleModal,
};
