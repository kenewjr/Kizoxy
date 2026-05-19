const { EmbedBuilder } = require("discord.js");

module.exports = {
  customId: "music-skip",
  execute: async (interaction, client) => {
    try {
      const player = client.manager.players.get(interaction.guild.id);
      if (!player) {
        return interaction.editReply({
          content: "❌ No music is currently playing",
        });
      }

      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel || voiceChannel.id !== player.voiceId) {
        return interaction.editReply({
          content: "❌ You must be in the same voice channel as the bot",
        });
      }

      await player.skip();

      const embed = new EmbedBuilder()
        .setDescription(`⏭ | *Song has been:* \`Skipped\``)
        .setColor(client.color);

      await interaction.editReply({ embeds: [embed] });

      // Optional: update now playing
      const nowPlayingCmd = client.commands.get("nowplaying");
      if (nowPlayingCmd) {
        await nowPlayingCmd.run(client, interaction);
      }

      // Delete ephemeral reply after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (err) {
          // Ignore error if already deleted
        }
      }, 5000);
    } catch (error) {
      console.error("Skip Button Error:", error);
      await interaction.editReply({ content: "❌ Failed to skip track." });
    }
  },
};
