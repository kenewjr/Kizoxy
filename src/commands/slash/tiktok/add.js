const {
  ApplicationCommandOptionType,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const { resolveProfile } = require("../../../integrations/tiktok/resolver");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

module.exports = {
  name: ["tiktok", "add"],
  description: "Subscribe a TikTok account to post notifications here.",
  category: "TikTok",
  // UI hint only; the real gate is the inline ManageGuild check below.
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "tiktok_url",
      description: "TikTok profile URL or @username.",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "channel",
      description: "Where notifications will be posted.",
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: false,
    },
    {
      name: "mention_role",
      description: "Role to ping above the notification (optional).",
      type: ApplicationCommandOptionType.Role,
      required: false,
    },
    {
      name: "custom_message",
      description:
        "Custom text. Placeholders: {role} {name} {url} {title} {type}.",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "notify_videos",
      description: "Announce new videos (default: true).",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: "notify_live",
      description: "Announce when the account goes live (default: true).",
      type: ApplicationCommandOptionType.Boolean,
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

    const input = interaction.options.getString("tiktok_url");
    const channel = interaction.options.getChannel("channel");

    if (!input || !channel) {
      const {
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        ActionRowBuilder,
      } = require("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("tiktok_panel:add_modal")
        .setTitle("Add TikTok Subscription");

      const tiktokInput = new TextInputBuilder()
        .setCustomId("tiktok_url")
        .setLabel("TikTok Profile / URL / @Username")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. @therock or https://www.tiktok.com/@therock")
        .setRequired(true);

      const announceInput = new TextInputBuilder()
        .setCustomId("announce_channel")
        .setLabel("Discord Channel Name or ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. #tiktok or 123456789012345678")
        .setRequired(true);

      const mentionInput = new TextInputBuilder()
        .setCustomId("mention_role")
        .setLabel("Role Name or ID to Ping (Optional)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. @PingRole or 987654321098765432")
        .setRequired(false);

      const configInput = new TextInputBuilder()
        .setCustomId("notifications")
        .setLabel("Notify Videos, Live (Y/N)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. Y, Y (default all Yes)")
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(tiktokInput),
        new ActionRowBuilder().addComponents(announceInput),
        new ActionRowBuilder().addComponents(mentionInput),
        new ActionRowBuilder().addComponents(configInput),
      );

      return await interaction.showModal(modal);
    }

    await interaction.deferReply({ ephemeral: true });

    const mentionRole = interaction.options.getRole("mention_role");
    const customMessage = interaction.options.getString("custom_message");
    const notifyVideos = interaction.options.getBoolean("notify_videos");
    const notifyLive = interaction.options.getBoolean("notify_live");

    let resolved;
    try {
      resolved = resolveProfile(input);
    } catch (err) {
      return replyError(interaction, err.message);
    }

    const existing = await tiktokStorage.findByUsername(
      interaction.guild.id,
      resolved.username,
    );
    if (existing) {
      return replyError(
        interaction,
        `This server is already subscribed to **@${resolved.username}**.`,
      );
    }

    try {
      await tiktokStorage.addSubscription(interaction.guild.id, {
        username: resolved.username,
        profileUrl: resolved.profileUrl,
        discordChannelId: channel.id,
        mentionRoleId: mentionRole?.id ?? null,
        customMessage: customMessage || null,
        notifyVideos: notifyVideos !== false,
        notifyLive: notifyLive !== false,
      });
    } catch (err) {
      logger.error(`Failed to add subscription: ${err.message}`);
      return replyError(
        interaction,
        "Failed to save the subscription. Please try again.",
      );
    }

    return replySuccess(
      interaction,
      `Subscribed to **@${resolved.username}** — notifications will post in <#${channel.id}>.`,
    );
  },
};
