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
const interfaceService = require("../../features/tempvc/interfaceService");
const helper = require("../../features/tempvc/tempVcHelper");

const logger = new Logger("VC:Buttons");

function errEmbed(client, description, title = "Cannot do that") {
  return Embeds.error(client, { title, description });
}
function okEmbed(client, description, title = "Done") {
  return Embeds.success(client, { title, description });
}

async function ensureDeferred(interaction, mode) {
  if (interaction.deferred || interaction.replied) return;
  if (mode === "update") return interaction.deferUpdate().catch(() => {});
  return interaction.deferReply({ ephemeral: true }).catch(() => {});
}

async function safeReplyEphemeral(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction
      .followUp({ ...payload, ephemeral: true })
      .catch(() => {});
  }
  return interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
}

async function loadContext(interaction, channelId) {
  const guild = interaction.guild;
  const channel =
    guild.channels.cache.get(channelId) ||
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    // Channel was deleted manually outside our flow → drop ghost record.
    await tempVcStorage.removeTempChannel(interaction.guildId, channelId);
    await safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "This channel no longer exists. The panel will go stale.",
        ),
      ],
    });
    return null;
  }
  const tempRecord = await tempVcStorage.getTempChannel(
    interaction.guildId,
    channelId,
  );
  if (!tempRecord) {
    await safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "This channel is no longer a Temporary Voice Channel.",
        ),
      ],
    });
    return null;
  }
  if (tempRecord.ownerId !== interaction.user.id) {
    await safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          `Only the channel owner (<@${tempRecord.ownerId}>) can use these controls.`,
        ),
      ],
    });
    return null;
  }
  return { tempRecord, channel };
}

async function refreshPanel(guild, channelId) {
  await interfaceService
    .updateInterface(guild, channelId)
    .catch((err) =>
      logger.warning(`panel refresh failed for ${channelId}: ${err.message}`),
    );
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

async function actionLock(interaction, ctx, locked) {
  await ensureDeferred(interaction, "update");
  await helper.applyLockState(interaction.guild, ctx.channel, locked);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    isLocked: locked,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  await interaction
    .followUp({
      embeds: [
        okEmbed(
          interaction.client,
          locked ? "Channel locked." : "Channel unlocked.",
        ),
      ],
      ephemeral: true,
    })
    .catch(() => {});
}

async function actionHide(interaction, ctx, hidden) {
  await ensureDeferred(interaction, "update");
  await helper.applyHideState(interaction.guild, ctx.channel, hidden);
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    isHidden: hidden,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  await interaction
    .followUp({
      embeds: [
        okEmbed(
          interaction.client,
          hidden ? "Channel hidden." : "Channel visible.",
        ),
      ],
      ephemeral: true,
    })
    .catch(() => {});
}

async function actionShowRenameModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:rename-modal:${channelId}`,
    label: "Channel Name",
    customId: "newName",
    placeholder: "Enter new channel name...",
    max: 100,
  });
  await interaction.showModal(modal);
}

async function actionShowLimitModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:limit-modal:${channelId}`,
    label: "User Limit (0 = unlimited)",
    customId: "limitValue",
    placeholder: "0-99",
    max: 2,
  });
  await interaction.showModal(modal);
}

async function actionShowAllowModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:allow-modal:${channelId}`,
    label: "Allow user",
    customId: "userIdOrMention",
    placeholder: "User ID or @mention",
    max: 100,
  });
  await interaction.showModal(modal);
}

async function actionShowBanModal(interaction, channelId) {
  const modal = buildTextModal({
    modalId: `tvc:ban-modal:${channelId}`,
    label: "Ban user",
    customId: "userIdOrMention",
    placeholder: "User ID or @mention",
    max: 100,
  });
  await interaction.showModal(modal);
}

async function actionShowMemberSelect(interaction, ctx, kind) {
  const customId = `tvc:${kind}-select:${ctx.channel.id}`;
  const placeholder =
    kind === "kick" ? "Pick a member to kick" : "Pick the new owner";
  const row = buildMemberSelect(ctx.channel, customId, placeholder);
  if (!row) {
    return safeReplyEphemeral(interaction, {
      embeds: [
        errEmbed(
          interaction.client,
          "No eligible members are currently in this channel.",
        ),
      ],
    });
  }
  await safeReplyEphemeral(interaction, {
    embeds: [
      Embeds.info(interaction.client, {
        title: kind === "kick" ? "Kick a member" : "Transfer ownership",
        description: "Pick a member from the list below.",
      }),
    ],
    components: [row],
  });
}

function parseUserId(raw) {
  const trimmed = String(raw).trim();
  const mention = trimmed.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;
  return null;
}

async function modalRename(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("newName");
  const cleaned = tempVcService.renderChannelName(raw, interaction.member, 0);
  if (!cleaned) {
    return interaction.editReply({
      embeds: [
        errEmbed(interaction.client, "Name was empty after sanitisation."),
      ],
    });
  }
  await ctx.channel.setName(
    cleaned,
    `TempVC rename via panel by ${interaction.user.id}`,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    name: cleaned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(interaction.client, `Channel is now **${cleaned}**.`, "Renamed"),
    ],
  });
}

async function modalLimit(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("limitValue").trim();
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    return interaction.editReply({
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
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    limit: n,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(
        interaction.client,
        n === 0 ? "Channel is now unlimited." : `Limit set to ${n}.`,
        "Limit updated",
      ),
    ],
  });
}

async function modalAllow(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("userIdOrMention");
  const userId = parseUserId(raw);
  if (!userId) {
    return interaction.editReply({
      embeds: [
        errEmbed(
          interaction.client,
          "Could not parse a user ID or mention from your input.",
        ),
      ],
    });
  }
  await helper.applyAllowUser(ctx.channel, userId);
  const allowed = Array.from(
    new Set([...(ctx.tempRecord.allowedUsers || []), userId]),
  );
  const banned = (ctx.tempRecord.bannedUsers || []).filter(
    (id) => id !== userId,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    allowedUsers: allowed,
    bannedUsers: banned,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(interaction.client, `<@${userId}> can now join.`, "Allowed"),
    ],
  });
}

async function modalBan(interaction, ctx) {
  await ensureDeferred(interaction, "reply");
  const raw = interaction.fields.getTextInputValue("userIdOrMention");
  const userId = parseUserId(raw);
  if (!userId) {
    return interaction.editReply({
      embeds: [
        errEmbed(
          interaction.client,
          "Could not parse a user ID or mention from your input.",
        ),
      ],
    });
  }
  if (userId === interaction.user.id) {
    return interaction.editReply({
      embeds: [errEmbed(interaction.client, "You can't ban yourself.")],
    });
  }
  await helper.applyBanUser(interaction.guild, ctx.channel, userId);
  const banned = Array.from(
    new Set([...(ctx.tempRecord.bannedUsers || []), userId]),
  );
  const allowed = (ctx.tempRecord.allowedUsers || []).filter(
    (id) => id !== userId,
  );
  await tempVcStorage.updateTempChannel(interaction.guildId, ctx.channel.id, {
    bannedUsers: banned,
    allowedUsers: allowed,
  });
  await refreshPanel(interaction.guild, ctx.channel.id);
  return interaction.editReply({
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> has been banned from this channel.`,
        "Banned",
      ),
    ],
  });
}

