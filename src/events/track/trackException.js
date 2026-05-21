const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const logger = new Logger("TRACK_EXCEPTION");

module.exports = async (client, player, track, payload) => {
  logger.error(
    `Track exception: ${track.title} [${track.uri}] - ${payload.exception.message}`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = Embeds.brand(client, {
    description: `\`❌\` | *Track exception:* [${track.title}](${track.uri}) - \`${payload.exception.message}\``,
  });

  channel.send({ embeds: [embed] });

  if (player.queue.size > 0 || player.queue.current) {
    player.skip();
  }
};
