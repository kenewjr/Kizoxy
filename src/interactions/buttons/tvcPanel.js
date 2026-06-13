// src/interactions/buttons/tvcPanel.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const Logger = require("../../lib/logger");
const Embeds = require("../../lib/embeds");
const tempVcStorage = require("../../persistence/tempVcStorage");
const tempVcService = require("../../features/tempvc/tempVcService");
const helper = require("../../features/tempvc/tempVcHelper");

const logger = new Logger("VC:PanelButtons");

function errEmbed(client, description, title = "Cannot do that") {
  return Embeds.error(client, { title, description });
}
function okEmbed(client, description, title = "Done") {
  return Embeds.success(client, { title, description });
}

async function safeEphemeral(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ ...payload, ephemeral: true }).catch(() => {});
  }
  return interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
}

// Resolve the TempVC owned by the clicking user. Returns { tempRecord, channel }
// or replies with an error and returns null. Unlike tvc.js loadContext, the panel
// has no channelId encoded in the customId — ownership is looked up by userId.
async function loadOwnerContext(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const tempRecord = await tempVcStorage.getTempChannelByOwner(guildId, userId);
  if (!tempRecord) {
    await safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "You don't own a temporary voice channel.",
        ),
      ],
    });
    return null;
  }

  const channel =
    interaction.guild.channels.cache.get(tempRecord.id) ||
    (await interaction.guild.channels.fetch(tempRecord.id).catch(() => null));

  if (!channel) {
    // Ghost record — clean up and inform user.
    await tempVcStorage.removeTempChannel(guildId, tempRecord.id);
    await safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "Your temporary voice channel no longer exists.",
        ),
      ],
    });
    return null;
  }

  return { tempRecord, channel };
}

function buildTextModal({ modalId, label, customId, placeholder, max }) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(max)
    .setPlaceholder(placeholder)
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(modalId)
    .setTitle(label)
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function buildMemberSelect(channel, customId, placeholder) {
  const opts = channel.members
    .filter((m) => !m.user.bot)
    .map((m) => ({
      label: m.displayName.slice(0, 100),
      description: `@${m.user.username}`.slice(0, 100),
      value: m.id,
    }))
    .slice(0, 25);
  if (opts.length === 0) return null;
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(opts);
  return new ActionRowBuilder().addComponents(select);
}

async function refreshPanel(guild, channelId) {
  const { updateInterface } = require("../../features/tempvc/interfaceService");
  await updateInterface(guild, channelId).catch((err) =>
    logger.warning(`interface refresh failed for ${channelId}: ${err.message}`),
  );
}

// ── Button action handlers ───────────────────────────────────────────────────

async function actionLock(interaction, ctx, locked) {
  await helper.applyLockState(interaction.guild, ctx.channel, locked);
  await tempVcStorage.updateTempChannel(
    interaction.guildId,
    ctx.channel.id,
    { isLocked: locked },
  );
  await refreshPanel(interaction.guild, ctx.channel.id);
  await safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        locked ? "Channel locked." : "Channel unlocked.",
      ),
    ],
  });
}

async function actionHide(interaction, ctx, hidden) {
  await helper.applyHideState(interaction.guild, ctx.channel, hidden);
  await tempVcStorage.updateTempChannel(
    interaction.guildId,
    ctx.channel.id,
    { isHidden: hidden },
  );
  await refreshPanel(interaction.guild, ctx.channel.id);
  await safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        hidden ? "Channel hidden." : "Channel visible.",
      ),
    ],
  });
}

async function actionReset(interaction, ctx) {
  // Reset to defaults: unlocked, visible, unlimited.
  await helper.applyLockState(interaction.guild, ctx.channel, false);
  await helper.applyHideState(interaction.guild, ctx.channel, false);
  await ctx.channel.setUserLimit(0).catch(() => {});
  await tempVcStorage.updateTempChannel(
    interaction.guildId,
    ctx.channel.id,
    { isLocked: false, isHidden: false, limit: 0 },
  );
  await refreshPanel(interaction.guild, ctx.channel.id);
  await safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        "Channel reset: unlocked, visible, unlimited.",
        "Reset",
      ),
    ],
  });
}

