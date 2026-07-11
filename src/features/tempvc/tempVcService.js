const {
  ChannelType,
  PermissionFlagsBits,
  ActivityType,
} = require("discord.js");
const Logger = require("../../lib/logger");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("TempVC");

const MAX_CHANNEL_NAME_LENGTH = 100;
const FALLBACK_CHANNEL_NAME = "Temporary Channel";

// Lazy resolvers — interfaceService and voiceRoleService land in later phases
// and may close back into tempVcService, so we resolve on demand rather than
// require()-ing at module load. Returns an empty object when the dependency
// isn't installed yet; callers must treat its methods as optional.
let _interfaceService = undefined;
function getInterfaceService() {
  if (_interfaceService !== undefined) return _interfaceService;
  try {
    _interfaceService = require("./interfaceService");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND")
      logger.warning(`interfaceService load failed: ${err.message}`);
    _interfaceService = {};
  }
  return _interfaceService;
}

let _voiceRoleService = undefined;
function getVoiceRoleService() {
  if (_voiceRoleService !== undefined) return _voiceRoleService;
  try {
    _voiceRoleService = require("./voiceRoleService");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND")
      logger.warning(`voiceRoleService load failed: ${err.message}`);
    _voiceRoleService = {};
  }
  return _voiceRoleService;
}

async function isGenerator(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const gen = await tempVcStorage.getGenerator(guildId, channelId);
  return Boolean(gen);
}

async function isTempChannel(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const tc = await tempVcStorage.getTempChannel(guildId, channelId);
  return Boolean(tc);
}

async function getChannelCount(guildId, generatorId) {
  const all = await tempVcStorage.getAllTempChannels(guildId);
  return all.filter((c) => c.generatorId === generatorId).length;
}

function sanitizeName(raw) {
  if (!raw) return FALLBACK_CHANNEL_NAME;
  // Strip control chars + zero-width + bidi overrides; collapse whitespace.
  const cleaned = String(raw)
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return FALLBACK_CHANNEL_NAME;
  return cleaned.slice(0, MAX_CHANNEL_NAME_LENGTH);
}

function renderChannelName(template, member, count, guild) {
  const tpl = template || "{username}'s Channel";
  const username = member?.user?.username ?? "user";
  const displayname = member?.displayName ?? username;
  const owner = displayname;

  const playingActivity = member?.presence?.activities?.find(
    (a) => a.type === ActivityType.Playing || a.type === 0,
  );
  const game = playingActivity?.name ?? "Voice";
  const number = String(count ?? 1);
  const guildName = guild?.name ?? "Guild";

  const replaced = tpl
    .replace(/\{username\}/gi, username)
    .replace(/\{displayname\}/gi, displayname)
    .replace(/\{count\}/gi, number)
    .replace(/\{owner\}/gi, owner)
    .replace(/\{game\}/gi, game)
    .replace(/\{number\}/gi, number)
    .replace(/\{guild\}/gi, guildName);

  return sanitizeName(replaced);
}

async function applyTemplate(guild, channel, templateId, guildId) {
  if (!guild || !channel || !templateId) return null;
  try {
    const template = await tempVcStorage.getTemplate(guildId, templateId);
    if (!template) {
      logger.warning(
        `applyTemplate: template ${templateId} not found in ${guildId}`,
      );
      return null;
    }

    const editPayload = {};
    if (template.channelName)
      editPayload.name = sanitizeName(template.channelName);
    if (Number.isInteger(template.limit))
      editPayload.userLimit = template.limit;
    if (Number.isInteger(template.bitrate))
      editPayload.bitrate = template.bitrate;
    if (Object.keys(editPayload).length > 0) {
      await channel.edit(editPayload);
    }

    const everyoneId = guild.roles.everyone.id;
    if (template.isLocked) {
      await channel.permissionOverwrites.edit(everyoneId, { Connect: false });
    } else {
      await channel.permissionOverwrites.edit(everyoneId, { Connect: null });
    }
    if (template.isHidden) {
      await channel.permissionOverwrites.edit(everyoneId, {
        ViewChannel: false,
      });
    } else {
      await channel.permissionOverwrites.edit(everyoneId, {
        ViewChannel: null,
      });
    }

    await tempVcStorage.updateTempChannel(guildId, channel.id, {
      name: editPayload.name ?? channel.name,
      limit: editPayload.userLimit ?? template.limit ?? 0,
      isLocked: Boolean(template.isLocked),
      isHidden: Boolean(template.isHidden),
      templateId,
    });

    return template;
  } catch (err) {
    logger.error(`applyTemplate failed for ${channel?.id}: ${err.message}`);
    return null;
  }
}

