const helper = require("../tempVcHelper");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const user = interaction.options.getUser("user");
    if (!user) {
      return interaction.editReply({
        embeds: [bad(client, "Missing user", "Mention a user to ban.")],
      });
    }
    if (user.id === interaction.user.id) {
      return interaction.editReply({
        embeds: [bad(client, "Cannot ban", "You can't ban yourself.")],
      });
    }
    await helper.applyBanUser(interaction.guild, ctx.channel, user.id);
    const banned = Array.from(
      new Set([...(ctx.tempRecord.bannedUsers || []), user.id]),
    );
    const allowed = (ctx.tempRecord.allowedUsers || []).filter(
      (id) => id !== user.id,
    );
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      bannedUsers: banned,
      allowedUsers: allowed,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [
        ok(client, "Banned", `${user} can no longer join this channel.`),
      ],
    });
  },
};
