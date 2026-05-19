const { EmbedBuilder } = require("discord.js");

module.exports = {
  customId: "music-stop",
  execute: async (interaction, client) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

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

      const channelName = voiceChannel.name;
      
      // Remove buttons dari now playing message (stop = end session)
      try {
        await interaction.message.edit({ components: [] });
      } catch (error) {
        console.error("Failed to remove buttons:", error);
      }
      
      await player.destroy();

      const embed = new EmbedBuilder()
        .setDescription(`🚫 | *Left:* | \`${channelName}\``)
        .setColor(client.color);

      await interaction.editReply({ embeds: [embed] });

      // Delete ephemeral reply after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (err) {
          // Ignore error if already deleted
        }
      }, 5000);
    } catch (error) {
      console.error("Stop Button Error:", error);
      await interaction.editReply({ content: "❌ Failed to stop the music." });
    }
  },
};