async function createTempChannel(guild, member, generator) {
  if (!guild || !member || !generator) return null;
  const guildId = guild.id;
  try {
    const count = (await getChannelCount(guildId, generator.id)) + 1;
    const template = generator.templateId
      ? await tempVcStorage.getTemplate(guildId, generator.templateId)
      : null;
    const pattern = template?.namePattern || generator.defaultName;
    const name = renderChannelName(pattern, member, count, guild);

    const overwrites = [
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
        ],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
        ],
      },
    ];

    const userLimit =
      generator.userLimit !== undefined && generator.userLimit !== null
        ? generator.userLimit
        : (generator.defaultLimit ?? 0);

    const bitrate =
      generator.bitrate !== undefined && generator.bitrate !== null
        ? generator.bitrate * 1000
        : (generator.defaultBitrate ?? 64000);

    const rtcRegion = generator.rtcRegion || null;

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: generator.categoryId || null,
      userLimit,
      bitrate,
      rtcRegion,
      permissionOverwrites: overwrites,
      reason: `TempVC for ${member.user.tag} via generator ${generator.id}`,
    });

    const tempRecord = await tempVcStorage.addTempChannel(guildId, {
      id: channel.id,
      generatorId: generator.id,
      ownerId: member.id,
      name,
      limit: channel.userLimit ?? 0,
      isLocked: false,
      isHidden: false,
      allowedUsers: [],
      bannedUsers: [],
      interfaceMessageId: null,
      interfaceChannelId: null,
      templateId: generator.templateId ?? null,
    });

    try {
      await member.voice.setChannel(channel);
    } catch (moveErr) {
      logger.warning(
        `Could not move ${member.user.tag} into ${channel.id}: ${moveErr.message}`,
      );
    }

    if (generator.templateId) {
      await applyTemplate(guild, channel, generator.templateId, guildId);
    }

    const ifaceSvc = getInterfaceService();
    if (typeof ifaceSvc.sendInterface === "function") {
      // sendInterface(channel, tempChannel, guild) — tempChannel must be the
      // storage record, not the member, otherwise buttons embed member.id
      // as the channelId and every click resolves to a missing channel.
      ifaceSvc
        .sendInterface(channel, tempRecord, guild)
        .catch((err) =>
          logger.warning(
            `sendInterface failed for ${channel.id}: ${err.message}`,
          ),
        );
    }

    const vrSvc = getVoiceRoleService();
    if (typeof vrSvc.assignRolesForChannel === "function") {
      vrSvc
        .assignRolesForChannel(guild, channel, member)
        .catch((err) =>
          logger.warning(
            `assignRolesForChannel failed for ${channel.id}: ${err.message}`,
          ),
        );
    }

    logger.info(
      `Created TempVC ${channel.id} ("${name}") in ${guildId} for ${member.id}`,
    );
    return channel;
  } catch (err) {
    logger.error(`createTempChannel failed in ${guildId}: ${err.message}`);
    return null;
  }
}

async function deleteTempChannel(guild, channel, _client) {
  if (!guild || !channel) return false;
  const guildId = guild.id;
  const channelId = channel.id;
  try {
    const record = await tempVcStorage.getTempChannel(guildId, channelId);

    if (record?.interfaceMessageId && record.interfaceChannelId) {
      try {
        const ifaceChannel = await guild.channels
          .fetch(record.interfaceChannelId)
          .catch(() => null);
        if (ifaceChannel?.isTextBased?.()) {
          const msg = await ifaceChannel.messages
            .fetch(record.interfaceMessageId)
            .catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch (ifaceErr) {
        logger.warning(
          `Interface cleanup failed for ${channelId}: ${ifaceErr.message}`,
        );
      }
    }

    const vrSvc = getVoiceRoleService();
    if (typeof vrSvc.clearRolesForChannel === "function") {
      await vrSvc
        .clearRolesForChannel(guild, channel)
        .catch((err) =>
          logger.warning(
            `clearRolesForChannel failed for ${channelId}: ${err.message}`,
          ),
        );
    }

    if (channel.deletable) {
      await channel.delete(`TempVC empty / cleanup`).catch((err) => {
        logger.warning(
          `Channel delete failed for ${channelId}: ${err.message}`,
        );
      });
    }

    await tempVcStorage.removeTempChannel(guildId, channelId);
    logger.info(`Deleted TempVC ${channelId} in ${guildId}`);
    return true;
  } catch (err) {
    logger.error(`deleteTempChannel failed for ${channelId}: ${err.message}`);
    return false;
  }
}

async function transferOwnership(guildId, channelId, newOwnerId) {
  if (!guildId || !channelId || !newOwnerId) return null;
  try {
    const record = await tempVcStorage.getTempChannel(guildId, channelId);
    if (!record) return null;

    const updated = await tempVcStorage.updateTempChannel(guildId, channelId, {
      ownerId: newOwnerId,
    });

    // Permission/panel sync runs in a side process so storage is the source of
    // truth even if Discord-side updates fail (caller can retry from storage).
    return updated;
  } catch (err) {
    logger.error(`transferOwnership failed for ${channelId}: ${err.message}`);
    return null;
  }
}

async function handleVoiceStateUpdate(oldState, newState, client) {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    const guildId = guild.id;
    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const oldChannel = oldState.channel || null;
    const newChannel = newState.channel || null;

    // Joined a generator → spawn TempVC.
    if (newChannel && (await isGenerator(guildId, newChannel.id))) {
      const generator = await tempVcStorage.getGenerator(
        guildId,
        newChannel.id,
      );
      if (generator) await createTempChannel(guild, member, generator);
    }

    // Left a TempVC → delete if now empty.
    if (oldChannel && oldChannel.id !== newChannel?.id) {
      if (await isTempChannel(guildId, oldChannel.id)) {
        const fresh =
          guild.channels.cache.get(oldChannel.id) ||
          (await guild.channels.fetch(oldChannel.id).catch(() => null));
        const remaining =
          fresh?.members?.filter?.((m) => !m.user.bot)?.size ?? 0;
        if (!fresh || remaining === 0) {
          await deleteTempChannel(guild, fresh || oldChannel, client);
        }
      }
    }
  } catch (err) {
    logger.error(`handleVoiceStateUpdate error: ${err.message}`);
  }
}

module.exports = {
  handleVoiceStateUpdate,
  createTempChannel,
  deleteTempChannel,
  isGenerator,
  isTempChannel,
  transferOwnership,
  applyTemplate,
  renderChannelName,
  getChannelCount,
};
