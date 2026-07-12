const tempVcStorage = require("../../../../persistence/tempVcStorage");
const {
  errEmbed,
  okEmbed,
  ensureDeferred,
  refreshPanel,
  buildTextModal,
} = require("../_shared");

async function showModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:limit-modal:${channelId}`,
    label: "User Limit (0 = unlimited)",
    customId: "limitValue",
    placeholder: "0-99",
    max: 2,
  });
  await interaction.showModal(modal);
}

async function handleModal(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("limitValue").trim();
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    return interaction.editReply({
      embeds: [
        errEmbed(
          interaction.client,
          "Limit must be an integer between 0 and 99.",
        ),
      ],
    });
  }
  await ctx.channel.setUserLimit(
    n,
    `TempVC limit via panel by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    limit: n,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(
        interaction.client,
        n === 0 ? "Channel is now unlimited." : `Limit set to ${n}.`,
        "Limit updated",
      ),
    ],
  });
}

module.exports = {
  showModal,
  handleModal,
};
