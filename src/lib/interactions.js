const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Embeds = require("./embeds");

// ──────────────────────────────────────────────────────────────────────────
// Reply helpers — every command should use these instead of building
// EmbedBuilder + interaction.reply manually. Consistency wins UX.
// ──────────────────────────────────────────────────────────────────────────

/** Send a success reply. Pass an interaction + a description string. */
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

/** Send an error reply with a human-friendly message (never raw stacks). */
async function replyError(interaction, errorOrMessage, options = {}) {
  const description =
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : Embeds.formatError(errorOrMessage);
  const embed = Embeds.error(interaction.client, {
    title: options.title || "Terjadi kesalahan",
    description,
  });
  // Errors default to ephemeral so we don't pollute the channel.
  const ephemeral = options.ephemeral !== false;
  return safeReply(interaction, { embeds: [embed], ephemeral });
}

/** Warning reply (yellow). */
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

/** Info reply (blurple). */
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

/**
 * Reply that picks the right method depending on interaction state.
 * Discord rejects reply() if already replied/deferred — use editReply or
 * followUp instead. This wrapper hides that complexity.
 */
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied) {
      return await interaction.followUp(payload);
    }
    if (interaction.deferred) {
      // editReply doesn't accept ephemeral — strip it
      const { ephemeral: _e, ...rest } = payload;
      return await interaction.editReply(rest);
    }
    return await interaction.reply(payload);
  } catch (err) {
    // Last-ditch: log and swallow so command errors never crash the handler.
    console.error("[safeReply] Failed to respond:", err.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Component helpers — disable buttons after click, attach timeouts.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Return new ActionRows where every button is disabled. Use after a user
 * clicks a destructive/confirm button so they can't double-fire.
 *
 * Handles ButtonBuilder, StringSelectMenuBuilder, and raw API objects.
 */
function disableComponents(componentRows) {
  if (!Array.isArray(componentRows)) return [];

  return componentRows.map((row) => {
    const newRow = new ActionRowBuilder();
    const components = row.components || [];

    for (const c of components) {
      // Some libraries return raw JSON; normalize via toJSON
      const json = typeof c.toJSON === "function" ? c.toJSON() : c;
      // Recreate as builder so we can mutate safely
      if (json.type === 2 /* Button */) {
        // Skip URL buttons — they don't support disabled toggling cleanly
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

// ──────────────────────────────────────────────────────────────────────────
// Collector helpers — standard 15-minute timeout with friendly message.
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes per UX spec

/**
 * Wrap a message component collector with consistent timeout-end behavior.
 * On timeout we disable all components and show "Sesi berakhir" notice.
 *
 * Usage:
 *   const collector = createCollector(message, {
 *     filter: (i) => i.user.id === interaction.user.id,
 *   });
 *   collector.on('collect', ...);
 */
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
      // Optional notice for true timeouts (not user-driven stop)
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

/**
 * Confirmation prompt — show two buttons (Konfirmasi/Batalkan) and resolve
 * with the user's choice. Auto-disables buttons after click. Handy for
 * destructive actions like clearing queue, cancelling alarm, etc.
 *
 * Returns Promise<"confirm" | "cancel" | "timeout">.
 */
async function confirmAction(interaction, options = {}) {
  const {
    title = "Konfirmasi",
    description = "Yakin ingin melanjutkan?",
    confirmLabel = "Konfirmasi",
    cancelLabel = "Batalkan",
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
  // Reply helpers
  replySuccess,
  replyError,
  replyWarning,
  replyInfo,
  safeReply,
  // Component helpers
  disableComponents,
  createCollector,
  confirmAction,
  // Constants
  DEFAULT_TIMEOUT_MS,
};
