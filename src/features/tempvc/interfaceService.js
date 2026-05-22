const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const Logger = require("../../lib/logger");
const Embeds = require("../../lib/embeds");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("TempVC:Panel");

function statusLabel(tempChannel) {
  if (tempChannel.isHidden) return "👁 Hidden";
  if (tempChannel.isLocked) return "🔒 Locked";
  return "🔓 Open";
}

function buildInterfaceEmbed(tempChannel, guild, client) {
  const ownerLabel = tempChannel.ownerId ? `<@${tempChannel.ownerId}>` : "—";
  const channel = guild?.channels?.cache?.get(tempChannel.id) || null;
  const memberCount = channel?.members?.size ?? 0;
  const limitDisplay = !tempChannel.limit
    ? "Unlimited"
    : String(tempChannel.limit);

  return Embeds.info(client || guild?.client, {
    title: tempChannel.name || channel?.name || "Temporary Channel",
    fields: [
      { name: "Owner", value: ownerLabel, inline: true },
      { name: "Members", value: String(memberCount), inline: true },
      { name: "Status", value: statusLabel(tempChannel), inline: true },
      { name: "Limit", value: limitDisplay, inline: true },
    ],
    footerText: "Temporary Voice Channel",
  });
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

  const row1 = new ActionRowBuilder().addComponents(
    btn("lock", id, "Lock", "🔒", ButtonStyle.Secondary, locked),
    btn("unlock", id, "Unlock", "🔓", ButtonStyle.Secondary, !locked),
    btn("hide", id, "Hide", "👁", ButtonStyle.Secondary, hidden),
    btn("show", id, "Show", "👀", ButtonStyle.Secondary, !hidden),
    btn("rename", id, "Rename", "✏️", ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn("limit", id, "Limit", "👤", ButtonStyle.Primary),
    btn("allow", id, "Allow", "➕", ButtonStyle.Success),
    btn("kick", id, "Kick", "➖", ButtonStyle.Secondary),
    btn("ban", id, "Ban", "🚫", ButtonStyle.Danger),
    btn("transfer", id, "Transfer", "👑", ButtonStyle.Primary),
  );

  return [row1, row2];
}

async function sendInterface(channel, tempChannel, guild) {
  if (!channel || !channel.isTextBased?.()) {
    logger.warning(`sendInterface called on non-text channel ${channel?.id}`);
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
  if (!ifaceChannel?.isTextBased?.()) return null;
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
        const edited = await existing.edit({ embeds: [embed], components });
        return edited;
      } catch (editErr) {
        logger.warning(
          `Edit interface failed for ${tempChannelId}: ${editErr.message}`,
        );
      }
    }

    // Message missing or edit failed → repost into the TempVC itself.
    const voiceChannel =
      guild.channels.cache.get(tempChannelId) ||
      (await guild.channels.fetch(tempChannelId).catch(() => null));
    if (!voiceChannel?.isTextBased?.()) {
      logger.debug(
        `updateInterface: voice channel ${tempChannelId} cannot host text`,
      );
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
