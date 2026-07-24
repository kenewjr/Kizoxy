const { PermissionsBitField } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

module.exports = {
  name: ["tiktok"],
  description: "Manage TikTok subscriptions.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "search",
      description: "Directly open a subscription to edit or remove.",
      type: 3, // String
      autocomplete: true,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    try {
      const subscriptions = await tiktokStorage.listSubscriptions(
        interaction.guild.id,
      );

      const searchSubId = interaction.options.getString("search");
      if (searchSubId) {
        const sub = subscriptions.find(
          (s) => (s.id ?? s.username) === searchSubId,
        );
        if (sub) {
          const {
            buildTtConfigEmbed,
            buildTtConfigRows,
          } = require("../../../integrations/tiktok/panelBuilder");
          const tiktok_panel = require("../../../interactions/buttons/tiktok_panel");
          const key = `${interaction.user.id}:${interaction.guild.id}`;
          tiktok_panel.pendingConfigs.set(key, {
            username: sub.username,
            profileUrl: sub.profileUrl,
            announceChannelId: sub.discordChannelId ?? sub.announce_channel_id,
            notifyVideos: sub.notifyVideos ?? true,
            notifyLive: sub.notifyLive ?? true,
            customMessage: sub.customMessage ?? null,
            editSubId: searchSubId,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
          const pending = tiktok_panel.pendingConfigs.get(key);
          const embed = buildTtConfigEmbed(client, pending, true);
          const rows = buildTtConfigRows(pending);
          return interaction.reply({ embeds: [embed], components: rows });
        }
      }

      const totalPages = Math.max(1, Math.ceil(subscriptions.length / 5));
      const {
        buildTtListEmbed,
        buildTtListRows,
      } = require("../../../integrations/tiktok/panelBuilder");

      const embed = buildTtListEmbed(client, subscriptions, 0, totalPages);
      const rows = buildTtListRows(subscriptions, 0, totalPages, 5);

      await interaction.reply({ embeds: [embed], components: rows });
    } catch (error) {
      logger.error(
        `Error loading TikTok panel for guild ${interaction.guild.id}: ${error.message}`,
      );
      await interaction.reply({
        content: "An error occurred while opening the panel.",
        ephemeral: true,
      });
    }
  },
};
