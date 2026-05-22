const Embeds = require("../../lib/embeds");

module.exports = async (client, player) => {
  const channel = client.channels.cache.get(player.textId);

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
    const embed = Embeds.brand(client, {
      description: "`📛` | *Queue has been:* `Ended` (24/7 Active)",
    });

    return channel.send({ embeds: [embed] });
  }

  const embed = Embeds.brand(client, {
    description: "`📛` | *Queue has been:* `Ended`",
  });

  channel.send({ embeds: [embed] }).catch(() => {});
  return player.destroy();
};
