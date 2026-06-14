const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const Logger = require("../../lib/logger");
const Embeds = require("../../lib/embeds");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("TempVC:Interface");

function buildInterfaceEmbed(tempChannel, guild, client) {
  const ownerMember = tempChannel.ownerId
    ? guild?.members?.cache?.get(tempChannel.ownerId)
    : null;
  const ownerLabel = tempChannel.ownerId ? `<@${tempChannel.ownerId}>` : "—";
  const avatarUrl = ownerMember?.displayAvatarURL() ?? null;

  const voiceChannel = guild?.channels?.cache?.get(tempChannel.id) ?? null;
  const memberCount = voiceChannel?.members?.size ?? 0;

  const locked = Boolean(tempChannel.isLocked);
  const hidden = Boolean(tempChannel.isHidden);
  const limitDisplay =
    !tempChannel.limit || tempChannel.limit === 0
      ? "Unlimited"
      : String(tempChannel.limit);

  const statusParts = [];
  statusParts.push(locked ? "🔒 Locked" : "🔓 Open");
  statusParts.push(hidden ? "🙈 Hidden" : "👁 Visible");

  const embed = Embeds.brand(client || guild?.client, {
    title: tempChannel.name || voiceChannel?.name || "Temporary Channel",
    fields: [
      { name: "Owner", value: ownerLabel, inline: true },
      { name: "Members", value: String(memberCount), inline: true },
      { name: "Status", value: statusParts.join(" · "), inline: true },
      { name: "User Limit", value: limitDisplay, inline: true },
    ],
    footerText: "Only the channel owner can use these controls.",
    thumbnailUrl: avatarUrl ?? undefined,
  });

  return embed;
}

function btn(action, channelId, label, emoji, style, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(`tvc:${action}:${channelId}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style)
    .setDisabled(disabled);
}

function buildInterfaceButtons(tempChannel) {
  const id = tempChannel.id;
  const locked = Boolean(tempChannel.isLocked);
  const hidden = Boolean(tempChannel.isHidden);

  // Row 1 — Privacy controls
  const row1 = new ActionRowBuilder().addComponents(
    btn("lock", id, "Lock", "🔒", ButtonStyle.Secondary, locked),
    btn("unlock", id, "Unlock", "🔓", ButtonStyle.Secondary, !locked),
    btn("hide", id, "Hide", "🙈", ButtonStyle.Secondary, hidden),
    btn("show", id, "Show", "👁", ButtonStyle.Secondary, !hidden),
    btn("reset", id, "Reset", "🔄", ButtonStyle.Secondary),
  );

  // Row 2 — Member management
  const row2 = new ActionRowBuilder().addComponents(
    btn("allow", id, "Allow", "➕", ButtonStyle.Success),
    btn("ban", id, "Ban", "🚫", ButtonStyle.Danger),
    btn("kick", id, "Kick", "🦵", ButtonStyle.Secondary),
    btn("transfer", id, "Transfer", "👑", ButtonStyle.Primary),
    btn("claim", id, "Claim", "📋", ButtonStyle.Secondary),
  );

  // Row 3 — Channel settings
  const row3 = new ActionRowBuilder().addComponents(
    btn("rename", id, "Rename", "✏️", ButtonStyle.Primary),
    btn("limit", id, "Limit", "🔢", ButtonStyle.Primary),
    btn("muteall", id, "Mute All", "🔇", ButtonStyle.Secondary),
    btn("unbanall", id, "Unban All", "👂", ButtonStyle.Secondary),
    btn("pininfo", id, "Pin Info", "📌", ButtonStyle.Secondary),
  );

  return [row1, row2, row3];
}

async function sendInterface(channel, tempChannel, guild) {
  if (!channel) {
    logger.warning(`sendInterface called with null channel`);
    return null;
  }
  try {
    const embed = buildInterfaceEmbed(
      tempChannel,
      guild || channel.guild,
      channel.client,
    );
    const components = buildInterfaceButtons(tempChannel);
    const message = await channel.send({ embeds: [embed], components });
    await tempVcStorage.updateTempChannel(channel.guild.id, tempChannel.id, {
      interfaceMessageId: message.id,
      interfaceChannelId: message.channel.id,
    });
    logger.info(
      `Sent interface panel for ${tempChannel.id} (msg ${message.id})`,
    );
    return message;
  } catch (err) {
    logger.error(`sendInterface failed for ${tempChannel?.id}: ${err.message}`);
    return null;
  }
}

async function _fetchInterfaceMessage(guild, tempChannel) {
  if (!tempChannel.interfaceMessageId || !tempChannel.interfaceChannelId)
    return null;
  const ifaceChannel =
    guild.channels.cache.get(tempChannel.interfaceChannelId) ||
    (await guild.channels
      .fetch(tempChannel.interfaceChannelId)
      .catch(() => null));
  if (!ifaceChannel) return null;
  return ifaceChannel.messages
    .fetch(tempChannel.interfaceMessageId)
    .catch(() => null);
}

async function updateInterface(guild, tempChannelId) {
  if (!guild || !tempChannelId) return null;
  try {
    const tempChannel = await tempVcStorage.getTempChannel(
      guild.id,
      tempChannelId,
    );
    if (!tempChannel) {
      logger.debug(`updateInterface: no record for ${tempChannelId}`);
      return null;
    }

    const embed = buildInterfaceEmbed(tempChannel, guild, guild.client);
    const components = buildInterfaceButtons(tempChannel);

    const existing = await _fetchInterfaceMessage(guild, tempChannel);
    if (existing) {
      try {
        return await existing.edit({ embeds: [embed], components });
      } catch (editErr) {
        logger.warning(
          `Edit interface failed for ${tempChannelId}: ${editErr.message}`,
        );
      }
    }

    // Message missing or edit failed → repost into the TempVC itself.
    // GuildVoice channels always support send() via text-in-vc in DJS v14.
    const voiceChannel =
      guild.channels.cache.get(tempChannelId) ||
      (await guild.channels.fetch(tempChannelId).catch(() => null));
    if (!voiceChannel) {
      logger.debug(`updateInterface: voice channel ${tempChannelId} not found`);
      return null;
    }
    return sendInterface(voiceChannel, tempChannel, guild);
  } catch (err) {
    logger.error(`updateInterface failed for ${tempChannelId}: ${err.message}`);
    return null;
  }
}

async function deleteInterface(guild, tempChannel) {
  if (!guild || !tempChannel) return false;
  try {
    const message = await _fetchInterfaceMessage(guild, tempChannel);
    if (message) {
      await message
        .delete()
        .catch((err) =>
          logger.warning(
            `deleteInterface message delete failed: ${err.message}`,
          ),
        );
    }
    await tempVcStorage.updateTempChannel(guild.id, tempChannel.id, {
      interfaceMessageId: null,
      interfaceChannelId: null,
    });
    return true;
  } catch (err) {
    logger.error(
      `deleteInterface failed for ${tempChannel?.id}: ${err.message}`,
    );
    return false;
  }
}

module.exports = {
  buildInterfaceEmbed,
  buildInterfaceButtons,
  sendInterface,
  updateInterface,
  deleteInterface,
};
