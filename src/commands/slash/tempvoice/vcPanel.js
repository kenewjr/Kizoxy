// src/commands/slash/tempvoice/vcPanel.js
const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
} = require("discord.js");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const panelService = require("../../../features/tempvc/panelService");

const logger = new Logger("VC:Panel");

function noPermission(interaction) {
  return interaction.reply({
    content:
      "❌ You need the **Manage Server** permission to use this command.",
    ephemeral: true,
  });
}

async function handleSetup(client, interaction) {
  const channel = interaction.options.getChannel("channel", true);

  if (!channel.isTextBased()) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid channel",
          description: "The panel channel must be a text channel.",
        }),
      ],
    });
  }

  const me = interaction.guild.members.me;
  const permsNeeded = [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.EmbedLinks,
  ];
  const missing = permsNeeded.filter(
    (p) => !channel.permissionsFor(me)?.has(p),
  );
  if (missing.length > 0) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Missing permissions",
          description: `The bot needs Send Messages, View Channel, Manage Channel, Manage Roles, and Embed Links in ${channel} to host the panel.`,
        }),
      ],
    });
  }

  try {
    const message = await panelService.sendPanel(
      client,
      interaction.guild,
      channel,
    );
    if (!message) {
      return interaction.editReply({
        embeds: [
          Embeds.error(client, {
            title: "Setup failed",
            description: `Could not send the panel message to ${channel}. Check bot permissions.`,
          }),
        ],
      });
    }

    logger.info(
      `Panel set up in ${interaction.guildId} → channel ${channel.id} msg ${message.id} by ${interaction.user.id}`,
    );

    return interaction.editReply({
      embeds: [
        Embeds.success(client, {
          title: "Panel created",
          description: `The TempVC control panel has been sent to ${channel}.\nOnly the bot can send messages there now.`,
        }),
      ],
    });
  } catch (err) {
    logger.error(`vcPanel setup failed: ${err.message}`);
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Setup error",
          description: Embeds.formatError(err),
        }),
      ],
    });
  }
}

async function handleRemove(client, interaction) {
  try {
    const removed = await panelService.removePanel(client, interaction.guild);
    if (!removed) {
      return interaction.editReply({
        embeds: [
          Embeds.warning(client, {
            title: "No panel found",
            description: "There is no active panel configured for this server.",
          }),
        ],
      });
    }
    logger.info(
      `Panel removed in ${interaction.guildId} by ${interaction.user.id}`,
    );
    return interaction.editReply({
      embeds: [
        Embeds.success(client, {
          title: "Panel removed",
          description: "The control panel message has been deleted and the configuration cleared.",
        }),
      ],
    });
  } catch (err) {
    logger.error(`vcPanel remove failed: ${err.message}`);
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Remove error",
          description: Embeds.formatError(err),
        }),
      ],
    });
  }
}

async function handleRefresh(client, interaction) {
  try {
    const message = await panelService.refreshPanel(client, interaction.guild);
    if (!message) {
      return interaction.editReply({
        embeds: [
          Embeds.warning(client, {
            title: "Refresh failed",
            description:
              "No panel is configured, or the panel channel is gone. Run `/vcpanel setup` first.",
          }),
        ],
      });
    }
    logger.info(
      `Panel refreshed in ${interaction.guildId} by ${interaction.user.id}`,
    );
    return interaction.editReply({
      embeds: [
        Embeds.success(client, {
          title: "Panel refreshed",
          description: "The control panel has been re-sent.",
        }),
      ],
    });
  } catch (err) {
    logger.error(`vcPanel refresh failed: ${err.message}`);
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Refresh error",
          description: Embeds.formatError(err),
        }),
      ],
    });
  }
}

const SUB = ApplicationCommandOptionType.Subcommand;
const CHN = ApplicationCommandOptionType.Channel;

module.exports = {
  name: ["vcpanel"],
  description: "Manage the persistent TempVC control panel (admin)",
  category: "Voice",
  options: [
    {
      type: SUB,
      name: "setup",
      description: "Send the TempVC control panel to a text channel",
      options: [
        {
          type: CHN,
          name: "channel",
          description: "Text channel to host the panel",
          required: true,
          channel_types: [ChannelType.GuildText],
        },
      ],
    },
    {
      type: SUB,
      name: "remove",
      description: "Delete the panel message and clear its configuration",
    },
    {
      type: SUB,
      name: "refresh",
      description: "Force-resend the panel (use after Discord outages)",
    },
  ],
  run: async (client, interaction) => {
    if (
      !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return noPermission(interaction);
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub === "setup") return handleSetup(client, interaction);
    if (sub === "remove") return handleRemove(client, interaction);
    if (sub === "refresh") return handleRefresh(client, interaction);

    return interaction.editReply({ content: "Unknown subcommand." });
  },
};
