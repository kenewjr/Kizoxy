const {
  ApplicationCommandOptionType,
  PermissionsBitField,
} = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const Embeds = require("../../../lib/embeds");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const tiktokStateStorage = require("../../../persistence/tiktokStateStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

module.exports = {
  name: ["tiktok", "status"],
  description: "Show current monitoring status for a subscribed account.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "tiktok_url",
      description: "The subscribed account to inspect.",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: true,
    },
  ],
  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subscriptionId = interaction.options.getString("tiktok_url");
      const sub = await tiktokStorage.getSubscription(
        interaction.guild.id,
        subscriptionId,
      );
      if (!sub) {
        return replyError(
          interaction,
          "That subscription no longer exists. Use `/tiktok list`.",
        );
      }

      const state = (await tiktokStateStorage.getState(sub.username)) || {};
      const lastChecked = state.lastCheckedAt
        ? `<t:${Math.floor(new Date(state.lastCheckedAt).getTime() / 1000)}:R>`
        : "Never";
      const health =
        state.consecutiveFailures > 0
          ? `⚠️ ${state.consecutiveFailures} consecutive failure(s) — account may be deleted/renamed or provider is down`
          : "✅ Healthy";

      const embed = Embeds.brand(client, {
        title: `TikTok Status — @${sub.username}`,
        url: sub.profileUrl,
        fields: [
          {
            name: "Channel",
            value: `<#${sub.discordChannelId}>`,
            inline: true,
          },
          {
            name: "Live now",
            value: state.isLive ? "🔴 Yes" : "No",
            inline: true,
          },
          { name: "Last checked", value: lastChecked, inline: true },
          {
            name: "Last video ID",
            value: state.lastVideoId || "—",
            inline: true,
          },
          {
            name: "Notify",
            value: `Videos ${sub.notifyVideos ? "✅" : "❌"} • Live ${sub.notifyLive ? "✅" : "❌"}`,
            inline: true,
          },
          { name: "Health", value: health, inline: false },
        ],
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error fetching TikTok status: ${error.message}`);
      await interaction.editReply(
        "An error occurred while fetching the status.",
      );
    }
  },
};
