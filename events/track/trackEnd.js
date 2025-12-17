const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player, track, payload) => {
  // Restart ONLY if Lofi Mode is enabled
  if (player.data.get("lofi") && track.isStream) {
    if (payload.reason === "FINISHED" || payload.reason === "LOAD_FAILED") {
      const channel = client.channels.cache.get(player.textId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("`🔄` | *Lofi stream interrupted, reconnecting...*");
        channel.send({ embeds: [embed] }).catch(() => {});
      }

      // Re-play the track
      try {
        const res = await player.search(track.uri, {
          requester: track.requester,
        });
        if (res.tracks.length) {
          player.queue.add(res.tracks[0]);
          if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
          }
        }
      } catch (e) {
        console.error("Failed to auto-restart Lofi stream:", e);
      }
      return;
    }
  }
};
