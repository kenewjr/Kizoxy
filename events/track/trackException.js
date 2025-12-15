const { EmbedBuilder } = require("discord.js");
const Logger = require("../../utils/logger");
const logger = new Logger("TRACK_EXCEPTION");

module.exports = async (client, player, track, payload) => {
  logger.error(
    `Track exception: ${track.title} [${track.uri}] - ${payload.exception.message}`,
  );

  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  if (player.data.get("stay") && track.isStream) {
    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription(
        `\`⚠️\` | *Stream Exception:* [${track.title}](${track.uri}) - \`${payload.exception.message}\`\n*Auto-restarting 24/7 stream...*`,
      );

    channel.send({ embeds: [embed] });

    // Restart logic
     try {
        const res = await player.search(track.uri, { requester: track.requester });
        if (res.tracks.length) {
          player.queue.add(res.tracks[0]);
          if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
          }
        }
      } catch (e) {
        console.error("Failed to auto-restart stream on exception:", e);
      }
    return;
  }

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
