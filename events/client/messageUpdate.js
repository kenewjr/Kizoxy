const { EmbedBuilder } = require("discord.js");

module.exports = async (client, oldMessage, newMessage) => {
  if (!oldMessage.guild || !oldMessage.author) return;
  if (oldMessage.author.bot) return; // Ignore bots

  // Ignore if the content is the same (e.g. embed updates)
  if (oldMessage.content === newMessage.content) return;

  const logChannelId = client.logStorage.getChannel(oldMessage.guild.id);
  if (!logChannelId) return;

  const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: oldMessage.author.tag,
      iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }),
    })
    .setTitle("Message Edited")
    .setDescription(`[Jump to Message](${newMessage.url}) in ${newMessage.channel}`)
    .addFields(
      {
        name: "Before",
        value: oldMessage.content ? oldMessage.content : "`No text content`",
      },
      {
        name: "After",
        value: newMessage.content ? newMessage.content : "`No text content`",
      }
    )
    .setColor("Yellow")
    .setFooter({ text: `Message ID: ${newMessage.id} | Author ID: ${newMessage.author.id}` })
    .setTimestamp();

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Could not send messageUpdate log:`, err);
  }
};
