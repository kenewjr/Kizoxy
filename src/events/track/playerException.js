const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const logger = new Logger("TRACK_EXCEPTION");

module.exports = async (client, player, payload) => {
  const track = player.queue.current;
  const title = track?.title || "Unknown track";
  const uri = track?.uri || "Unknown URL";
  const message = payload?.exception?.message || "Unknown playback error";

  logger.error(`Track exception: ${title} [${uri}] - ${message}`);

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = Embeds.brand(client, {
    description: `\`❌\` | *Track exception:* [${title}](${uri}) - \`${message}\``,
  });

  await channel.send({ embeds: [embed] });
};
