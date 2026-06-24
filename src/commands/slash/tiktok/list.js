const { PermissionsBitField } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const {
  LIST_PAGE_SIZE,
  buildPaginationRow,
  totalPages,
} = require("../../../features/alarm/alarmFormatter");
const Embeds = require("../../../lib/embeds");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

function subscriptionField(sub) {
  const toggles = [
    sub.notifyVideos ? "Videos ✅" : "Videos ❌",
    sub.notifyLive ? "Live ✅" : "Live ❌",
  ].join(" • ");
  const mention = sub.mentionRoleId ? `<@&${sub.mentionRoleId}>` : "None";
  return {
    name: `@${sub.username}`,
    value: `Channel: <#${sub.discordChannelId}>\n${toggles}\nMention: ${mention}`,
  };
}

function buildListEmbed(client, subscriptions, page) {
  const total = totalPages(subscriptions, LIST_PAGE_SIZE);
  const start = page * LIST_PAGE_SIZE;
  const slice = subscriptions.slice(start, start + LIST_PAGE_SIZE);
  return Embeds.brand(client, {
    title: "TikTok Subscriptions",
    description: subscriptions.length
      ? `This server follows **${subscriptions.length}** account(s).`
      : "No TikTok subscriptions yet. Use `/tiktok add` to create one.",
    fields: slice.map(subscriptionField),
    footerText: total > 1 ? `Page ${page + 1} / ${total}` : undefined,
  });
}

module.exports = {
  name: ["tiktok", "list"],
  description: "List this server's TikTok subscriptions.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  buildListEmbed,
  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subscriptions = await tiktokStorage.listSubscriptions(
        interaction.guild.id,
      );
      const page = 0;
      const embed = buildListEmbed(client, subscriptions, page);
      const total = totalPages(subscriptions, LIST_PAGE_SIZE);
      const components =
        total > 1 ? [buildPaginationRow("tiktok_list_page", page, total)] : [];

      await interaction.editReply({ embeds: [embed], components });
    } catch (error) {
      logger.error(
        `Error listing subscriptions for guild ${interaction.guild.id}: ${error.message}`,
      );
      await interaction.editReply(
        "An error occurred while fetching the subscription list.",
      );
    }
  },
};
