const {
  ApplicationCommandOptionType,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");

module.exports = {
  name: ["setlog"],
  description: "Set the server moderation log channel.",
  category: "Settings",
  defaultMemberPermissions:
    PermissionsBitField.Flags.ManageGuild |
    PermissionsBitField.Flags.Administrator,
  options: [
    {
      name: "channel",
      description: "Target text channel for server logs.",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: true,
    },
  ],
  permissions: {
    bot: [PermissionsBitField.Flags.SendMessages],
    user: [
      PermissionsBitField.Flags.ManageGuild,
      PermissionsBitField.Flags.Administrator,
    ],
  },
  run: async (client, interaction) => {
    const hasManageGuild = interaction.memberPermissions?.has?.(
      PermissionsBitField.Flags.ManageGuild,
    );
    const hasAdmin = interaction.memberPermissions?.has?.(
      PermissionsBitField.Flags.Administrator,
    );

    if (!hasManageGuild && !hasAdmin) {
      return replyError(
        interaction,
        "You lack the required permissions to run this command. You need either **Manage Server** or **Administrator** permission.",
      );
    }

    const channel = interaction.options.getChannel("channel");

    if (!channel?.isTextBased?.()) {
      return replyError(
        interaction,
        "The selected channel is not a text channel. Pick a text or announcement channel.",
      );
    }

    const me = interaction.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.SendMessages)) {
      return replyError(
        interaction,
        `I don't have **Send Messages** permission in ${channel}. Grant the permission and try again.`,
      );
    }

    client.logStorage.setChannel(interaction.guild.id, channel.id);

    return replySuccess(interaction, `Log channel set to ${channel}.`, {
      title: "Logger active",
      fields: [
        { name: "Channel", value: `${channel}`, inline: true },
        { name: "Set by", value: `${interaction.user}`, inline: true },
      ],
    });
  },
};
