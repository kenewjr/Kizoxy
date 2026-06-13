// src/features/tempvc/panelService.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } =
  require("discord.js");
const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("TempVC:PanelSvc");

function buildPanelEmbed(client) {
  return Embeds.brand(client, {
    title: "Voice Channel Control Panel",
    description:
      "Use the buttons below to manage your temporary voice channel.\n" +
      "You must own a temp VC to use these controls.",
    thumbnailUrl: client.user?.displayAvatarURL() ?? undefined,
    footerText: "Kizoxy • Changes apply to your active temp VC only",
  });
}

function panelBtn(action, label, emoji, style) {
  return new ButtonBuilder()
    .setCustomId(`tvc:panel:${action}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style);
}

function buildPanelRows() {
  const row1 = new ActionRowBuilder().addComponents(
    panelBtn("lock", "Lock", "🔒", ButtonStyle.Secondary),
    panelBtn("unlock", "Unlock", "🔓", ButtonStyle.Secondary),
    panelBtn("hide", "Hide", "🙈", ButtonStyle.Secondary),
    panelBtn("show", "Show", "👁", ButtonStyle.Secondary),
    panelBtn("reset", "Reset", "🔄", ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    panelBtn("rename", "Rename", "✏️", ButtonStyle.Primary),
    panelBtn("limit", "Set Limit", "👤", ButtonStyle.Primary),
    panelBtn("kick", "Kick", "🚫", ButtonStyle.Danger),
    panelBtn("transfer", "Transfer", "👑", ButtonStyle.Primary),
    panelBtn("claim", "Claim", "📥", ButtonStyle.Secondary),
  );

  return [row1, row2];
}

// Lock the panel channel: deny @everyone SendMessages, allow bot.
async function _lockChannel(channel, guild) {
  const botId = guild.members.me?.id;
  if (!botId) return;
  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
      SendMessages: false,
    });
    await channel.permissionOverwrites.edit(botId, {
      SendMessages: true,
      ViewChannel: true,
    });
  } catch (err) {
    logger.warning(`Failed to lock panel channel ${channel.id}: ${err.message}`);
  }
}

async function sendPanel(client, guild, channel) {
  const embed = buildPanelEmbed(client);
  const rows = buildPanelRows();

  let message;
  try {
    message = await channel.send({ embeds: [embed], components: rows });
  } catch (err) {
    logger.error(`sendPanel: could not send to ${channel.id}: ${err.message}`);
    return null;
  }

  await tempVcStorage.setPanelConfig(guild.id, channel.id, message.id);
  await _lockChannel(channel, guild);

  logger.info(
    `Panel sent in guild ${guild.id} → channel ${channel.id} msg ${message.id}`,
  );
  return message;
}

async function refreshPanel(client, guild) {
  const config = await tempVcStorage.getPanelConfig(guild.id);
  if (!config.panelChannelId) return null;

  const channel =
    guild.channels.cache.get(config.panelChannelId) ||
    (await guild.channels.fetch(config.panelChannelId).catch(() => null));

  if (!channel) {
    // Panel channel was deleted.
    logger.warning(
      `refreshPanel: panel channel ${config.panelChannelId} not found in ${guild.id}; clearing config`,
    );
    await tempVcStorage.clearPanelConfig(guild.id);
    return null;
  }

  if (config.panelMessageId) {
    const existing = await channel.messages
      .fetch(config.panelMessageId)
      .catch(() => null);

    if (existing) {
      const embed = buildPanelEmbed(client);
      const rows = buildPanelRows();
      try {
        await existing.edit({ embeds: [embed], components: rows });
        logger.info(`Panel edited in guild ${guild.id} msg ${existing.id}`);
        return existing;
      } catch (err) {
        logger.warning(
          `refreshPanel: edit failed for ${existing.id}: ${err.message}; re-sending`,
        );
      }
    }
  }

  // Message missing or edit failed → re-send.
  return sendPanel(client, guild, channel);
}

async function removePanel(client, guild) {
  const config = await tempVcStorage.getPanelConfig(guild.id);
  if (!config.panelChannelId) return false;

  if (config.panelChannelId && config.panelMessageId) {
    const channel =
      guild.channels.cache.get(config.panelChannelId) ||
      (await guild.channels.fetch(config.panelChannelId).catch(() => null));
    if (channel) {
      const msg = await channel.messages
        .fetch(config.panelMessageId)
        .catch(() => null);
      if (msg) {
        await msg.delete().catch((err) =>
          logger.warning(`removePanel: delete msg failed: ${err.message}`),
        );
      }
    }
  }

  await tempVcStorage.clearPanelConfig(guild.id);
  logger.info(`Panel removed for guild ${guild.id}`);
  return true;
}

// Called from loadTempVC at boot. Silently no-ops if no panel is configured.
async function healPanel(client, guild) {
  const config = await tempVcStorage.getPanelConfig(guild.id);
  if (!config.panelChannelId) return;

  const channel =
    guild.channels.cache.get(config.panelChannelId) ||
    (await guild.channels.fetch(config.panelChannelId).catch(() => null));

  if (!channel) {
    logger.warning(
      `healPanel: panel channel ${config.panelChannelId} gone in guild ${guild.id}; clearing`,
    );
    await tempVcStorage.clearPanelConfig(guild.id);
    return;
  }

  if (config.panelMessageId) {
    const msg = await channel.messages
      .fetch(config.panelMessageId)
      .catch(() => null);
    if (msg) {
      // Message still exists — ensure it has the latest embed/buttons.
      const embed = buildPanelEmbed(client);
      const rows = buildPanelRows();
      await msg.edit({ embeds: [embed], components: rows }).catch((err) =>
        logger.warning(`healPanel: edit failed for ${msg.id}: ${err.message}`),
      );
      logger.info(`Panel healed (edit) for guild ${guild.id}`);
      return;
    }
  }

  // Message gone → re-send.
  const newMsg = await sendPanel(client, guild, channel);
  if (newMsg) {
    logger.info(`Panel healed (re-sent) for guild ${guild.id} → msg ${newMsg.id}`);
  }
}

module.exports = {
  sendPanel,
  refreshPanel,
  removePanel,
  healPanel,
};
