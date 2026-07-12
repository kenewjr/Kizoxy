const tempVcService = require("../../../../features/tempvc/tempVcService");
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
    modalId: `tvc:rename-modal:${channelId}`,
    label: "Channel Name",
    customId: "newName",
    placeholder: "Enter new channel name...",
    max: 100,
  });
  await interaction.showModal(modal);
}

async function handleModal(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("newName");
  const cleaned = tempVcService.renderChannelName(raw, interaction.member, 0);
  if (!cleaned) {
    return interaction.editReply({
      embeds: [
        errEmbed(interaction.client, "Name was empty after sanitisation."),
      ],
    });
  }
  await ctx.channel.setName(
    cleaned,
    `TempVC rename via panel by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    name: cleaned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(interaction.client, `Channel is now **${cleaned}**.`, "Renamed"),
    ],
  });
}

module.exports = {
  showModal,
  handleModal,
};
