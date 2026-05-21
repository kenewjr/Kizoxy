const { EmbedBuilder } = require("discord.js");
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-MEMBER-UPDATE");

/**
 * Fires when a guild member is mutated server-side: nickname change,
 * role grant/revoke, timeout, server avatar swap, etc.
 */
module.exports = async (client, oldMember, newMember) => {
  if (!newMember.guild || newMember.user.bot) return;
  if (!client.logStorage) return;

  const logChannelId = client.logStorage.getChannel(newMember.guild.id);
  if (!logChannelId) return;

  const logChannel = newMember.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const baseEmbed = () =>
    new EmbedBuilder()
      .setAuthor({
        name: newMember.user.tag,
        iconURL: newMember.user.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(
        newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
      )
      .setFooter({ text: `User ID: ${newMember.user.id}` })
      .setTimestamp();

  const embeds = [];

  // ── Nickname change ────────────────────────────────────────────────
  if (oldMember.nickname !== newMember.nickname) {
    const oldNick =
      oldMember.nickname || `*(none — ${oldMember.user.username})*`;
    const newNick =
      newMember.nickname || `*(none — ${newMember.user.username})*`;

    embeds.push(
      baseEmbed()
        .setTitle("✏️ Nickname Updated")
        .setDescription(`${newMember} updated their nickname.`)
        .setColor("Orange")
        .addFields(
          { name: "Before", value: `\`${oldNick}\``, inline: true },
          { name: "After", value: `\`${newNick}\``, inline: true },
        ),
    );
  }

  // ── Role change ────────────────────────────────────────────────────
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
      baseEmbed()
        .setTitle("🔧 Roles Updated")
        .setDescription(`${newMember}'s roles were updated.`)
        .setColor("Blue")
        .addFields(fields),
    );
  }

  // ── Timeout (communicationDisabledUntil) ───────────────────────────
  const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
  const newTimeout = newMember.communicationDisabledUntilTimestamp || 0;

  if (oldTimeout !== newTimeout) {
    if (newTimeout > Date.now()) {
      const ts = Math.floor(newTimeout / 1000);
      embeds.push(
        baseEmbed()
          .setTitle("🔇 Member Timed Out")
          .setDescription(`${newMember} was placed in timeout.`)
          .setColor("DarkRed")
          .addFields({
            name: "Timeout Until",
            value: `<t:${ts}:F> (<t:${ts}:R>)`,
            inline: false,
          }),
      );
    } else if (oldTimeout > Date.now()) {
      embeds.push(
        baseEmbed()
          .setTitle("🔊 Timeout Lifted")
          .setDescription(`${newMember}'s timeout was removed.`)
          .setColor("Green"),
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
