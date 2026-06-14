const tempVcService = require("../tempVcService");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const user = interaction.options.getUser("user");
    if (!user) {
      return interaction.editReply({
        embeds: [bad(client, "Missing user", "Mention the new owner.")],
      });
    }
    if (user.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [
          bad(client, "Cannot transfer", "You already own this channel."),
        ],
      });
    }
    if (user.bot) {
      return interaction.editReply({
        embeds: [bad(client, "Cannot transfer", "Bots cannot own a TempVC.")],
      });
    }
    const target = interaction.guild.members.cache.get(user.id);
    if (!target || target.voice?.channelId !== ctx.channel.id) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Not in channel",
            `${user} is not in this channel; transfer is only allowed to current members.`,
          ),
        ],
      });
    }
    const updated = await tempVcService.transferOwnership(
      interaction.guildId,
      ctx.channel.id,
      user.id,
    );
    if (!updated) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Transfer failed",
            "Storage refused the update; please try again.",
          ),
        ],
      });
    }
    await ctx.channel.permissionOverwrites
      .edit(user.id, {
        Connect: true,
        Speak: true,
        ManageChannels: true,
        MoveMembers: true,
      })
      .catch(() => {});
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [
        ok(client, "Ownership transferred", `${user} is now the owner.`),
      ],
    });
  },
};
