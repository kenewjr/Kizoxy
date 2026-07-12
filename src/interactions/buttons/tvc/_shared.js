const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Logger = require("../../../lib/logger");
const Embeds = require("../../../lib/embeds");
const tempVcStorage = require("../../../persistence/tempVcStorage");
const interfaceService = require("../../../features/tempvc/interfaceService");

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

async function loadChannelRecord(interaction, channelId) {
  const guild = interaction.guild;
  const channel =
    guild.channels.cache.get(channelId) ||
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) {
    await tempVcStorage.removeTempChannel(interaction.guildId, channelId);
    await safeReplyEphemeral(interaction, {
      embeds: [errEmbed(interaction.client, "This channel no longer exists.")],
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

function parseUserId(raw) {
  const trimmed = String(raw).trim();
  const mention = trimmed.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;
  return null;
}

module.exports = {
  errEmbed,
  okEmbed,
  ensureDeferred,
  safeReplyEphemeral,
  loadContext,
  loadChannelRecord,
  refreshPanel,
  buildTextModal,
  buildMemberSelect,
  parseUserId,
  logger,
};
