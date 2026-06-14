const Embeds = require("../../../lib/embeds");
const Logger = require("../../../lib/logger");

const logger = new Logger("PREFIX-LOFI");

const LOFI_URL = "https://www.youtube.com/watch?v=EWrX250Zhko";

module.exports = {
  name: "lofi",
  aliases: ["radio"],
  description: "Play 24/7 Lofi radio.",
  category: "music",
  run: async (client, message) => {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel)
      return message.reply("❌ You must be in a voice channel.");

    const botVoiceId = message.guild.members.me?.voice?.channelId;
    if (botVoiceId && botVoiceId !== voiceChannel.id)
      return message.reply("❌ I am already playing in another voice channel.");

    try {
      let player = client.manager.players.get(message.guild.id);
      if (!player) {
        player = await client.manager.createPlayer({
          guildId: message.guild.id,
          voiceId: voiceChannel.id,
          textId: message.channel.id,
          volume: 100,
          deaf: true,
        });
      }

      if (player.state !== "CONNECTED" && player.state !== "CONNECTING") {
        try {
          player.connect();
        } catch (err) {
          logger.warning(`Player connection error (ignored): ${err.message}`);
        }
      }

      const res = await client.manager.search(LOFI_URL, {
        requester: message.author,
      });
      if (!res?.tracks?.length)
        return message.channel.send("❌ Failed to load Lofi stream.");

      const track = res.tracks[0];
      player.queue.clear();
      player.queue.add(track);
      player.data.set("stay", true);
      player.data.set("lofi", true);
      player.data.set("lofiUrl", LOFI_URL);

      if (!player.playing && !player.paused) await player.play();

      const embed = Embeds.brand(client, {
        description: `☕ | **Started Lofi 24/7 Radio**\n[${track.title}](${track.uri})`,
        footerText: "Auto-reconnect enabled for this stream.",
      });
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`klofi failed: ${err.message}`);
      return message.reply("❌ Failed to start the Lofi stream.");
    }
  },
};
