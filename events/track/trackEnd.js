const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player, track, payload) => {
  if (!player.data.get("lofi")) return;

  // Normalize reason for Lavalink v3/v4 compatibility (uppercase vs lowercase)
  const reason = String(payload?.reason || "").toLowerCase();

  // Skip auto-restart only when user explicitly stopped or skipped
  if (reason === "stopped" || reason === "replaced") return;

  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription("`🔄` | *Lofi stream interrupted, reconnecting...*");
    channel.send({ embeds: [embed] }).catch(() => {});
  }

  // Re-fetch and replay the lofi stream
  try {
    const lofiUrl = player.data.get("lofiUrl") || track.uri;
    const res = await player.search(lofiUrl, {
      requester: track.requester,
    });

    if (!res?.tracks?.length) {
      console.error("Lofi auto-restart: no tracks returned for", lofiUrl);
      return;
    }

    player.queue.add(res.tracks[0]);

    // Force play if not already playing — Kazagumo will pick up from queue
    if (!player.playing && !player.paused) {
      await player.play();
    }
  } catch (e) {
    console.error("Failed to auto-restart Lofi stream:", e);
  }
};
