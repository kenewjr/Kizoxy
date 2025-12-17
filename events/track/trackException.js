const { EmbedBuilder } = require("discord.js");
const Logger = require("../../utils/logger");
const logger = new Logger("TRACK_EXCEPTION");

module.exports = async (client, player, track, payload) => {
  logger.error(
    `Track exception: ${track.title} [${track.uri}] - ${payload.exception.message}`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(client.color)
    .setDescription(
      `\`❌\` | *Track exception:* [${track.title}](${track.uri}) - \`${payload.exception.message}\``,
    );

  channel.send({ embeds: [embed] });

  if (player.queue.size > 0 || player.queue.current) {
    player.skip();
  }
};
