const {
  ApplicationCommandOptionType,
  PermissionsBitField,
} = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const tiktokStateStorage = require("../../../persistence/tiktokStateStorage");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

module.exports = {
  name: ["tiktok", "remove"],
  description: "Unsubscribe a TikTok account from this server.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  options: [
    {
      name: "tiktok_url",
      description: "The subscribed account to remove.",
      type: ApplicationCommandOptionType.String,
      required: true,
      // Served by the centralized dispatcher in interactionCreate.js; the
      // choice value is the stored subscription id.
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

    const subscriptionId = interaction.options.getString("tiktok_url");
    const subscription = await tiktokStorage.getSubscription(
      interaction.guild.id,
      subscriptionId,
    );
    if (!subscription) {
      return replyError(
        interaction,
        "That subscription no longer exists. Use `/tiktok list` to see current subscriptions.",
      );
    }

    try {
      await tiktokStorage.removeSubscription(
        interaction.guild.id,
        subscriptionId,
      );

      // If no other guild still follows this username, drop its global poll
      // state too so it stops being polled.
      const map = await tiktokStorage.getUserSubscriberMap();
      if (!map.has(subscription.username)) {
        await tiktokStateStorage.deleteState(subscription.username);
      }
    } catch (err) {
      logger.error(`Failed to remove subscription: ${err.message}`);
      return replyError(
        interaction,
        "Failed to remove the subscription. Please try again.",
      );
    }

    return replySuccess(
      interaction,
      `Unsubscribed from **@${subscription.username}**.`,
    );
  },
};
