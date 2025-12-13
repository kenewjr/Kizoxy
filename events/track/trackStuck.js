const { EmbedBuilder } = require("discord.js");
const Logger = require("../../utils/logger");
const logger = new Logger("TRACK_STUCK");

module.exports = async (client, player, track, payload) => {
  logger.warning(
    `Track stuck: ${track.title} [${track.uri}] - ${payload.thresholdMs}ms threshold`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(client.color)
    .setDescription(
      `\`⚠️\` | *Track has been stuck:* [${track.title}](${track.uri})`,
    );

  channel.send({ embeds: [embed] });

  if (player.queue.size > 0 || player.queue.current) {
    player.skip();
  }
};
