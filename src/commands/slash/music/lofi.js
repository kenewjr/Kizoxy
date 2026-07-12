const Embeds = require("../../../lib/embeds");

module.exports = {
  name: ["lofi"],
  description: "Stream a continuous 24/7 Lofi radio station.",
  category: "Music",
  run: async (client, interaction) => {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ | You need to be in a voice channel to use this command.",
        ephemeral: true,
      });
    }

    if (
      interaction.guild.members.me.voice.channelId &&
      interaction.guild.members.me.voice.channelId !== voiceChannel.id
    ) {
      return interaction.reply({
        content: "❌ | I am already playing in another voice channel.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = await client.manager.createPlayer({
        guildId: interaction.guild.id,
        voiceId: voiceChannel.id,
        textId: interaction.channel.id,
        volume: 100,
        deaf: true,
      });
    }

    if (player.state !== "CONNECTED" && player.state !== "CONNECTING") {
      try {
        player.connect();
      } catch (error) {
        console.warn("Player connection error (ignored):", error.message);
      }
    }

    const query = "https://www.youtube.com/watch?v=EWrX250Zhko";
    const res = await client.manager.search(query, {
      requester: interaction.user,
    });

    if (!res || !res.tracks.length) {
      return interaction.editReply("❌ | Failed to load Lofi stream.");
    }

    const track = res.tracks[0];

    player.queue.clear();
    player.queue.add(track);

    player.data.set("stay", true);
    player.data.set("lofi", true); // Flag for auto-restart on stream end
    player.data.set("lofiUrl", query); // Store URL for reliable re-fetch

    if (!player.playing && !player.paused) await player.play();

    const embed = Embeds.brand(client, {
      description: `☕ | **Started Lofi 24/7 Radio**\n[${track.title}](${track.uri})`,
      footerText: "Auto-reconnect enabled for this stream.",
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
