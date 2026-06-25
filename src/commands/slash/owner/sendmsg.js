const { ApplicationCommandOptionType } = require("discord.js");
const { replySuccess, replyError } = require("../../../lib/interactions");
const Logger = require("../../../lib/logger");

const logger = new Logger("OWNER");

module.exports = {
  name: ["owner", "sendmsg"],
  description:
    "Send a message to a specific channel in a specific server (Owner only).",
  category: "Owner",
  // Disables the command for everyone by default.
  defaultMemberPermissions: 0n,
  options: [
    {
      name: "guild_id",
      description: "The ID of the target server.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "channel_id",
      description: "The ID of the target channel.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "message",
      description: "The message content to send.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    // Strictly restrict execution to the bot owner ID configured in env.
    if (interaction.user.id !== client.config.OWNER_ID) {
      return replyError(
        interaction,
        "You do not have permission to use this command.",
      );
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.options.getString("guild_id").trim();
    const channelId = interaction.options.getString("channel_id").trim();
    const messageContent = interaction.options.getString("message");

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return replyError(
          interaction,
          `Could not find server with ID \`${guildId}\`. Make sure the bot is in that server.`,
        );
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return replyError(
          interaction,
          `Could not find channel with ID \`${channelId}\` in server **${guild.name}**.`,
        );
      }

      if (!channel.isTextBased()) {
        return replyError(
          interaction,
          `Channel <#${channelId}> is not a text channel.`,
        );
      }

      await channel.send(messageContent);

      logger.info(
        `Owner ${interaction.user.tag} sent message to guild ${guild.name} (${guildId}), channel #${channel.name} (${channelId})`,
      );

      return replySuccess(
        interaction,
        `Message successfully sent to channel <#${channelId}> in server **${guild.name}**.`,
      );
    } catch (err) {
      logger.error(`Failed to send message: ${err.message}`);
      return replyError(interaction, `Failed to send message: ${err.message}`);
    }
  },
};
