const { PermissionsBitField } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const youtubeStorage = require("../../../persistence/youtubeStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("YOUTUBE");

module.exports = {
  name: ["youtube"],
  description: "Manage YouTube subscriptions.",
  category: "YouTube",
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
      const subscriptions = await youtubeStorage.listSubscriptions(
        interaction.guild.id,
      );

      const searchSubId = interaction.options.getString("search");
      if (searchSubId) {
        const sub = subscriptions.find(
          (s) => (s.id ?? s.youtubeChannelId) === searchSubId,
        );
        if (sub) {
          const {
            buildYtConfigEmbed,
            buildYtConfigRows,
          } = require("../../../integrations/youtube/panelBuilder");
          const youtube_panel = require("../../../interactions/buttons/youtube_panel");
          const key = `${interaction.user.id}:${interaction.guild.id}`;
          youtube_panel.pendingConfigs.set(key, {
            channelId: sub.youtubeChannelId ?? sub.channel_id,
            channelName:
              sub.youtubeChannelTitle ??
              sub.channel_name ??
              sub.youtubeChannelId,
            announceChannelId: sub.announceChannelId ?? sub.announce_channel_id,
            notifyVideos: sub.notifyVideos ?? true,
            notifyShorts: sub.notifyShorts ?? true,
            notifyLive: sub.notifyLive ?? true,
            notifyUpcoming: sub.notifyUpcoming ?? true,
            customMessage: sub.customMessage ?? null,
            editSubId: searchSubId,
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
          const pending = youtube_panel.pendingConfigs.get(key);
          const embed = buildYtConfigEmbed(client, pending, true);
          const rows = buildYtConfigRows(pending);
          return interaction.reply({ embeds: [embed], components: rows });
        }
      }

      const totalPages = Math.max(1, Math.ceil(subscriptions.length / 5));
      const {
        buildYtListEmbed,
        buildYtListRows,
      } = require("../../../integrations/youtube/panelBuilder");

      const embed = buildYtListEmbed(client, subscriptions, 0, totalPages);
      const rows = buildYtListRows(subscriptions, 0, totalPages, 5);

      await interaction.reply({ embeds: [embed], components: rows });
    } catch (error) {
      logger.error(
        `Error loading YouTube panel for guild ${interaction.guild.id}: ${error.message}`,
      );
      await interaction.reply({
        content: "An error occurred while opening the panel.",
        ephemeral: true,
      });
    }
  },
};
