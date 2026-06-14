const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");

const logger = new Logger("TRACK_END");

module.exports = async (client, player, track, payload) => {
  if (!player.data.get("lofi")) return;

  const reason = String(payload?.reason || "").toLowerCase();

  if (reason === "stopped" || reason === "replaced") return;

  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    const embed = Embeds.brand(client, {
      description: "`🔄` | *Lofi stream interrupted, reconnecting...*",
    });
    channel.send({ embeds: [embed] }).catch(() => {});
  }

  try {
    const lofiUrl = player.data.get("lofiUrl") || track.uri;
    const res = await player.search(lofiUrl, {
      requester: track.requester,
    });

    if (!res?.tracks?.length) {
      logger.error(`Lofi auto-restart: no tracks returned for ${lofiUrl}`);
      return;
    }

    player.queue.add(res.tracks[0]);

    if (!player.playing && !player.paused) {
      await player.play();
    }
  } catch (e) {
    logger.error(`Failed to auto-restart Lofi stream: ${e.message}`);
  }
};
