const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-MEMBER-ADD");

const SUSPICIOUS_AGE_DAYS = 7;

module.exports = async (client, member) => {
  if (!member.guild || member.user.bot) return;
  if (!client.logStorage) return;

  const logChannelId = client.logStorage.getChannel(member.guild.id);
  if (!logChannelId) return;

  const logChannel = member.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const accountAge = Math.floor(member.user.createdTimestamp / 1000);
  const ageDays = Math.floor(
    (Date.now() - member.user.createdTimestamp) / 86_400_000,
  );
  const isSuspicious = ageDays < SUSPICIOUS_AGE_DAYS;

  const embed = Embeds.withColor(
    client,
    isSuspicious ? COLORS.WARNING : COLORS.SUCCESS,
    {
      author: {
        name: member.user.tag,
        iconURL: member.user.displayAvatarURL({ dynamic: true }),
      },
      title: "📥 Member Joined",
      description: `${member} joined the server.${
        isSuspicious
          ? `\n⚠️ **New account** — created **${ageDays} day(s)** ago.`
          : ""
      }`,
      thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
      fields: [
        { name: "User", value: `${member.user.tag}`, inline: true },
        { name: "User ID", value: member.user.id, inline: true },
        { name: "Mention", value: `${member}`, inline: true },
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
      ],
      footerText: `User ID: ${member.user.id}`,
    },
  );

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Could not send guildMemberAdd log: ${err.message}`);
  }
};
