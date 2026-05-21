const {
  ApplicationCommandOptionType,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");

module.exports = {
  name: ["setlog"],
  description: "Set the channel for server logs (member join/leave, etc.).",
  category: "Settings",
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
    user: [PermissionsBitField.Flags.ManageGuild],
  },
  run: async (client, interaction) => {
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
