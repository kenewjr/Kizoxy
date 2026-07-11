const {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");
const logger = new Logger("VC:Setup");

async function handleAdd(client, interaction) {
  const channel = interaction.options.getChannel("channel", true);
  const category = interaction.options.getChannel("category");
  const customName = interaction.options.getString("name");
  const customLimit = interaction.options.getInteger("limit");
  const customBitrate = interaction.options.getInteger("bitrate");
  const customRegion = interaction.options.getString("region");
  const rtcRegion = customRegion === "auto" ? null : customRegion;

  if (channel.type !== ChannelType.GuildVoice) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid channel",
          description: "Set up a temporary voice channel generator.",
        }),
      ],
    });
  }

  if (await tempVcStorage.getTempChannel(interaction.guildId, channel.id)) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Channel in use",
          description:
            "That channel is currently an active TempVC and cannot be used as a generator.",
        }),
      ],
    });
  }

  if (await tempVcStorage.getGenerator(interaction.guildId, channel.id)) {
    return interaction.editReply({
      embeds: [
        Embeds.warning(client, {
          title: "Already a generator",
          description: `${channel} is already registered.`,
        }),
      ],
    });
  }

  if (category && category.type !== ChannelType.GuildCategory) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid category",
          description:
            "The category option must point to a real category channel.",
        }),
      ],
    });
  }

  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const existing = await tempVcStorage.getAllGenerators(interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxGenerators) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Limit reached",
          description: `Free tier allows ${settings.maxGenerators} generators. Remove one or upgrade to add more.`,
        }),
      ],
    });
  }

  const generator = await tempVcStorage.addGenerator(interaction.guildId, {
    id: channel.id,
    categoryId: category?.id ?? channel.parentId ?? null,
    defaultName: customName || "{username}'s Channel",
    defaultLimit: Number.isInteger(customLimit) ? customLimit : 0,
    defaultBitrate: channel.bitrate || 64000,
    bitrate:
      customBitrate ||
      (channel.bitrate ? Math.round(channel.bitrate / 1000) : 64),
    rtcRegion,
    templateId: null,
    createdAt: Date.now(),
  });

  logger.info(
    `Generator added in ${interaction.guildId}: ${channel.id} by ${interaction.user.id}`,
  );

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Generator added",
        fields: [
          { name: "Channel", value: `${channel}`, inline: true },
          {
            name: "Category",
            value: generator.categoryId ? `<#${generator.categoryId}>` : "—",
            inline: true,
          },
          { name: "Default name", value: generator.defaultName, inline: false },
          {
            name: "Default limit",
            value: generator.defaultLimit
              ? String(generator.defaultLimit)
              : "Unlimited",
            inline: true,
          },
          {
            name: "Default bitrate",
            value: `${generator.bitrate} kbps`,
            inline: true,
          },
          {
            name: "Voice Region",
            value: generator.rtcRegion || "Automatic",
            inline: true,
          },
        ],
      }),
    ],
  });
}

async function handleRemove(client, interaction) {
  const channel = interaction.options.getChannel("channel", true);
  const existing = await tempVcStorage.getGenerator(
    interaction.guildId,
    channel.id,
  );
  if (!existing) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Not a generator",
          description: `${channel} is not registered.`,
        }),
      ],
    });
  }

  await tempVcStorage.removeGenerator(interaction.guildId, channel.id);
  logger.info(
    `Generator removed in ${interaction.guildId}: ${channel.id} by ${interaction.user.id}`,
  );

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Generator removed",
        description: `${channel} has been deregistered. Existing TempVCs from this generator will continue until empty.`,
      }),
    ],
  });
}

async function handleList(client, interaction) {
  const generators = await tempVcStorage.getAllGenerators(interaction.guildId);
  if (generators.length === 0) {
    return interaction.editReply({
      embeds: [
        Embeds.info(client, {
          title: "No generators",
          description: "Use `/vcsetup generator add` to register one.",
        }),
      ],
    });
  }

  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const fields = generators.slice(0, 9).map((g) => ({
    name: `<#${g.id}>`,
    value: [
      `Category: ${g.categoryId ? `<#${g.categoryId}>` : "—"}`,
      `Default name: \`${g.defaultName}\``,
      `Limit: ${g.defaultLimit || "Unlimited"} • Bitrate: ${Math.round((g.defaultBitrate || 0) / 1000)} kbps`,
      g.templateId ? `Template: \`${g.templateId}\`` : "Template: —",
    ].join("\n"),
  }));

  return interaction.editReply({
    embeds: [
      Embeds.info(client, {
        title: `Generators (${generators.length}/${settings.maxGenerators})`,
        fields,
        footerText: settings.isPremium ? "Premium tier" : "Free tier",
      }),
    ],
  });
}

module.exports = {
  name: ["vcsetup"],
  description: "Manage TempVC generators (admin)",
  category: "Voice",
  permissions: {
    user: [PermissionsBitField.Flags.ManageGuild],
  },
  options: [
    {
      type: ApplicationCommandOptionType.SubcommandGroup,
      name: "generator",
      description: "Manage voice generator channels",
      options: [
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "add",
          description: "Register a voice channel as a TempVC generator",
          options: [
            {
              type: ApplicationCommandOptionType.Channel,
              name: "channel",
              description: "The voice channel to use as the generator",
              required: true,
              channel_types: [ChannelType.GuildVoice],
            },
            {
              type: ApplicationCommandOptionType.Channel,
              name: "category",
              description: "Category where TempVCs will spawn",
              required: false,
              channel_types: [ChannelType.GuildCategory],
            },
            {
              type: ApplicationCommandOptionType.String,
              name: "name",
              description:
                "Default TempVC name template, e.g. {username}'s Channel",
              required: false,
            },
            {
              type: ApplicationCommandOptionType.Integer,
              name: "limit",
              description: "Default user limit (0 = unlimited)",
              required: false,
              min_value: 0,
              max_value: 99,
            },
            {
              type: ApplicationCommandOptionType.Integer,
              name: "bitrate",
              description: "Default bitrate in kbps (8-384)",
              required: false,
              min_value: 8,
              max_value: 384,
            },
            {
              type: ApplicationCommandOptionType.String,
              name: "region",
              description: "Voice region",
              required: false,
              choices: [
                { name: "auto", value: "auto" },
                { name: "brazil", value: "brazil" },
                { name: "hongkong", value: "hongkong" },
                { name: "india", value: "india" },
                { name: "japan", value: "japan" },
                { name: "rotterdam", value: "rotterdam" },
                { name: "russia", value: "russia" },
                { name: "singapore", value: "singapore" },
                { name: "southafrica", value: "southafrica" },
                { name: "sydney", value: "sydney" },
                { name: "us-central", value: "us-central" },
                { name: "us-east", value: "us-east" },
                { name: "us-south", value: "us-south" },
                { name: "us-west", value: "us-west" },
              ],
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "remove",
          description: "Deregister a generator (existing TempVCs continue)",
          options: [
            {
              type: ApplicationCommandOptionType.Channel,
              name: "channel",
              description: "The generator channel to remove",
              required: true,
              channel_types: [ChannelType.GuildVoice],
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "list",
          description: "List all generators in this server",
        },
      ],
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
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();
      if (group === "generator") {
        if (sub === "add") return handleAdd(client, interaction);
        if (sub === "remove") return handleRemove(client, interaction);
        if (sub === "list") return handleList(client, interaction);
      }
      return interaction.editReply({ content: "Unknown subcommand." });
    } catch (err) {
      logger.error(`vcsetup error: ${err.message}`);
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
