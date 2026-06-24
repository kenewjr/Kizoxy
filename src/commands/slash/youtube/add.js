const {
  ApplicationCommandOptionType,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const youtubeStorage = require("../../../persistence/youtubeStorage");
const { resolveChannel } = require("../../../integrations/youtube/client");
const Logger = require("../../../lib/logger");

const logger = new Logger("YOUTUBE");

module.exports = {
  name: ["youtube", "add"],
  description: "Subscribe a YouTube channel to announce here.",
  category: "YouTube",
  // UI hint only; the real gate is the inline ensureManageGuild check below.
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "channel",
      description: "YouTube channel URL, @handle, handle, or UC... ID.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "announce_channel",
      description: "Where announcements will be posted.",
      type: ApplicationCommandOptionType.Channel,
      channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: true,
    },
    {
      name: "mention_role",
      description: "Role to ping above the announcement (optional).",
      type: ApplicationCommandOptionType.Role,
      required: false,
    },
    {
      name: "notify_videos",
      description: "Announce new regular videos (default: true).",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: "notify_shorts",
      description: "Announce new Shorts (default: true).",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
    {
      name: "notify_live",
      description: "Announce when the channel goes live (default: true).",
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

    await interaction.deferReply({ ephemeral: true });

    const input = interaction.options.getString("channel");
    const announceChannel = interaction.options.getChannel("announce_channel");
    const mentionRole = interaction.options.getRole("mention_role");
    const notifyVideos = interaction.options.getBoolean("notify_videos");
    const notifyShorts = interaction.options.getBoolean("notify_shorts");
    const notifyLive = interaction.options.getBoolean("notify_live");

    let resolved;
    try {
      resolved = await resolveChannel(input);
    } catch (err) {
      return replyError(interaction, err.message);
    }

    const existing = await youtubeStorage.findByYoutubeChannel(
      interaction.guild.id,
      resolved.youtubeChannelId,
    );
    if (existing) {
      return replyError(
        interaction,
        `This server is already subscribed to **${resolved.youtubeChannelTitle}**.`,
      );
    }

    try {
      await youtubeStorage.addSubscription(interaction.guild.id, {
        youtubeChannelId: resolved.youtubeChannelId,
        youtubeChannelTitle: resolved.youtubeChannelTitle,
        youtubeChannelUrl: `https://www.youtube.com/channel/${resolved.youtubeChannelId}`,
        announceChannelId: announceChannel.id,
        mentionRoleId: mentionRole?.id ?? null,
        notifyVideos: notifyVideos !== false,
        notifyShorts: notifyShorts !== false,
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
      `Subscribed to **${resolved.youtubeChannelTitle}** — announcements will post in <#${announceChannel.id}>.`,
    );
  },
};
