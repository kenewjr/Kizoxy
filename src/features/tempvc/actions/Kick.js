const { ok, bad } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const user = interaction.options.getUser("user");
    if (!user) {
      return interaction.editReply({
        embeds: [bad(client, "Missing user", "Mention a user to kick.")],
      });
    }
    if (user.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [bad(client, "Cannot kick", "You can't kick yourself.")],
      });
    }
    const member = interaction.guild.members.cache.get(user.id);
    if (!member || member.voice?.channelId !== ctx.channel.id) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Not in channel",
            `${user} is not connected to this channel.`,
          ),
        ],
      });
    }
    await member.voice
      .disconnect(`TempVC kick by ${interaction.user.id}`)
      .catch(() => {});
    return interaction.editReply({
      embeds: [
        ok(
          client,
          "Kicked",
          `${user} was disconnected. They can rejoin unless banned.`,
        ),
      ],
    });
  },
};
