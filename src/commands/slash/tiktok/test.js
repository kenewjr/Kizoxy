const { PermissionsBitField } = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const tiktokStorage = require("../../../persistence/tiktokStorage");
const notifier = require("../../../integrations/tiktok/notifier");
const Logger = require("../../../lib/logger");

const logger = new Logger("TIKTOK");

module.exports = {
  name: ["tiktok", "test"],
  description: "Send a sample TikTok notification to verify setup.",
  category: "TikTok",
  defaultMemberPermissions: PermissionsBitField.Flags.ManageGuild,
  run: async (client, interaction) => {
    if (!interaction.memberPermissions?.has?.("ManageGuild")) {
      return replyError(
        interaction,
        "You need the **Manage Server** permission to run this command.",
      );
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const subscriptions = await tiktokStorage.listSubscriptions(
        interaction.guild.id,
      );
      if (!subscriptions.length) {
        return replyError(
          interaction,
          "No subscriptions yet. Add one with `/tiktok add` first.",
        );
      }

      // Use the first subscription as the sample target/creator.
      const sub = subscriptions[0];
      const sampleVideo = {
        id: "0000000000000000000",
        url: sub.profileUrl,
        cover: null,
        title: "Sample notification — this is what a new video looks like.",
        createTime: Math.floor(Date.now() / 1000),
        isLive: false,
      };
      const embed = notifier.buildVideoEmbed(client, {
        username: sub.username,
        video: sampleVideo,
        avatar: null,
      });
      const row = notifier.buildLinkRow("Watch on TikTok", sampleVideo.url);

      const delivered = await notifier.send(client, sub, {
        embed,
        row,
        content: notifier.mentionContent(sub),
      });

      if (!delivered) {
        return replyError(
          interaction,
          `Couldn't post to <#${sub.discordChannelId}>. Check the bot's permissions there.`,
        );
      }

      return replySuccess(
        interaction,
        `Sent a test notification to <#${sub.discordChannelId}> for **@${sub.username}**.`,
      );
    } catch (error) {
      logger.error(`Error sending TikTok test notification: ${error.message}`);
      return replyError(
        interaction,
        "An error occurred while sending the test notification.",
      );
    }
  },
};
