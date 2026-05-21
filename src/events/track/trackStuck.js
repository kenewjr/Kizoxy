const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const logger = new Logger("TRACK_STUCK");

module.exports = async (client, player, track, payload) => {
  logger.warning(
    `Track stuck: ${track.title} [${track.uri}] - ${payload.thresholdMs}ms threshold`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = Embeds.brand(client, {
    description: `\`⚠\ufe0f\` | *Track has been stuck:* [${track.title}](${track.uri})`,
  });

  channel.send({ embeds: [embed] });

  if (player.queue.size > 0 || player.queue.current) {
    player.skip();
  }
};
