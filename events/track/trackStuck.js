const { EmbedBuilder } = require("discord.js");
const Logger = require("../../utils/logger");
const logger = new Logger("TRACK_STUCK");

module.exports = async (client, player, track, payload) => {
  logger.warning(
    `Track stuck: ${track.title} [${track.uri}] - ${payload.thresholdMs}ms threshold`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  if (player.data.get("stay") && track.isStream) {
     const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription(
        `\`⚠️\` | *Track Stuck:* [${track.title}](${track.uri}) - \`${payload.thresholdMs}ms\`\n*Auto-restarting 24/7 stream...*`,
      );

    channel.send({ embeds: [embed] });

     try {
        const res = await player.search(track.uri, { requester: track.requester });
        if (res.tracks.length) {
          player.queue.add(res.tracks[0]);
          if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
          }
        }
      } catch (e) {
        console.error("Failed to auto-restart stream on stuck:", e);
      }
    return;
  }

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
