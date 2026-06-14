const tempVcService = require("../tempVcService");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const { ok, bad, refreshPanel } = require("./_shared");

module.exports = {
  run: async (client, interaction, ctx) => {
    const raw = interaction.options.getString("name");
    if (!raw) {
      return interaction.editReply({
        embeds: [bad(client, "Missing name", "Provide a new channel name.")],
      });
    }
    const cleaned = tempVcService.renderChannelName(raw, interaction.member, 0);
    if (!cleaned || cleaned.length === 0) {
      return interaction.editReply({
        embeds: [
          bad(
            client,
            "Invalid name",
            "Name cannot be empty after sanitisation.",
          ),
        ],
      });
    }
    await ctx.channel.setName(
      cleaned,
      `TempVC rename by ${interaction.user.id}`,
    );
    await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
      name: cleaned,
    });
    await refreshPanel(interaction.guild, ctx.channel.id);
    return interaction.editReply({
      embeds: [ok(client, "Renamed", `Channel is now **${cleaned}**.`)],
    });
  },
};
