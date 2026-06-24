const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const logger = new Logger("VC:Role");

async function handleAdd(client, interaction) {
  const channel = interaction.options.getChannel("channel", true);
  const role = interaction.options.getRole("role", true);
  const ownerOnly = interaction.options.getBoolean("owner-only") ?? false;

  if (channel.type !== ChannelType.GuildVoice) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid channel",
          description: "Configure voice roles for temporary voice channels.",
        }),
      ],
    });
  }

  // Discord blocks bots from assigning a role above their own highest role.
  const me = interaction.guild.members.me;
  if (me && role.position >= me.roles.highest.position) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Role too high",
          description: `I can't manage ${role} because it sits at or above my highest role. Move my role above it and try again.`,
        }),
      ],
    });
  }

  if (role.managed) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Managed role",
          description: `${role} is managed by an integration and can't be assigned manually.`,
        }),
      ],
    });
  }

  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const existing = await tempVcStorage.getVoiceRoles(interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxVoiceRoles) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Limit reached",
          description: `Free tier allows ${settings.maxVoiceRoles} voice role(s). Remove one or upgrade.`,
        }),
      ],
    });
  }

  const duplicate = existing.find(
    (vr) => vr.channelId === channel.id && vr.roleId === role.id,
  );
  if (duplicate) {
    return interaction.editReply({
      embeds: [
        Embeds.warning(client, {
          title: "Already configured",
          description: `${role} is already attached to ${channel}.`,
        }),
      ],
    });
  }

  const record = await tempVcStorage.addVoiceRole(interaction.guildId, {
    channelId: channel.id,
    roleId: role.id,
    ownerOnly,
  });

  logger.info(
    `Voice role ${role.id} attached to ${channel.id} in ${interaction.guildId} (ownerOnly=${ownerOnly})`,
  );

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Voice role added",
        fields: [
          { name: "Channel", value: `${channel}`, inline: true },
          { name: "Role", value: `${role}`, inline: true },
          {
            name: "Scope",
            value: ownerOnly ? "Owner only" : "Anyone in channel",
            inline: true,
          },
          { name: "ID", value: `\`${record.id}\``, inline: false },
        ],
      }),
    ],
  });
}

async function handleRemove(client, interaction) {
  const channel = interaction.options.getChannel("channel", true);
  const role = interaction.options.getRole("role", true);

  const all = await tempVcStorage.getVoiceRoles(interaction.guildId);
  const match = all.find(
    (vr) => vr.channelId === channel.id && vr.roleId === role.id,
  );
  if (!match) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Not configured",
          description: `${role} is not attached to ${channel}.`,
        }),
      ],
    });
  }

  await tempVcStorage.removeVoiceRole(interaction.guildId, match.id);
  logger.info(`Voice role ${match.id} removed in ${interaction.guildId}`);

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Voice role removed",
        description: `${role} is no longer attached to ${channel}.`,
      }),
    ],
  });
}

async function handleList(client, interaction) {
  const all = await tempVcStorage.getVoiceRoles(interaction.guildId);
  if (all.length === 0) {
    return interaction.editReply({
      embeds: [
        Embeds.info(client, {
          title: "No voice roles",
          description: "Use `/vcrole add` to attach a role to a voice channel.",
        }),
      ],
    });
  }

  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const fields = all.slice(0, 9).map((vr) => ({
    name: `<@&${vr.roleId}>`,
    value: [
      `Channel: <#${vr.channelId}>`,
      `Scope: ${vr.ownerOnly ? "Owner only" : "Anyone in channel"}`,
      `ID: \`${vr.id}\``,
    ].join("\n"),
  }));

  return interaction.editReply({
    embeds: [
      Embeds.info(client, {
        title: `Voice roles (${all.length}/${settings.maxVoiceRoles})`,
        fields,
        footerText: settings.isPremium ? "Premium tier" : "Free tier",
      }),
    ],
  });
}

module.exports = {
  name: ["vcrole"],
  description: "Manage TempVC voice roles (admin)",
  category: "Voice",
  permissions: { user: [PermissionsBitField.Flags.ManageGuild] },
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "add",
      description: "Attach a role to a voice channel",
      options: [
        {
          type: ApplicationCommandOptionType.Channel,
          name: "channel",
          description: "Voice channel (generator or specific TempVC)",
          required: true,
          channel_types: [ChannelType.GuildVoice],
        },
        {
          type: ApplicationCommandOptionType.Role,
          name: "role",
          description: "Role to assign while members are connected",
          required: true,
        },
        {
          type: ApplicationCommandOptionType.Boolean,
          name: "owner-only",
          description: "Only assign to the TempVC owner (default: false)",
          required: false,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "remove",
      description: "Detach a role from a voice channel",
      options: [
        {
          type: ApplicationCommandOptionType.Channel,
          name: "channel",
          description: "The voice channel",
          required: true,
          channel_types: [ChannelType.GuildVoice],
        },
        {
          type: ApplicationCommandOptionType.Role,
          name: "role",
          description: "The role to detach",
          required: true,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "list",
      description: "List configured voice roles",
    },
  ],
  run: async (client, interaction) => {
    if (
      !interaction.memberPermissions?.has?.(
        PermissionsBitField.Flags.ManageGuild,
      )
    ) {
      return interaction.reply({
        content:
          "❌ You need the **Manage Server** permission to run this command.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const sub = interaction.options.getSubcommand();
      if (sub === "add") return handleAdd(client, interaction);
      if (sub === "remove") return handleRemove(client, interaction);
      if (sub === "list") return handleList(client, interaction);
      return interaction.editReply({ content: "Unknown subcommand." });
    } catch (err) {
      logger.error(`vcrole error: ${err.message}`);
      return interaction.editReply({
        embeds: [
          Embeds.error(client, {
            title: "Command failed",
            description: Embeds.formatError(err),
          }),
        ],
      });
    }
  },
};
