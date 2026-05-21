const Embeds = require("../../lib/embeds");
const { COLORS } = Embeds;
const Logger = require("../../lib/logger");

const logger = new Logger("LOG-MSG-UPDATE");

module.exports = async (client, oldMessage, newMessage) => {
  if (!oldMessage.guild || !oldMessage.author) return;
  if (oldMessage.author.bot) return;

  if (oldMessage.content === newMessage.content) return;

  const logChannelId = client.logStorage.getChannel(oldMessage.guild.id);
  if (!logChannelId) return;

  const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = Embeds.withColor(client, COLORS.WARNING, {
    author: {
      name: oldMessage.author.tag,
      iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }),
    },
    title: "Message Edited",
    description: `[Jump to Message](${newMessage.url}) in ${newMessage.channel}`,
    fields: [
      {
        name: "Before",
        value: oldMessage.content ? oldMessage.content : "`No text content`",
      },
      {
        name: "After",
        value: newMessage.content ? newMessage.content : "`No text content`",
      },
    ],
    footerText: `Message ID: ${newMessage.id} | Author ID: ${newMessage.author.id}`,
  });

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`Could not send messageUpdate log: ${err.message}`);
  }
};
