const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { replyError } = require("../../../lib/interactions");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const {
  fetchProfile,
  TiktokAccountNotFoundError,
  isValidTikTokId,
} = require("../../../integrations/tiktok/client");
const {
  checkHealth,
  getServiceStatus,
  BASE_URL,
} = require("../../../integrations/scraperService/client");
const notifier = require("../../../integrations/tiktok/notifier");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK_COMMAND");

module.exports = {
  name: ["tiktok"],
  description: "TikTok notifier settings, manual check, and testing.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "panel",
      description: "Open the TikTok subscription management panel.",
      type: 1, // Subcommand
      options: [
        {
          name: "search",
          description: "Directly select a subscription to edit.",
          type: 3, // String
          autocomplete: true,
          required: false,
        },
      ],
    },
    {
      name: "check",
      description:
        "Fetch live TikTok data for a user & show connection/fetch status.",
      type: 1, // Subcommand
      options: [
        {
          name: "username",
          description: "TikTok @username or profile URL.",
          type: 3, // String
          required: true,
        },
      ],
    },
    {
      name: "test-send",
      description:
        "Force send a test notification embed for a creator's latest post.",
      type: 1, // Subcommand
      options: [
        {
          name: "username",
          description: "TikTok @username or profile URL.",
          type: 3, // String
          required: true,
        },
        {
          name: "channel",
          description:
            "Target channel to send test embed (defaults to subscription channel).",
          type: 7, // Channel
          required: false,
        },
      ],
    },
    {
      name: "status",
      description:
        "Check kizoxy-scraper microservice connection & browser pool health.",
      type: 1, // Subcommand
    },
  ],

  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    const subcommand = interaction.options.getSubcommand(false) || "panel";

    if (subcommand === "status") {
      await interaction.deferReply({ ephemeral: true });
      const health = await checkHealth();

      const statusColor =
        health.status === "Online"
          ? 0x57f287
          : health.status === "Degraded"
            ? 0xfee75c
            : 0xed4245;
      const statusIcon =
        health.status === "Online"
          ? "🟢"
          : health.status === "Degraded"
            ? "🟡"
            : "🔴";

      const poolInfo = health.browserPool
        ? `Available: **${health.browserPool.available || 0}** / Total: **${health.browserPool.total || 0}** (Active: ${health.browserPool.in_use || 0})`
        : "N/A";

      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(
          `${statusIcon} kizoxy-scraper Service Status: ${health.status}`,
        )
        .addFields(
          { name: "Service URL", value: `\`${BASE_URL}\``, inline: true },
          { name: "Status", value: `**${health.status}**`, inline: true },
          { name: "Browser Pool", value: poolInfo, inline: false },
          {
            name: "Last Checked",
            value: health.lastChecked
              ? `<t:${Math.floor(new Date(health.lastChecked).getTime() / 1000)}:R>`
              : "Now",
            inline: true,
          },
        );

      if (health.error) {
        embed.addFields({
          name: "Error Detail",
          value: `\`\`\`${health.error}\`\`\``,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "check") {
      await interaction.deferReply({ ephemeral: true });
      const rawUser = interaction.options.getString("username");
      const cleanUser = rawUser.replace(/^@/, "").trim();

      logger.info(
        `[TIKTOK_COMMAND] Manual check requested by ${interaction.user.tag} for @${cleanUser}`,
      );

      let profile;
      try {
        profile = await fetchProfile(cleanUser);
      } catch (err) {
        if (err instanceof TiktokAccountNotFoundError) {
          return interaction.editReply({
            content: `❌ TikTok account **@${cleanUser}** was not found (404).`,
          });
        }
        return interaction.editReply({
          content: `❌ Scraper request failed for **@${cleanUser}**: ${err.message}`,
        });
      }

      const serviceSt = getServiceStatus();
      const validVideos = (profile.videos || []).filter((v) =>
        isValidTikTokId(v.id),
      );
      const latestVideo = validVideos[0] || null;

      const embed = new EmbedBuilder()
        .setColor(profile.user.live ? 0xfe2c55 : 0x69c9d0)
        .setTitle(`🔍 TikTok Check: @${profile.user.username}`)
        .setURL(profile.user.liveUrl)
        .addFields(
          {
            name: "Scraper Status",
            value: `\`${serviceSt.status}\` (Source: \`${profile.source || "fast"}\`)`,
            inline: true,
          },
          {
            name: "Live Status",
            value: profile.user.live ? "🔴 **LIVE NOW**" : "Not Live",
            inline: true,
          },
          {
            name: "Valid Posts Fetched",
            value: `**${validVideos.length}** post(s)`,
            inline: true,
          },
        );

      if (latestVideo) {
        embed.addFields(
          {
            name: "Latest Video Title",
            value: latestVideo.title || "*(No caption)*",
            inline: false,
          },
          {
            name: "Video ID & URL",
            value: `[\`${latestVideo.id}\`](${latestVideo.url})`,
            inline: false,
          },
        );
        if (latestVideo.cover) embed.setThumbnail(latestVideo.cover);
      } else {
        embed.addFields({
          name: "Latest Video",
          value: "*No valid posts found for this user.*",
          inline: false,
        });
      }

      if (profile.videos.length === 0 && profile.diagnostic) {
        embed.addFields({
          name: "Diagnostic",
          value: profile.diagnostic,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "test-send") {
      await interaction.deferReply({ ephemeral: true });
      const rawUser = interaction.options.getString("username");
      const cleanUser = rawUser.replace(/^@/, "").trim();
      const targetChannelInput = interaction.options.getChannel("channel");

      let profile;
      try {
        profile = await fetchProfile(cleanUser);
      } catch (err) {
        if (err instanceof TiktokAccountNotFoundError) {
          return interaction.editReply({
            content: `❌ TikTok account **@${cleanUser}** was not found.`,
          });
        }
        return interaction.editReply({
          content: `❌ Scraper error for **@${cleanUser}**: ${err.message}`,
        });
      }

      const validVideos = (profile.videos || []).filter((v) =>
        isValidTikTokId(v.id),
      );
      const latest = validVideos[0];
      if (!latest) {
        return interaction.editReply({
          content: `⚠️ No valid video posts available for **@${cleanUser}**.`,
        });
      }

      // Determine channel
      let announceChannelId = targetChannelInput?.id;
      if (!announceChannelId) {
        const subs = await tiktokStorage.listSubscriptions(
          interaction.guild.id,
        );
        const sub = subs.find(
          (s) => s.username.toLowerCase() === cleanUser.toLowerCase(),
        );
        announceChannelId = sub?.discordChannelId || sub?.announce_channel_id;
      }
      if (!announceChannelId) {
        announceChannelId = interaction.channelId;
      }

      const embed = notifier.buildVideoEmbed(client, {
        username: profile.user.username,
        video: latest,
        avatar: profile.user.avatar,
      });
      const row = notifier.buildLinkRow("Watch on TikTok", latest.url);
      const contentText = `📲 [TEST] @${profile.user.username} posted a new video`;

      const destChannel = await client.channels
        .fetch(announceChannelId)
        .catch(() => null);
      if (!destChannel) {
        return interaction.editReply({
          content: `❌ Channel <#${announceChannelId}> not found or missing permissions.`,
        });
      }

      const sentMsg = await destChannel
        .send({
          content: contentText,
          embeds: [embed],
          components: [row],
        })
        .catch((e) => {
          logger.error(
            `[TIKTOK_COMMAND] Failed to send test message to #${destChannel.id}: ${e.message}`,
          );
          return null;
        });

      if (!sentMsg) {
        return interaction.editReply({
          content: `❌ Failed to send message to <#${announceChannelId}>.`,
        });
      }

      return interaction.editReply({
        content: `✅ Test notification for **@${profile.user.username}** successfully delivered to <#${announceChannelId}>!`,
      });
    }

    // Default / "panel" subcommand: open TikTok UI panel
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
