const {
  ApplicationCommandOptionType,
  PermissionsBitField,
} = require("discord.js");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const Embeds = require("../../../lib/embeds");
const { confirmAction } = require("../../../lib/interactions");
const Logger = require("../../../lib/logger");
const logger = new Logger("VC:Template");

const EDITABLE_FIELDS = [
  "name",
  "channelName",
  "limit",
  "bitrate",
  "locked",
  "hidden",
];

function parseFieldValue(field, raw) {
  if (field === "limit") {
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 99) {
      return {
        error: "Limit must be an integer between 0 and 99 (0 = unlimited).",
      };
    }
    return { value: n };
  }
  if (field === "bitrate") {
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 8000 || n > 384000) {
      return { error: "Bitrate must be in bps between 8000 and 384000." };
    }
    return { value: n };
  }
  if (field === "locked" || field === "hidden") {
    const lowered = String(raw).toLowerCase();
    if (["true", "yes", "1", "on"].includes(lowered)) return { value: true };
    if (["false", "no", "0", "off"].includes(lowered)) return { value: false };
    return { error: `${field} must be true/false (or yes/no, on/off).` };
  }
  return { value: String(raw) };
}

async function handleCreate(client, interaction) {
  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const existing = await tempVcStorage.getAllTemplates(interaction.guildId);
  if (!settings.isPremium && existing.length >= settings.maxTemplates) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Limit reached",
          description: `Free tier allows ${settings.maxTemplates} templates. Delete one or upgrade.`,
        }),
      ],
    });
  }

  const name = interaction.options.getString("name", true).slice(0, 64);
  const channelName =
    interaction.options.getString("channel-name") || "{username}'s Channel";
  const limit = interaction.options.getInteger("limit") ?? 0;
  const locked = interaction.options.getBoolean("locked") ?? false;
  const hidden = interaction.options.getBoolean("hidden") ?? false;

  const template = await tempVcStorage.addTemplate(interaction.guildId, {
    name,
    channelName,
    limit,
    bitrate: 64000,
    isLocked: locked,
    isHidden: hidden,
    createdBy: interaction.user.id,
  });

  logger.info(
    `Template ${template.id} created in ${interaction.guildId} by ${interaction.user.id}`,
  );

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Template created",
        fields: [
          { name: "ID", value: `\`${template.id}\``, inline: false },
          { name: "Name", value: template.name, inline: true },
          { name: "Channel name", value: template.channelName, inline: true },
          {
            name: "Limit",
            value: template.limit ? String(template.limit) : "Unlimited",
            inline: true,
          },
          {
            name: "Locked",
            value: template.isLocked ? "Yes" : "No",
            inline: true,
          },
          {
            name: "Hidden",
            value: template.isHidden ? "Yes" : "No",
            inline: true,
          },
        ],
      }),
    ],
  });
}

async function handleEdit(client, interaction) {
  const templateId = interaction.options.getString("template", true);
  const field = interaction.options.getString("field", true);
  const rawValue = interaction.options.getString("value", true);

  if (!EDITABLE_FIELDS.includes(field)) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid field",
          description: `Pick one of: ${EDITABLE_FIELDS.join(", ")}.`,
        }),
      ],
    });
  }

  const template = await tempVcStorage.getTemplate(
    interaction.guildId,
    templateId,
  );
  if (!template) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Template not found",
          description: `No template with id \`${templateId}\`.`,
        }),
      ],
    });
  }

  const parsed = parseFieldValue(field, rawValue);
  if (parsed.error) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Invalid value",
          description: parsed.error,
        }),
      ],
    });
  }

  // Map UI field names to storage keys.
  const updates = {};
  if (field === "locked") updates.isLocked = parsed.value;
  else if (field === "hidden") updates.isHidden = parsed.value;
  else updates[field] = parsed.value;

  const updated = await tempVcStorage.updateTemplate(
    interaction.guildId,
    templateId,
    updates,
  );
  logger.info(
    `Template ${templateId} edited (${field}) in ${interaction.guildId}`,
  );

  return interaction.editReply({
    embeds: [
      Embeds.success(client, {
        title: "Template updated",
        description: `\`${updated.id}\` → **${field}** set to \`${parsed.value}\`.`,
      }),
    ],
  });
}