async function actionClaim(interaction) {
  // Claim ownership if the current owner is no longer in the channel.
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // Check if user is already an owner.
  const existing = await tempVcStorage.getTempChannelByOwner(guildId, userId);
  if (existing) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "You already own a temporary voice channel.",
        ),
      ],
    });
  }

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "You must be inside a temporary voice channel to claim it.",
        ),
      ],
    });
  }

  const tempRecord = await tempVcStorage.getTempChannel(
    guildId,
    voiceChannel.id,
  );
  if (!tempRecord) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "This voice channel is not a temporary voice channel.",
        ),
      ],
    });
  }

  // Only allow claim if the current owner has left.
  const ownerInChannel = voiceChannel.members?.has(tempRecord.ownerId);
  if (ownerInChannel) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          `The current owner (<@${tempRecord.ownerId}>) is still in the channel. Wait for them to leave before claiming.`,
        ),
      ],
    });
  }

  await tempVcService.transferOwnership(guildId, voiceChannel.id, userId);
  await voiceChannel.permissionOverwrites
    .edit(userId, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});
  await refreshPanel(interaction.guild, voiceChannel.id);
  return safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        "You are now the owner of this channel.",
        "Claimed",
      ),
    ],
  });
}

// ── Modal-triggering actions (must NOT defer before showModal) ───────────────

async function actionShowRenameModal(interaction, ctx) {
  const modal = buildTextModal({
    modalId: `tvc:panel:rename-modal:${ctx.channel.id}`,
    label: "Channel Name",
    customId: "newName",
    placeholder: "Enter new channel name...",
    max: 100,
  });
  return interaction.showModal(modal);
}

async function actionShowLimitModal(interaction, ctx) {
  const modal = buildTextModal({
    modalId: `tvc:panel:limit-modal:${ctx.channel.id}`,
    label: "User Limit (0 = unlimited)",
    customId: "limitValue",
    placeholder: "0–99",
    max: 2,
  });
  return interaction.showModal(modal);
}

async function actionShowTransferSelect(interaction, ctx) {
  const row = buildMemberSelect(
    ctx.channel,
    `tvc:panel:transfer-select:${ctx.channel.id}`,
    "Pick the new owner",
  );
  if (!row) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "No eligible members are currently in your channel.",
        ),
      ],
    });
  }
  return safeEphemeral(interaction, {
    embeds: [
      Embeds.info(interaction.client, {
        title: "Transfer ownership",
        description: "Select a member to become the new owner.",
      }),
    ],
    components: [row],
  });
}

async function actionShowKickSelect(interaction, ctx) {
  const row = buildMemberSelect(
    ctx.channel,
    `tvc:panel:kick-select:${ctx.channel.id}`,
    "Pick a member to kick",
  );
  if (!row) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "No eligible members are currently in your channel.",
        ),
      ],
    });
  }
  return safeEphemeral(interaction, {
    embeds: [
      Embeds.info(interaction.client, {
        title: "Kick a member",
        description: "Select a member to disconnect.",
      }),
    ],
    components: [row],
  });
}

// ── Modal submit handlers ────────────────────────────────────────────────────

async function modalRename(interaction, ctx) {
  const raw = interaction.fields.getTextInputValue("newName");
  const cleaned = tempVcService.renderChannelName(raw, interaction.member, 0);
  if (!cleaned) {
    return safeEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, "Name was empty after sanitisation.")],
    });
  }
  await ctx.channel.setName(
    cleaned,
    `TempVC rename via panel by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(
    interaction.guildId,
    ctx.channel.id,
    { name: cleaned },
  );
  await refreshPanel(interaction.guild, ctx.channel.id);
  return safeEphemeral(interaction, {
    embeds: [
      okEmbed(interaction.client, `Channel is now **${cleaned}**.`, "Renamed"),
    ],
  });
}

async function modalLimit(interaction, ctx) {
  const raw = interaction.fields.getTextInputValue("limitValue").trim();
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "Limit must be an integer between 0 and 99.",
        ),
      ],
    });
  }
  await ctx.channel.setUserLimit(
    n,
    `TempVC limit via panel by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(
    interaction.guildId,
    ctx.channel.id,
    { limit: n },
  );
  await refreshPanel(interaction.guild, ctx.channel.id);
  return safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        n === 0 ? "Channel is now unlimited." : `Limit set to ${n}.`,
        "Limit updated",
      ),
    ],
  });
}

// ── Select menu handlers ─────────────────────────────────────────────────────

