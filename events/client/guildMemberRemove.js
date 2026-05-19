const { EmbedBuilder } = require("discord.js");

module.exports = async (client, member) => {
  if (!member.guild || member.user.bot) return;
  if (!client.logStorage) return;

  const logChannelId = client.logStorage.getChannel(member.guild.id);
  if (!logChannelId) return;

  const logChannel = member.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  // Roles excluding @everyone
  const roles = member.roles?.cache
    ? member.roles.cache
        .filter((r) => r.id !== member.guild.id)
        .map((r) => `<@&${r.id}>`)
        .join(", ") || "*None*"
    : "*Unknown*";

  const joinedAt = member.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
    : "*Unknown*";

  const embed = new EmbedBuilder()
    .setAuthor({
      name: member.user.tag,
      iconURL: member.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle("📤 Member Left")
    .setDescription(`**${member.user.tag}** left the server.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "User ID", value: member.user.id, inline: true },
      { name: "Joined Server", value: joinedAt, inline: false },
      { name: "Roles", value: roles.length > 1024 ? "*Too many*" : roles },
      {
        name: "Member Count",
        value: `${member.guild.memberCount}`,
        inline: true,
      },
    )
    .setColor("Red")
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Could not send guildMemberRemove log:`, err);
  }
};
