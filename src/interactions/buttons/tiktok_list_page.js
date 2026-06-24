const {
  LIST_PAGE_SIZE,
  totalPages,
  clampPage,
  buildPaginationRow,
} = require("../../features/alarm/alarmFormatter");
const tiktokStorage = require("../../persistence/tiktokStorage");
const { buildListEmbed } = require("../../commands/slash/tiktok/list");
const Logger = require("../../lib/logger");

const logger = new Logger("TIKTOK");

// CustomId format: tiktok_list_page:<action>:<currentPage>
module.exports = {
  customId: "tiktok_list_page",
  execute: async (interaction, client) => {
    try {
      const [, action, rawPage] = interaction.customId.split(":");
      const current = parseInt(rawPage, 10) || 0;

      const subscriptions = await tiktokStorage.listSubscriptions(
        interaction.guild.id,
      );
      const total = totalPages(subscriptions, LIST_PAGE_SIZE);

      let page = current;
      if (action === "first") page = 0;
      else if (action === "prev") page = current - 1;
      else if (action === "next") page = current + 1;
      else if (action === "last") page = total - 1;
      page = clampPage(page, total);

      const embed = buildListEmbed(client, subscriptions, page);
      const components =
        total > 1 ? [buildPaginationRow("tiktok_list_page", page, total)] : [];

      await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
      logger.error(`tiktok_list_page handler failed: ${err.message}`);
    }
  },
};