async function selectKick(interaction, ctx) {
  const userId = interaction.values[0];
  if (userId === interaction.user.id) {
    return safeEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, "You can't kick yourself.")],
    });
  }
  const member = interaction.guild.members.cache.get(userId);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(interaction.client, "That member is no longer in your channel."),
      ],
    });
  }
  await member.voice
    .disconnect(`TempVC kick via panel by ${interaction.user.id}`)
    .catch(() => {});
  return safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> was disconnected.`,
        "Kicked",
      ),
    ],
  });
}

async function selectTransfer(interaction, ctx) {
  const userId = interaction.values[0];
  if (userId === interaction.user.id) {
    return safeEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, "You already own this channel.")],
    });
  }
  const member = interaction.guild.members.cache.get(userId);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "That member is no longer in your channel.",
        ),
      ],
    });
  }
  const updated = await tempVcService.transferOwnership(
    interaction.guildId,
    ctx.channel.id,
    userId,
  );
  if (!updated) {
    return safeEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "Storage refused the transfer; please try again.",
        ),
      ],
    });
  }
  await ctx.channel.permissionOverwrites
    .edit(userId, {
      Connect: true,
      Speak: true,
      ManageChannels: true,
      MoveMembers: true,
    })
    .catch(() => {});
  await refreshPanel(interaction.guild, ctx.channel.id);
  return safeEphemeral(interaction, {
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> is now the owner.`,
        "Ownership transferred",
      ),
    ],
  });
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

async function execute(interaction) {
  try {
    // customId format: tvc:panel:<action>[:<channelId>]
    const parts = interaction.customId.split(":");
    // parts[0]='tvc', parts[1]='panel', parts[2]=action, parts[3]=channelId (modal/select only)
    const action = parts[2];
    const channelId = parts[3] ?? null;

    if (interaction.isButton()) {
      // Claim is the only action that does not require existing ownership.
      if (action === "claim") {
        return actionClaim(interaction);
      }

      // Modal-triggering buttons must NOT defer before showModal.
      if (action === "rename" || action === "limit") {
        const ctx = await loadOwnerContext(interaction);
        if (!ctx) return;
        if (action === "rename") return actionShowRenameModal(interaction, ctx);
        if (action === "limit") return actionShowLimitModal(interaction, ctx);
      }

      if (action === "transfer") {
        const ctx = await loadOwnerContext(interaction);
        if (!ctx) return;
        return actionShowTransferSelect(interaction, ctx);
      }

      if (action === "kick") {
        const ctx = await loadOwnerContext(interaction);
        if (!ctx) return;
        return actionShowKickSelect(interaction, ctx);
      }

      // Toggle/state-change buttons — safe to fire-and-forget ephemeral replies.
      const ctx = await loadOwnerContext(interaction);
      if (!ctx) return;

      if (action === "lock") return actionLock(interaction, ctx, true);
      if (action === "unlock") return actionLock(interaction, ctx, false);
      if (action === "hide") return actionHide(interaction, ctx, true);
      if (action === "show") return actionHide(interaction, ctx, false);
      if (action === "reset") return actionReset(interaction, ctx);

      logger.warning(`tvcPanel: unhandled button action "${action}"`);
      return;
    }

    if (interaction.isModalSubmit()) {
      // channelId is embedded in the modal customId for context.
      if (!channelId) {
        logger.warning(`tvcPanel modal submit missing channelId in ${interaction.customId}`);
        return;
      }
      const tempRecord = await tempVcStorage.getTempChannel(
        interaction.guildId,
        channelId,
      );
      if (!tempRecord || tempRecord.ownerId !== interaction.user.id) {
        return safeEphemeral(interaction, {
          embeds: [
            errEmbed(
              interaction.client,
              "You are no longer the owner of that channel.",
            ),
          ],
        });
      }
      const channel =
        interaction.guild.channels.cache.get(channelId) ||
        (await interaction.guild.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        return safeEphemeral(interaction, {
          embeds: [
            errEmbed(interaction.client, "That channel no longer exists."),
          ],
        });
      }
      const ctx = { tempRecord, channel };
      if (action === "rename-modal") return modalRename(interaction, ctx);
      if (action === "limit-modal") return modalLimit(interaction, ctx);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (!channelId) {
        logger.warning(`tvcPanel select missing channelId in ${interaction.customId}`);
        return;
      }
      const tempRecord = await tempVcStorage.getTempChannel(
        interaction.guildId,
        channelId,
      );
      if (!tempRecord || tempRecord.ownerId !== interaction.user.id) {
        return safeEphemeral(interaction, {
          embeds: [
            errEmbed(
              interaction.client,
              "You are no longer the owner of that channel.",
            ),
          ],
        });
      }
      const channel =
        interaction.guild.channels.cache.get(channelId) ||
        (await interaction.guild.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        return safeEphemeral(interaction, {
          embeds: [
            errEmbed(interaction.client, "That channel no longer exists."),
          ],
        });
      }
      const ctx = { tempRecord, channel };
      if (action === "kick-select") return selectKick(interaction, ctx);
      if (action === "transfer-select") return selectTransfer(interaction, ctx);
      return;
    }
  } catch (err) {
    logger.error(
      `tvcPanel handler failed (${interaction.customId}): ${err.message}`,
    );
    await safeEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, Embeds.formatError(err))],
    });
  }
}

module.exports = {
  name: "tvc:panel",
  execute,
};
