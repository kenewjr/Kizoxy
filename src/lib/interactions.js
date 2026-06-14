const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Embeds = require("./embeds");
const Logger = require("./logger");

const logger = new Logger("INTERACTIONS");

async function replySuccess(interaction, description, options = {}) {
  const embed = Embeds.success(interaction.client, {
    title: options.title,
    description,
    fields: options.fields,
  });
  return safeReply(interaction, {
    embeds: [embed],
    ephemeral: !!options.ephemeral,
  });
}

async function replyError(interaction, errorOrMessage, options = {}) {
  const description =
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : Embeds.formatError(errorOrMessage);
  const title =
    options.title === null ? undefined : options.title || "An error occurred";
  const embed = Embeds.error(interaction.client, {
    title,
    description,
  });
  const ephemeral = options.ephemeral !== false;
  return safeReply(interaction, { embeds: [embed], ephemeral });
}

async function replyWarning(interaction, description, options = {}) {
  const embed = Embeds.warning(interaction.client, {
    title: options.title,
    description,
  });
  return safeReply(interaction, {
    embeds: [embed],
    ephemeral: options.ephemeral !== false,
  });
}

async function replyInfo(interaction, description, options = {}) {
  const embed = Embeds.info(interaction.client, {
    title: options.title,
    description,
    fields: options.fields,
  });
  return safeReply(interaction, {
    embeds: [embed],
    ephemeral: !!options.ephemeral,
  });
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.replied) {
      return await interaction.followUp(payload);
    }
    if (interaction.deferred) {
      const { ephemeral: _e, ...rest } = payload;
      return await interaction.editReply(rest);
    }
    return await interaction.reply(payload);
  } catch (err) {
    logger.error(`safeReply failed to respond: ${err.message}`);
    return null;
  }
}

function disableComponents(componentRows) {
  if (!Array.isArray(componentRows)) return [];

  return componentRows.map((row) => {
    const newRow = new ActionRowBuilder();
    const components = row.components || [];

    for (const c of components) {
      const json = typeof c.toJSON === "function" ? c.toJSON() : c;
      if (json.type === 2 /* Button */) {
        if (json.style === 5 /* Link */) {
          newRow.addComponents(ButtonBuilder.from(json));
        } else {
          newRow.addComponents(ButtonBuilder.from(json).setDisabled(true));
        }
      } else if (json.type === 3 /* StringSelect */) {
        newRow.addComponents(
          StringSelectMenuBuilder.from(json).setDisabled(true),
        );
      }
      // Other component types: best-effort copy
    }
    return newRow;
  });
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes per UX spec

function createCollector(message, options = {}) {
  const collector = message.createMessageComponentCollector({
    filter: options.filter,
    time: options.time ?? DEFAULT_TIMEOUT_MS,
    max: options.max,
  });

  collector.on("end", async (_collected, reason) => {
    if (reason === "messageDelete") return;
    try {
      const disabled = disableComponents(message.components);
      await message.edit({ components: disabled }).catch(() => {});
      if (reason === "time" && options.notifyOnTimeout !== false) {
        await message
          .reply({
            content:
              "⏰ Interaction session ended after 15 minutes of inactivity.",
            allowedMentions: { repliedUser: false },
          })
          .catch(() => {});
      }
    } catch {
      /* swallow */
    }
  });

  return collector;
}

async function confirmAction(interaction, options = {}) {
  const {
    title = "Confirm",
    description = "Are you sure you want to continue?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ephemeral = true,
  } = options;

  const embed = Embeds.warning(interaction.client, { title, description });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_${interaction.id}`)
      .setLabel(confirmLabel.slice(0, 80))
      .setStyle(4 /* Danger */),
    new ButtonBuilder()
      .setCustomId(`cancel_${interaction.id}`)
      .setLabel(cancelLabel.slice(0, 80))
      .setStyle(2 /* Secondary */),
  );

  const reply = await safeReply(interaction, {
    embeds: [embed],
    components: [row],
    ephemeral,
  });
  if (!reply) return "timeout";

  try {
    const click = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      time: timeoutMs,
    });
    const choice = click.customId.startsWith("confirm_") ? "confirm" : "cancel";
    await click
      .update({ components: disableComponents([row]) })
      .catch(() => {});
    return choice;
  } catch {
    // Timed out
    await safeReply(interaction, {
      components: disableComponents([row]),
    }).catch(() => {});
    return "timeout";
  }
}

module.exports = {
  replySuccess,
  replyError,
  replyWarning,
  replyInfo,
  safeReply,
  disableComponents,
  createCollector,
  confirmAction,
  DEFAULT_TIMEOUT_MS,
};
