const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-MSG-DELETE");

module.exports = async (client, message) => {
  if (!message.guild || !message.author) return;
  if (message.author.bot) return;

  const logChannelId = client.logStorage.getChannel(message.guild.id);
  if (!logChannelId) return;

  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = Embeds.withColor(client, COLORS.ERROR, {
    author: {
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
    },
    title: "Message Deleted",
    description: `A message was deleted in ${message.channel}.`,
    fields: [
      {
        name: "Content",
        value: message.content ? message.content : "`No text content`",
      },
      { name: "Message ID", value: message.id, inline: true },
      { name: "Author ID", value: message.author.id, inline: true },
    ],
  });

  if (message.attachments.size > 0) {
    embed.addFields({
      name: "Attachments",
      value: message.attachments.map((a) => a.url).join("\n"),
    });
  }

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Could not send messageDelete log: ${err.message}`);
  }
};
