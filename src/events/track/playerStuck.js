const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const logger = new Logger("TRACK_STUCK");

module.exports = async (client, player, payload) => {
  const track = player.queue.current;
  const title = track?.title || "Unknown track";
  const uri = track?.uri || "Unknown URL";
  const thresholdMs = payload?.thresholdMs ?? "unknown";

  logger.warning(
    `Track buffering: ${title} [${uri}] - no audio frames for ${thresholdMs}ms; waiting for recovery`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const embed = Embeds.brand(client, {
    description: `\`⚠️\` | *Playback is buffering; waiting for recovery:* [${title}](${uri})`,
  });
  await channel.send({ embeds: [embed] });
};
