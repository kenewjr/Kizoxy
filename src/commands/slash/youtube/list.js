const { PermissionsBitField } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const {
  LIST_PAGE_SIZE,
  buildPaginationRow,
  totalPages,
} = require("../../../features/alarm/alarmFormatter");
const Embeds = require("../../../lib/embeds");
const youtubeStorage = require("../../../persistence/youtubeStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("YOUTUBE");

function subscriptionField(sub) {
  const toggles = [
    sub.notifyVideos ? "Videos ✅" : "Videos ❌",
    sub.notifyShorts ? "Shorts ✅" : "Shorts ❌",
    sub.notifyLive ? "Live ✅" : "Live ❌",
  ].join(" • ");
  const mention = sub.mentionRoleId ? `<@&${sub.mentionRoleId}>` : "None";
  return {
    name: sub.youtubeChannelTitle || sub.youtubeChannelId,
    value: `Announce: <#${sub.announceChannelId}>\n${toggles}\nMention: ${mention}`,
  };
}

function buildListEmbed(client, subscriptions, page) {
  const total = totalPages(subscriptions, LIST_PAGE_SIZE);
  const start = page * LIST_PAGE_SIZE;
  const slice = subscriptions.slice(start, start + LIST_PAGE_SIZE);
  return Embeds.brand(client, {
    title: "YouTube Subscriptions",
    description: subscriptions.length
      ? `This server follows **${subscriptions.length}** channel(s).`
      : "No YouTube subscriptions yet. Use `/youtube add` to create one.",
    fields: slice.map(subscriptionField),
    footerText: total > 1 ? `Page ${page + 1} / ${total}` : undefined,
  });
}

module.exports = {
  name: ["youtube", "list"],
  description: "List this server's YouTube subscriptions.",
  category: "YouTube",
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
      const subscriptions = await youtubeStorage.listSubscriptions(
        interaction.guild.id,
      );
      const page = 0;
      const embed = buildListEmbed(client, subscriptions, page);
      const total = totalPages(subscriptions, LIST_PAGE_SIZE);
      const components =
        total > 1 ? [buildPaginationRow("youtube_list_page", page, total)] : [];

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
