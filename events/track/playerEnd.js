const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player, track, payload) => {
  // Auto-restart live streams if 24/7 is on
  if (player.data.get("stay") && track.isStream) {
    // Only restart if it finished or load failed (standard end)
    // payload.reason can be "FINISHED", "LOAD_FAILED", "STOPPED", "REPLACED", "CLEANUP"
    if (payload.reason === "FINISHED" || payload.reason === "LOAD_FAILED") {
      const channel = client.channels.cache.get(player.textId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("`🔄` | *Live stream ended, auto-restarting...*");
        channel.send({ embeds: [embed] }).catch(() => {});
      }
      
      // Re-play the track
      try {
        const res = await player.search(track.uri, { requester: track.requester });
        if (res.tracks.length) {
          player.queue.add(res.tracks[0]);
          if (!player.playing && !player.paused && !player.queue.size) {
            player.play();
          }
        }
      } catch (e) {
        console.error("Failed to auto-restart stream:", e);
      }
      return;
    }
  }

  if (player.data.get("autoplay")) {
    const requester = player.data.get("requester");
    const identifier = player.data.get("identifier");
    const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
    const res = await player.search(search, { requester: requester });
    if (!res.tracks.length) return;
    await player.queue.add(res.tracks[2]);
  }
};
