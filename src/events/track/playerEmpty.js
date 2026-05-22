const Embeds = require("../../lib/embeds");

module.exports = async (client, player) => {
  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  if (player.data.get("stay")) return;

  const embed = Embeds.brand(client, {
    description: "`📛` | *Song has been:* `Ended`",
  });

  channel.send({ embeds: [embed] }).catch(() => {});
  return player.destroy();
};
