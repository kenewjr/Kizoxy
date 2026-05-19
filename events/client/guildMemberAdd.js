const { EmbedBuilder } = require("discord.js");

module.exports = async (client, member) => {
  if (!member.guild || member.user.bot) return;
  if (!client.logStorage) return;

  const logChannelId = client.logStorage.getChannel(member.guild.id);
  if (!logChannelId) return;

  const logChannel = member.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const accountAge = Math.floor(member.user.createdTimestamp / 1000);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle("📥 Member Joined")
    .setDescription(`${member} joined the server.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "User ID", value: member.user.id, inline: true },
      {
        name: "Account Created",
        value: `<t:${accountAge}:F> (<t:${accountAge}:R>)`,
        inline: false,
      },
      {
        name: "Member Count",
        value: `${member.guild.memberCount}`,
        inline: true,
      },
    )
    .setColor("Green")
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Could not send guildMemberAdd log:`, err);
  }
};
