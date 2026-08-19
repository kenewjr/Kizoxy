const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");

const logger = new Logger("PLAYER_EMPTY");

module.exports = async (client, player) => {
  clearInterval(player.data?._watcherInterval);

  if (player.data.get("lofi")) {
    const lofiUrl =
      player.data.get("lofiUrl") ||
      "https://www.youtube.com/watch?v=jfKfPfyJRdk";
    try {
      const result = await player.search(lofiUrl, { requester: client.user });
      if (!result?.tracks?.length) {
        logger.error(`Lofi auto-restart: no tracks returned for ${lofiUrl}`);
        return;
      }

      player.queue.add(result.tracks[0]);
      if (!player.playing && !player.paused) await player.play();
    } catch (error) {
      logger.error(`Lofi auto-restart failed: ${error.message}`);
    }
    return;
  }

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  if (player.data.get("stay")) return;

  const embed = Embeds.brand(client, {
    description: "`📛` | *Song has been:* `Ended`",
  });

  channel.send({ embeds: [embed] }).catch(() => {});
  return player.destroy();
};
