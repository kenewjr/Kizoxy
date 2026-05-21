const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-MEMBER-UPDATE");

module.exports = async (client, oldMember, newMember) => {
  if (!newMember.guild || newMember.user.bot) return;
  if (!client.logStorage) return;

  const logChannelId = client.logStorage.getChannel(newMember.guild.id);
  if (!logChannelId) return;

  const logChannel = newMember.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const baseEmbed = (color) =>
    Embeds.withColor(client, color, {
      author: {
        name: newMember.user.tag,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true }),
      },
      thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
      footerText: `User ID: ${newMember.user.id}`,
    });

  const embeds = [];

  if (oldMember.nickname !== newMember.nickname) {
    const oldNick =
      oldMember.nickname || `*(none — ${oldMember.user.username})*`;
    const newNick =
      newMember.nickname || `*(none — ${newMember.user.username})*`;

    embeds.push(
      baseEmbed(COLORS.WARNING)
        .setTitle("✏️ Nickname Updated")
        .setDescription(`${newMember} updated their nickname.`)
        .addFields(
          { name: "Before", value: `\`${oldNick}\``, inline: true },
          { name: "After", value: `\`${newNick}\``, inline: true },
        ),
    );
  }

  const oldRoleIds = new Set(oldMember.roles.cache.keys());
  const newRoleIds = new Set(newMember.roles.cache.keys());

  const addedRoles = [...newRoleIds]
    .filter((id) => !oldRoleIds.has(id) && id !== newMember.guild.id)
    .map((id) => `<@&${id}>`);
  const removedRoles = [...oldRoleIds]
    .filter((id) => !newRoleIds.has(id) && id !== newMember.guild.id)
    .map((id) => `<@&${id}>`);

  if (addedRoles.length || removedRoles.length) {
    const fields = [];
    if (addedRoles.length) {
      fields.push({
        name: `➕ Added (${addedRoles.length})`,
        value: addedRoles.join(", ").slice(0, 1024),
        inline: false,
      });
    }
    if (removedRoles.length) {
      fields.push({
        name: `➖ Removed (${removedRoles.length})`,
        value: removedRoles.join(", ").slice(0, 1024),
        inline: false,
      });
    }
    embeds.push(
      baseEmbed(COLORS.INFO)
        .setTitle("🔧 Roles Updated")
        .setDescription(`${newMember}'s roles were updated.`)
        .addFields(fields),
    );
  }

  const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
  const newTimeout = newMember.communicationDisabledUntilTimestamp || 0;

  if (oldTimeout !== newTimeout) {
    if (newTimeout > Date.now()) {
      const ts = Math.floor(newTimeout / 1000);
      embeds.push(
        baseEmbed(COLORS.ERROR)
          .setTitle("🔇 Member Timed Out")
          .setDescription(`${newMember} was placed in timeout.`)
          .addFields({
            name: "Timeout Until",
            value: `<t:${ts}:F> (<t:${ts}:R>)`,
            inline: false,
          }),
      );
    } else if (oldTimeout > Date.now()) {
      embeds.push(
        baseEmbed(COLORS.SUCCESS)
          .setTitle("🔊 Timeout Lifted")
          .setDescription(`${newMember}'s timeout was removed.`),
      );
    }
  }

  if (!embeds.length) return;

  for (const embed of embeds) {
    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(
        `Failed to send guildMemberUpdate log in ${newMember.guild.name}: ${err.message}`,
      );
    }
  }
};
