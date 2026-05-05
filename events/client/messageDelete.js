const { EmbedBuilder } = require("discord.js");

module.exports = async (client, message) => {
  if (!message.guild || !message.author) return;
  if (message.author.bot) return; // Ignore bots

  const logChannelId = client.logStorage.getChannel(message.guild.id);
  if (!logChannelId) return;

  const logChannel = message.guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
    })
    .setTitle("Message Deleted")
    .setDescription(`A message was deleted in ${message.channel}.`)
    .addFields(
      {
        name: "Content",
        value: message.content ? message.content : "`No text content`",
      },
      { name: "Message ID", value: message.id, inline: true },
      { name: "Author ID", value: message.author.id, inline: true },
    )
    .setColor("Red")
    .setTimestamp();

  if (message.attachments.size > 0) {
    embed.addFields({
      name: "Attachments",
      value: message.attachments.map((a) => a.url).join("\n"),
    });
  }

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Could not send messageDelete log:`, err);
  }
};
