const Embeds = require("../../../../lib/embeds");
const {
  errEmbed,
  okEmbed,
  ensureDeferred,
  safeReplyEphemeral,
  buildMemberSelect,
} = require("../_shared");

async function showSelect(interaction, ctx) {
  const customId = `tvc:kick-select:${ctx.channel.id}`;
  const row = buildMemberSelect(ctx.channel, customId, "Pick a member to kick");
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
        title: "Kick a member",
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
      embeds: [errEmbed(interaction.client, "You can't kick yourself.")],
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
  await member.voice
    .disconnect(`TempVC kick via panel by ${interaction.user.id}`)
    .catch(() => {});
  await interaction.followUp({
    embeds: [
      okEmbed(interaction.client, `<@${userId}> was disconnected.`, "Kicked"),
    ],
    ephemeral: true,
  });
}

module.exports = {
  showSelect,
  handleSelect,
};
