const { EmbedBuilder } = require("discord.js");

module.exports = async (client, player) => {
  const channel = client.channels.cache.get(player.textId);

  // Lofi 24/7 mode: re-fetch and replay the stream
  if (player.data.get("lofi")) {
    try {
      const lofiUrl =
        player.data.get("lofiUrl") ||
        "https://www.youtube.com/watch?v=jfKfPfyJRdk";
      const res = await player.search(lofiUrl, { requester: client.user });

      if (res?.tracks?.length) {
        player.queue.add(res.tracks[0]);
        if (!player.playing && !player.paused) {
          await player.play();
        }
        return;
      }
    } catch (e) {
      console.error("Lofi queueEnd auto-restart failed:", e);
    }
  }

  if (!channel) return;

  if (player.data.get("stay")) {
    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription("`📛` | *Queue has been:* `Ended` (24/7 Active)");

    return channel.send({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(client.color)
    .setDescription("`📛` | *Queue has been:* `Ended`");

  channel.send({ embeds: [embed] });
  return player.destroy();
};
