const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player) => {
  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  if (player.data.get("stay")) {
    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription("`📛` | *Queue has been:* `Ended` (24/7 Active)");

    return channel.send({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(client.color)
    .setDescription("`📛` | *Queue has been:* `Ended`");

  channel.send({ embeds: [embed] });
  return player.destroy();
};
