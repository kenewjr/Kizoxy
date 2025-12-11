const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
  name: ["music", "lyric"],
  description: "Display lyrics of a song.",
  category: "Music",
  run: async (client, interaction) => {
    try {
      await interaction.deferReply();

      const player = client.manager.players.get(interaction.guild.id);
      if (!player)
        return interaction.editReply(`No music playing in this server!`);

      const { channel } = interaction.member.voice;
      if (
        !channel ||
        interaction.member.voice.channel !==
          interaction.guild.members.me.voice.channel
      ) {
        return interaction.editReply(
          `I'm not in the same voice channel as you!`,
        );
      }

      const track = player.queue.current;
      let trackTitle = track.title
        .replace(
          /(\(Covered by.*?\)|【Covered by.*?】|\(Cover\)|【Cover】)/gi,
          "",
        )
        .replace(
          /(lyric|MV|【】|lyrical|official music video|\(.*?\)|audio|official|video|extended|hd|\[.*?\])/gi,
          "",
        )
        .trim();

      // Deteksi lagu Jepang dan tambahkan Romanized jika perlu
      const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
        trackTitle,
      );
      if (isJapanese) {
        trackTitle += " Romanized";
      }

      try {
        const response = await axios.get(
          `https://516f08ca2909.ngrok-free.app/lyrics?q=${encodeURIComponent(trackTitle)}`,
          {
            validateStatus: function (status) {
              return status < 500; // Reject only if status code >= 500
            },
          },
        );

        // Handle 404 Not Found
        if (response.status === 404) {
          return interaction.editReply({
            content: "🔹 | No lyrics found for this track.",
          });
        }

        // Handle 500 Internal Server Error
        if (response.status === 500) {
          console.error("Backend error:", response.data);
          return interaction.editReply({
            content:
              "❌ | Lyrics service is currently unavailable. Please try again later.",
          });
        }

        if (!response.data?.lyrics) {
          return interaction.editReply({
            content: "🔹 | Could not retrieve lyrics for this track.",
          });
        }

        const { lyrics, artist, title, url } = response.data;
        const cleanTitle = title
          .replace(/\(Romanized\)|\(English Translation\)/gi, "")
          .trim();

        let formattedLyrics = lyrics;
        if (lyrics.length > 4096) {
          formattedLyrics =
            lyrics.substring(0, 4000) + `...\n[Read more](${url})`;
        }

        const lyricsEmbed = new EmbedBuilder()
          .setColor(client.color)
          .setTitle(`Lyrics for ${track.title}`)
          .setDescription(formattedLyrics)
          .setFooter({ text: `Artist: ${artist} | Powered by Genius` })
          .setURL(url);

        return interaction.editReply({ embeds: [lyricsEmbed] });
      } catch (error) {
        console.error("Lyrics API error:", error);

        // Handle khusus untuk Axios error
        if (error.response) {
          // Response diterima dengan status error
          return interaction.editReply({
            content: "❌ | Failed to fetch lyrics. Please try again later.",
          });
        } else if (error.request) {
          // Request dibuat tapi tidak mendapat response
          return interaction.editReply({
            content:
              "❌ | Could not connect to lyrics service. Please try again later.",
          });
        } else {
          // Error lainnya
          return interaction.editReply({
            content: "❌ | An error occurred while fetching lyrics.",
          });
        }
      }
    } catch (error) {
      console.error("Command error:", error);
      return interaction.editReply({
        content: "❌ | An unexpected error occurred. Please try again.",
      });
    }
  },
};
