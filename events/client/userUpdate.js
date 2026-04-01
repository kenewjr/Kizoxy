const { EmbedBuilder } = require("discord.js");

module.exports = async (client, oldUser, newUser) => {
  if (newUser.bot) return; // Skip bot updates

  // Let's find all guilds the user is in that have logging enabled
  client.guilds.cache.forEach(async (guild) => {
    // Check if user is in this guild
    const member = guild.members.cache.get(newUser.id);
    if (!member) return;

    // Check if this guild has logs set up
    const logChannelId = client.logStorage.getChannel(guild.id);
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: newUser.tag,
        iconURL: newUser.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp()
      .setFooter({ text: `User ID: ${newUser.id}` });

    let updated = false;

    // Username or Discriminator changes
    if (oldUser.username !== newUser.username || oldUser.discriminator !== newUser.discriminator) {
      embed.setTitle("User Profile Updated: Username");
      embed.addFields(
        { name: "Old Username", value: `\`${oldUser.tag}\``, inline: true },
        { name: "New Username", value: `\`${newUser.tag}\``, inline: true },
      );
      embed.setColor("Orange");
      updated = true;
    }

    // Global Name change (Discord display name)
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
      embed.setColor("Orange");
      updated = true;
    }

    // Avatar change
    if (oldUser.avatar !== newUser.avatar) {
      embed.setTitle("User Profile Updated: Avatar");
      embed.setDescription(`${newUser} changed their avatar.`);
      embed.setColor("Orange");
      
      if (oldUser.avatar) {
          embed.setThumbnail(oldUser.displayAvatarURL({ dynamic: true, format: 'png' }));
      }
      
      embed.setImage(newUser.displayAvatarURL({ dynamic: true, format: 'png', size: 512 }));
      updated = true;
    }

    if (updated) {
      // Send the log
      try {
        await logChannel.send({ embeds: [embed] });
      } catch (err) {
        console.error(`Could not send log to ${guild.name} (${guild.id}):`, err);
      }
    }
  });
};