async function selectKick(interaction, ctx) {
  await ensureDeferred(interaction, "update");
  const userId = interaction.values[0];
  if (userId === interaction.user.id) {
    return interaction.followUp({
      embeds: [errEmbed(interaction.client, "You can't kick yourself.")],
      ephemeral: true,
    });
  }
  const member = interaction.guild.members.cache.get(userId);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return interaction.followUp({
      embeds: [
        errEmbed(
          interaction.client,
          "That member is no longer in the channel.",
        ),
      ],
      ephemeral: true,
    });
  }
  await member.voice
    .disconnect(`TempVC kick via panel by ${interaction.user.id}`)
    .catch(() => {});
  await interaction.followUp({
    embeds: [
      okEmbed(interaction.client, `<@${userId}> was disconnected.`, "Kicked"),
    ],
    ephemeral: true,
  });
}

async function selectTransfer(interaction, ctx) {
  await ensureDeferred(interaction, "update");
  const userId = interaction.values[0];
  if (userId === interaction.user.id) {
    return interaction.followUp({
      embeds: [errEmbed(interaction.client, "You already own this channel.")],
      ephemeral: true,
    });
  }
  const member = interaction.guild.members.cache.get(userId);
  if (!member || member.voice?.channelId !== ctx.channel.id) {
    return interaction.followUp({
      embeds: [
        errEmbed(
          interaction.client,
          "That member is no longer in the channel.",
        ),
      ],
      ephemeral: true,
    });
  }
  const updated = await tempVcService.transferOwnership(
    interaction.guildId,
    ctx.channel.id,
    userId,
  );
  if (!updated) {
    return interaction.followUp({
      embeds: [
        errEmbed(
          interaction.client,
          "Storage refused the transfer; please try again.",
        ),
      ],
      ephemeral: true,
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
  await interaction.followUp({
    embeds: [
      okEmbed(
        interaction.client,
        `<@${userId}> is now the owner.`,
        "Ownership transferred",
      ),
    ],
    ephemeral: true,
  });
}

function parseCustomId(customId) {
  const parts = customId.split(":");
  if (parts[0] !== "tvc") return null;
  return { action: parts[1], channelId: parts[2] };
}

async function execute(interaction) {
  try {
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;
    const { action, channelId } = parsed;
    if (!channelId) return;

    // Buttons that open a modal MUST not defer first.
    if (interaction.isButton?.()) {
      if (action === "rename") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return actionShowRenameModal(interaction, channelId);
      }
      if (action === "limit") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return actionShowLimitModal(interaction, channelId);
      }
      if (action === "allow") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return actionShowAllowModal(interaction, channelId);
      }
      if (action === "ban") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return actionShowBanModal(interaction, channelId);
      }
      if (action === "kick" || action === "transfer") {
        const ctx = await loadContext(interaction, channelId);
        if (!ctx) return;
        return actionShowMemberSelect(interaction, ctx, action);
      }
      // Toggle actions: defer-update first then mutate + refresh.
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      if (action === "lock") return actionLock(interaction, ctx, true);
      if (action === "unlock") return actionLock(interaction, ctx, false);
      if (action === "hide") return actionHide(interaction, ctx, true);
      if (action === "show") return actionHide(interaction, ctx, false);
      return;
    }

    if (interaction.isModalSubmit?.()) {
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      if (action === "rename-modal") return modalRename(interaction, ctx);
      if (action === "limit-modal") return modalLimit(interaction, ctx);
      if (action === "allow-modal") return modalAllow(interaction, ctx);
      if (action === "ban-modal") return modalBan(interaction, ctx);
      return;
    }

    if (interaction.isStringSelectMenu?.()) {
      const ctx = await loadContext(interaction, channelId);
      if (!ctx) return;
      if (action === "kick-select") return selectKick(interaction, ctx);
      if (action === "transfer-select") return selectTransfer(interaction, ctx);
      return;
    }
  } catch (err) {
    logger.error(
      `tvc handler failed (${interaction.customId}): ${err.message}`,
    );
    await safeReplyEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, Embeds.formatError(err))],
    });
  }
}

module.exports = {
  name: "tvc",
  execute,
};
