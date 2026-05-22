const Embeds = require("../../lib/embeds");
const tempVcStorage = require("../../persistence/tempVcStorage");

async function _replyError(interaction, description) {
  const embed = Embeds.error(interaction.client, {
    title: "Cannot run",
    description,
  });
  if (interaction.deferred || interaction.replied) {
    return interaction
      .editReply({ embeds: [embed], components: [] })
      .catch(() => {});
  }
  return interaction
    .reply({ embeds: [embed], ephemeral: true })
    .catch(() => {});
}

async function validateOwner(interaction) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    await _replyError(
      interaction,
      "You must be inside a Temporary Voice Channel to use this command.",
    );
    return null;
  }
  const tempRecord = await tempVcStorage.getTempChannel(
    interaction.guildId,
    voiceChannel.id,
  );
  if (!tempRecord) {
    await _replyError(
      interaction,
      "This voice channel is not a Temporary Voice Channel.",
    );
    return null;
  }
  if (tempRecord.ownerId !== interaction.user.id) {
    await _replyError(
      interaction,
      `Only the channel owner (<@${tempRecord.ownerId}>) can run this command.`,
    );
    return null;
  }
  return { tempRecord, channel: voiceChannel };
}

async function applyLockState(guild, channel, locked) {
  await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
    Connect: locked ? false : null,
  });
}

async function applyHideState(guild, channel, hidden) {
  await channel.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: hidden ? false : null,
  });
}

async function applyAllowUser(channel, userId) {
  await channel.permissionOverwrites.edit(userId, {
    Connect: true,
    ViewChannel: true,
  });
}

async function applyBanUser(guild, channel, userId) {
  await channel.permissionOverwrites.edit(userId, { Connect: false });
  // Disconnect them right now if they're already inside.
  const member = guild.members.cache.get(userId);
  if (member?.voice?.channelId === channel.id) {
    await member.voice.disconnect("TempVC ban").catch(() => {});
  }
}

async function applyClearUserOverwrite(channel, userId) {
  const overwrite = channel.permissionOverwrites.cache.get(userId);
  if (overwrite) {
    await overwrite.delete("TempVC unban / clear").catch(() => {});
  }
}

module.exports = {
  validateOwner,
  applyLockState,
  applyHideState,
  applyAllowUser,
  applyBanUser,
  applyClearUserOverwrite,
};
