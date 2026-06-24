const {
  ApplicationCommandOptionType,
  PermissionsBitField,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const youtubeStorage = require("../../../persistence/youtubeStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("YOUTUBE");

module.exports = {
  name: ["youtube", "remove"],
  description: "Unsubscribe a YouTube channel from this server.",
  category: "YouTube",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "channel",
      description: "The subscribed channel to remove.",
      type: ApplicationCommandOptionType.String,
      required: true,
      // Autocomplete is served by the centralized dispatcher in
      // events/guild/interactionCreate.js; the choice value is the stored
      // subscription id.
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

    const subscriptionId = interaction.options.getString("channel");
    const subscription = await youtubeStorage.getSubscription(
      interaction.guild.id,
      subscriptionId,
    );
    if (!subscription) {
      return replyError(
        interaction,
        "That subscription no longer exists. Use `/youtube list` to see current subscriptions.",
      );
    }

    try {
      await youtubeStorage.removeSubscription(
        interaction.guild.id,
        subscriptionId,
      );
    } catch (err) {
      logger.error(`Failed to remove subscription: ${err.message}`);
      return replyError(
        interaction,
        "Failed to remove the subscription. Please try again.",
      );
    }

    return replySuccess(
      interaction,
      `Unsubscribed from **${subscription.youtubeChannelTitle}**.`,
    );
  },
};
