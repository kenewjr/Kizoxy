const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-USER-UPDATE");

module.exports = async (client, oldUser, newUser) => {
  if (newUser.bot) return;

  client.guilds.cache.forEach(async (guild) => {
    const member = guild.members.cache.get(newUser.id);
    if (!member) return;

    const logChannelId = client.logStorage.getChannel(guild.id);
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = Embeds.withColor(client, COLORS.WARNING, {
      author: {
        name: newUser.tag,
        iconURL: newUser.displayAvatarURL({ dynamic: true }),
      },
      footerText: `User ID: ${newUser.id}`,
    });

    let updated = false;

    if (
      oldUser.username !== newUser.username ||
      oldUser.discriminator !== newUser.discriminator
    ) {
      embed.setTitle("User Profile Updated: Username");
      embed.addFields(
        { name: "Old Username", value: `\`${oldUser.tag}\``, inline: true },
        { name: "New Username", value: `\`${newUser.tag}\``, inline: true },
      );
      embed.setColor(COLORS.WARNING);
      updated = true;
    }

    if (oldUser.globalName !== newUser.globalName) {
      embed.setTitle("User Profile Updated: Display Name");
      embed.addFields(
        {
          name: "Old Display Name",
          value: oldUser.globalName ? `\`${oldUser.globalName}\`` : "`None`",
          inline: true,
        },
        {
          name: "New Display Name",
          value: newUser.globalName ? `\`${newUser.globalName}\`` : "`None`",
          inline: true,
        },
      );
      embed.setColor(COLORS.WARNING);
      updated = true;
    }

    if (oldUser.avatar !== newUser.avatar) {
      embed.setTitle("User Profile Updated: Avatar");
      embed.setDescription(`${newUser} changed their avatar.`);
      embed.setColor(COLORS.WARNING);

      if (oldUser.avatar) {
        embed.setThumbnail(
          oldUser.displayAvatarURL({ dynamic: true, format: "png" }),
        );
      }

      embed.setImage(
        newUser.displayAvatarURL({ dynamic: true, format: "png", size: 512 }),
      );
      updated = true;
    }

    if (updated) {
      try {
        await logChannel.send({ embeds: [embed] });
      } catch (err) {
        logger.error(
          `Could not send userUpdate log to ${guild.name} (${guild.id}): ${err.message}`,
        );
      }
    }
  });
};