async function handleDelete(client, interaction) {
  const templateId = interaction.options.getString("template", true);
  const template = await tempVcStorage.getTemplate(
    interaction.guildId,
    templateId,
  );
  if (!template) {
    return interaction.editReply({
      embeds: [
        Embeds.error(client, {
          title: "Template not found",
          description: `No template with id \`${templateId}\`.`,
        }),
      ],
    });
  }

  const choice = await confirmAction(interaction, {
    title: "Delete template?",
    description: `This will permanently delete **${template.name}** (\`${template.id}\`). Generators referencing it will fall back to defaults.`,
    confirmLabel: "Delete",
    cancelLabel: "Keep",
  });

  if (choice !== "confirm") {
    return interaction.followUp({
      embeds: [
        Embeds.info(client, {
          title: choice === "timeout" ? "Timed out" : "Cancelled",
          description: "Template was not deleted.",
        }),
      ],
      ephemeral: true,
    });
  }

  await tempVcStorage.removeTemplate(interaction.guildId, templateId);
  logger.info(
    `Template ${templateId} deleted in ${interaction.guildId} by ${interaction.user.id}`,
  );

  return interaction.followUp({
    embeds: [
      Embeds.success(client, {
        title: "Template deleted",
        description: `\`${template.id}\` has been removed.`,
      }),
    ],
    ephemeral: true,
  });
}

async function handleList(client, interaction) {
  const templates = await tempVcStorage.getAllTemplates(interaction.guildId);
  if (templates.length === 0) {
    return interaction.editReply({
      embeds: [
        Embeds.info(client, {
          title: "No templates",
          description: "Use `/vctemplate create` to add one.",
        }),
      ],
    });
  }

  const settings = await tempVcStorage.getSettings(interaction.guildId);
  const fields = templates.slice(0, 9).map((t) => ({
    name: `${t.name}`,
    value: [
      `ID: \`${t.id}\``,
      `Channel name: \`${t.channelName}\``,
      `Limit: ${t.limit || "Unlimited"} • Bitrate: ${Math.round((t.bitrate || 0) / 1000)} kbps`,
      `Locked: ${t.isLocked ? "Yes" : "No"} • Hidden: ${t.isHidden ? "Yes" : "No"}`,
    ].join("\n"),
  }));

  return interaction.editReply({
    embeds: [
      Embeds.info(client, {
        title: `Templates (${templates.length}/${settings.maxTemplates})`,
        fields,
        footerText: settings.isPremium ? "Premium tier" : "Free tier",
      }),
    ],
  });
}

module.exports = {
  name: ["vctemplate"],
  description: "Manage TempVC templates (admin)",
  category: "Voice",
  permissions: { user: [PermissionsBitField.Flags.ManageGuild] },
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "create",
      description: "Create a new template",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "name",
          description: "Template display name",
          required: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: "channel-name",
          description: "Channel name pattern, e.g. {username}'s VC",
          required: false,
        },
        {
          type: ApplicationCommandOptionType.Integer,
          name: "limit",
          description: "User limit (0 = unlimited)",
          required: false,
          min_value: 0,
          max_value: 99,
        },
        {
          type: ApplicationCommandOptionType.Boolean,
          name: "locked",
          description: "Lock channel by default",
          required: false,
        },
        {
          type: ApplicationCommandOptionType.Boolean,
          name: "hidden",
          description: "Hide channel by default",
          required: false,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "edit",
      description: "Edit a template field",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "template",
          description: "Template ID",
          required: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: "field",
          description: "Field to edit",
          required: true,
          choices: EDITABLE_FIELDS.map((f) => ({ name: f, value: f })),
        },
        {
          type: ApplicationCommandOptionType.String,
          name: "value",
          description: "New value",
          required: true,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "delete",
      description: "Delete a template (with confirmation)",
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: "template",
          description: "Template ID",
          required: true,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "list",
      description: "List all templates",
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

    const sub = interaction.options.getSubcommand();

    // delete uses confirmAction which sends its own reply, so don't pre-defer.
    if (sub !== "delete") {
      await interaction.deferReply({ ephemeral: true });
    }

    try {
      if (sub === "create") return handleCreate(client, interaction);
      if (sub === "edit") return handleEdit(client, interaction);
      if (sub === "delete") return handleDelete(client, interaction);
      if (sub === "list") return handleList(client, interaction);
      return interaction.editReply({ content: "Unknown subcommand." });
    } catch (err) {
      logger.error(`vctemplate error: ${err.message}`);
      const errEmbed = Embeds.error(client, {
        title: "Command failed",
        description: Embeds.formatError(err),
      });
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
      }
      return interaction
        .reply({ embeds: [errEmbed], ephemeral: true })
        .catch(() => {});
    }
  },
};
