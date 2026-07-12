const Embeds = require("../../../../lib/embeds");
const { okEmbed, ensureDeferred } = require("../_shared");

module.exports = async function handle(interaction, client, channelId, ctx) {
  await ensureDeferred(interaction, "update");
  const { channel } = ctx;
  const ownerId = ctx.tempRecord.ownerId;

  const nonOwnerMembers = channel.members.filter(
    (m) => !m.user.bot && m.id !== ownerId,
  );

  if (nonOwnerMembers.size === 0) {
    return interaction
      .followUp({
        embeds: [
          Embeds.info(client, {
            description: "No other members are in the channel.",
          }),
        ],
        ephemeral: true,
      })
      .catch(() => {});
  }

  const allMuted = nonOwnerMembers.every((m) => m.voice?.serverMute === true);
  const targetMute = !allMuted;

  for (const m of nonOwnerMembers.values()) {
    await m.voice
      .setMute(targetMute, `TempVC muteall by ${interaction.user.id}`)
      .catch(() => {});
  }

  await interaction
    .followUp({
      embeds: [
        okEmbed(
          client,
          targetMute ? "All members muted." : "All members unmuted.",
          targetMute ? "Muted" : "Unmuted",
        ),
      ],
      ephemeral: true,
    })
    .catch(() => {});
};
