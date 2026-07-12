const tempVcService = require("../../../../features/tempvc/tempVcService");
const Embeds = require("../../../../lib/embeds");
const {
  errEmbed,
  okEmbed,
  ensureDeferred,
  safeReplyEphemeral,
  buildMemberSelect,
  refreshPanel,
} = require("../_shared");

async function showSelect(interaction, ctx) {
  const customId = `tvc:transfer-select:${ctx.channel.id}`;
  const row = buildMemberSelect(ctx.channel, customId, "Pick the new owner");
  if (!row) {
    return safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "No eligible members are currently in this channel.",
        ),
      ],
    });
  }
  await safeReplyEphemeral(interaction, {
    embeds: [
      Embeds.info(interaction.client, {
        title: "Transfer ownership",
        description: "Pick a member from the list below.",
      }),
    ],
    components: [row],
  });
}

async function handleSelect(interaction, ctx) {
  await ensureDeferred(interaction, "update");
  const userId = interaction.values[0];
  if (userId === interaction.user.id) {
    return interaction.followUp({
      embeds: [errEmbed(interaction.client, "You already own this channel.")],
      ephemeral: true,
    });
  }
  const member = interaction.guild.members.cache.get(userId);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return interaction.followUp({
      embeds: [
        errEmbed(
          interaction.client,
          "That member is no longer in the channel.",
        ),
      ],
      ephemeral: true,
    });
  }
  const updated = await tempVcService.transferOwnership(
    interaction.guildId,
    ctx.channel.id,
    userId,
  );
  if (!updated) {
    return interaction.followUp({
      embeds: [
        errEmbed(
          interaction.client,
          "Storage refused the transfer; please try again.",
        ),
      ],
      ephemeral: true,
    });
  }
  await ctx.channel.permissionOverwrites
    .edit(userId, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});
  await refreshPanel(interaction.guild, ctx.channel.id);
  await interaction.followUp({
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> is now the owner.`,
        "Ownership transferred",
      ),
    ],
    ephemeral: true,
  });
}

module.exports = {
  showSelect,
  handleSelect,
};
