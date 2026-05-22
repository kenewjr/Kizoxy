const Logger = require("../../lib/logger");
const tempVcStorage = require("../../persistence/tempVcStorage");

const logger = new Logger("TempVC:Roles");

async function getMemberOwnedTempChannel(guildId, memberId) {
  return tempVcStorage.getTempChannelByOwner(guildId, memberId);
}

async function applicableRoles(guildId, channelId, member) {
  const all = await tempVcStorage.getVoiceRolesForChannel(guildId, channelId);
  if (all.length === 0) return [];
  const owned = await getMemberOwnedTempChannel(guildId, member.id);
  return all.filter((vr) => {
    if (!vr.ownerOnly) return true;
    return owned && owned.id === channelId;
  });
}

async function assignVoiceRoles(guild, member, channelId) {
  if (!guild || !member || !channelId) return [];
  try {
    const targets = await applicableRoles(guild.id, channelId, member);
    if (targets.length === 0) return [];

    const assigned = [];
    for (const vr of targets) {
      const role =
        guild.roles.cache.get(vr.roleId) ||
        (await guild.roles.fetch(vr.roleId).catch(() => null));
      if (!role) {
        logger.warning(
          `Voice role ${vr.roleId} not found in guild ${guild.id}`,
        );
        continue;
      }
      if (member.roles.cache.has(role.id)) continue;
      try {
        await member.roles.add(
          role,
          `TempVC voice role for channel ${channelId}`,
        );
        assigned.push(role.id);
        logger.info(
          `Assigned role ${role.id} to ${member.id} via channel ${channelId}`,
        );
      } catch (err) {
        logger.warning(
          `Failed to assign role ${role.id} to ${member.id}: ${err.message}`,
        );
      }
    }
    return assigned;
  } catch (err) {
    logger.error(`assignVoiceRoles failed in ${guild?.id}: ${err.message}`);
    return [];
  }
}

async function removeVoiceRoles(guild, member, channelId) {
  if (!guild || !member || !channelId) return [];
  try {
    const granted = await applicableRoles(guild.id, channelId, member);
    if (granted.length === 0) return [];

    // The member is allowed to keep a roleId if any voice channel they are
    // currently in (or any other generator/TempVC they own + ownerOnly entry)
    // also grants that exact roleId.
    const stillActiveChannelId = member.voice?.channelId || null;
    let stillActiveRoles = new Set();
    if (stillActiveChannelId && stillActiveChannelId !== channelId) {
      const others = await applicableRoles(
        guild.id,
        stillActiveChannelId,
        member,
      );
      stillActiveRoles = new Set(others.map((vr) => vr.roleId));
    }

    const removed = [];
    for (const vr of granted) {
      if (stillActiveRoles.has(vr.roleId)) {
        logger.debug(
          `Keeping role ${vr.roleId} on ${member.id} (active in another channel)`,
        );
        continue;
      }
      const role = guild.roles.cache.get(vr.roleId);
      if (!role || !member.roles.cache.has(vr.roleId)) continue;
      try {
        await member.roles.remove(
          role,
          `TempVC voice role cleanup for channel ${channelId}`,
        );
        removed.push(role.id);
        logger.info(
          `Removed role ${role.id} from ${member.id} after leaving ${channelId}`,
        );
      } catch (err) {
        logger.warning(
          `Failed to remove role ${role.id} from ${member.id}: ${err.message}`,
        );
      }
    }
    return removed;
  } catch (err) {
    logger.error(`removeVoiceRoles failed in ${guild?.id}: ${err.message}`);
    return [];
  }
}

async function handleVoiceRoleOnJoin(guild, member, channelId) {
  return assignVoiceRoles(guild, member, channelId);
}

async function handleVoiceRoleOnLeave(guild, member, channelId) {
  return removeVoiceRoles(guild, member, channelId);
}

// Helpers used by tempVcService for the channel-level cleanup path.
async function assignRolesForChannel(guild, channel, member) {
  return assignVoiceRoles(guild, member, channel.id);
}

async function clearRolesForChannel(guild, channel) {
  if (!guild || !channel) return;
  try {
    const members = channel.members?.values?.()
      ? [...channel.members.values()]
      : [];
    for (const m of members) {
      await removeVoiceRoles(guild, m, channel.id);
    }
  } catch (err) {
    logger.warning(
      `clearRolesForChannel failed for ${channel?.id}: ${err.message}`,
    );
  }
}

module.exports = {
  assignVoiceRoles,
  removeVoiceRoles,
  handleVoiceRoleOnJoin,
  handleVoiceRoleOnLeave,
  assignRolesForChannel,
  clearRolesForChannel,
};
