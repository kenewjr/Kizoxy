const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: ["lofi"],
  description: "Play 24/7 Lofi Radio",
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

    // Check if bot is in another channel
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

    // Create or get player
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
        console.log("Player connection error (ignored):", error.message);
      }
    }

    // Specific Lofi URL
    const query = "https://www.youtube.com/watch?v=jfKfPfyJRdk";
    const res = await client.manager.search(query, {
      requester: interaction.user,
    });

    if (!res || !res.tracks.length) {
      return interaction.editReply("❌ | Failed to load Lofi stream.");
    }

    const track = res.tracks[0];

    // Clear queue and play special track
    player.queue.clear();
    player.queue.add(track);

    // Set 24/7 AND Lofi mode
    player.data.set("stay", true);
    player.data.set("lofi", true); // Special flag for auto-restart

    if (!player.playing && !player.paused && !player.queue.size) player.play();
    else player.play(); // Force play if needed or skip to it

    const embed = new EmbedBuilder()
      .setColor(client.color)
      .setDescription(
        `☕ | **Started Lofi 24/7 Radio**\n[${track.title}](${track.uri})`,
      )
      .setFooter({ text: "Auto-reconnect enabled for this stream." });

    return interaction.editReply({ embeds: [embed] });
  },
};
