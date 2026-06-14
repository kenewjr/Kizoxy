const helper = require("../tempVcHelper");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const user = interaction.options.getUser("user");
    if (!user) {
      return interaction.editReply({
        embeds: [bad(client, "Missing user", "Mention a user to allow.")],
      });
    }
    await helper.applyAllowUser(ctx.channel, user.id);
    const allowed = Array.from(
      new Set([...(ctx.tempRecord.allowedUsers || []), user.id]),
    );
    const banned = (ctx.tempRecord.bannedUsers || []).filter(
      (id) => id !== user.id,
    );
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      allowedUsers: allowed,
      bannedUsers: banned,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [
        ok(client, "Access granted", `${user} can now join even when locked.`),
      ],
    });
  },
};
