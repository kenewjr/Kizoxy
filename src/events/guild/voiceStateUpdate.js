const { PermissionsBitField, ChannelType } = require("discord.js");
const Logger = require("../../lib/logger");
const tempVcService = require("../../features/tempvc/tempVcService");
const voiceRoleService = require("../../features/tempvc/voiceRoleService");
const interfaceService = require("../../features/tempvc/interfaceService");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("VOICE");

async function handleTempVcEvent(client, oldState, newState) {
  // Same-channel updates (mute/deafen/suppress) are handled elsewhere.
  if (oldState.channelId === newState.channelId) return;
  if (newState.member?.user?.bot || oldState.member?.user?.bot) return;
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  // Generator-join → spawn + empty-leave → delete are both owned by tempVcService.
  await tempVcService.handleVoiceStateUpdate(oldState, newState, client);

  const member = newState.member || oldState.member;
  const guildId = guild.id;

  // JOIN: assign voice roles configured for the destination channel.
  if (
    newState.channelId &&
    newState.channelId !== oldState.channelId &&
    member
  ) {
    voiceRoleService
      .handleVoiceRoleOnJoin(guild, member, newState.channelId)
      .catch((err) => logger.warning(`voice role join failed: ${err.message}`));
  }

  // LEAVE: voice-role cleanup + owner-transfer for surviving TempVCs.
  if (
    oldState.channelId &&
    oldState.channelId !== newState.channelId &&
    member
  ) {
    voiceRoleService
      .handleVoiceRoleOnLeave(guild, member, oldState.channelId)
      .catch((err) =>
        logger.warning(`voice role leave failed: ${err.message}`),
      );

    const tempRecord = await tempVcStorage.getTempChannel(
      guildId,
      oldState.channelId,
    );
    if (tempRecord) {
      const liveChannel =
        guild.channels.cache.get(oldState.channelId) ||
        (await guild.channels.fetch(oldState.channelId).catch(() => null));
      const remaining =
        liveChannel?.members?.filter((m) => !m.user.bot) || null;
      // tempVcService already deletes empty TempVCs; only act here if the
      // owner left but humans remain → hand the channel to the next member.
      if (
        liveChannel &&
        remaining &&
        remaining.size > 0 &&
        tempRecord.ownerId === member.id
      ) {
        const nextOwner = remaining.first();
        if (nextOwner) {
          await tempVcService
            .transferOwnership(guildId, oldState.channelId, nextOwner.id)
            .catch((err) =>
              logger.warning(`auto-transfer failed: ${err.message}`),
            );
          await interfaceService
            .updateInterface(guild, oldState.channelId)
            .catch((err) =>
              logger.warning(
                `panel refresh after transfer failed: ${err.message}`,
              ),
            );
          logger.info(
            `Auto-transferred TempVC ${oldState.channelId} from ${member.id} to ${nextOwner.id}`,
          );
        }
      }
    }
  }
}

async function handleMusicAutoLeave(client, oldState, newState) {
  const player = client.manager.players.get(newState.guild.id);
  if (!player) return;

  if (!newState.guild.members.cache.get(client.user.id).voice.channelId) {
    logger.info(
      `Bot not in voice channel, destroying player for guild ${newState.guild.name}`,
    );
    await player.destroy();
  }

  if (
    newState.channelId &&
    newState.channel.type === ChannelType.GuildStageVoice &&
    newState.guild.members.me.voice.suppress
  ) {
    if (
      newState.guild.members.me.permissions.has(
        PermissionsBitField.Flags.Speak,
      ) ||
      (newState.channel &&
        newState.channel
          .permissionsFor(newState.guild.members.me)
          .has(PermissionsBitField.Flags.Speak))
    ) {
      await delay(2000);

      await newState.guild.members.me.voice
        .setSuppressed(false)
        .catch((err) =>
          logger.warning(
            `Failed to unsuppress in ${newState.guild.name}: ${err.message}`,
          ),
        );
      logger.debug(
        `Stage speaker suppression removed in ${newState.guild.name}`,
      );
    }
  }

  if (oldState.id === client.user.id) return;
  if (!oldState.guild.members.cache.get(client.user.id).voice.channelId) return;

  if (player.data.get("stay")) {
    logger.debug(
      `Player set to stay in voice channel for guild ${newState.guild.name}`,
    );
    return;
  }

  if (
    oldState.guild.members.cache.get(client.user.id).voice.channelId ===
    oldState.channelId
  ) {
    if (
      oldState.guild.members.me.voice?.channel &&
      oldState.guild.members.me.voice.channel.members.filter((m) => !m.user.bot)
        .size === 0
    ) {
      logger.debug(
        `Voice channel empty, scheduling destroy for guild ${newState.guild.name}`,
      );

      await delay(client.config.LEAVE_EMPTY); // 2 minutes

      const vcMembers = oldState.guild.members.me.voice.channel?.members.size;
      if (!vcMembers || vcMembers === 1) {
        if (!player) return;
        logger.info(
          `Destroying player due to empty voice channel in guild ${newState.guild.name}`,
        );
        await player.destroy();
      }
    }
  }
}

module.exports = async (client, oldState, newState) => {
  try {
    await handleTempVcEvent(client, oldState, newState);
  } catch (err) {
    logger.error(`TempVC voiceStateUpdate failed: ${err.message}`);
  }
  try {
    await handleMusicAutoLeave(client, oldState, newState);
  } catch (err) {
    logger.error(`Music voiceStateUpdate failed: ${err.message}`);
  }
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
