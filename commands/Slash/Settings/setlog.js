const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: ["setlog"],
  description: "Sets the server log channel for events.",
  category: "Settings",
  options: [
    {
      name: "channel",
      description: "The channel to send server logs to.",
      type: ApplicationCommandOptionType.Channel,
      required: true,
    },
  ],
  permissions: {
    bot: [PermissionsBitField.Flags.SendMessages],
    user: [PermissionsBitField.Flags.ManageGuild],
  },
  run: async (client, interaction) => {
    const channel = interaction.options.getChannel("channel");

    // Must be a text-based channel
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: "Please provide a valid text channel.",
        ephemeral: true,
      });
    }

    // Save configuration
    client.logStorage.setChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setTitle("Logger Setup")
      .setDescription(`Server logs will now be sent to ${channel}.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
