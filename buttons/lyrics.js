// buttons/lyrics.js (safe: won't call defer twice)
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
  customId: "music-lyrics",
  execute: async (interaction, client) => {
    try {
      // Jika belum deferred/replied, kita defer supaya pengguna dapat melihat spinner
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch((err) => {
          // kalau gagal deferring, kita lanjutkan (mungkin karena already acknowledged)
          console.warn(
            "[lyrics] deferReply failed (ignored):",
            err?.message || err,
          );
        });
      }

      // Ambil player
      const player = client.manager.players.get(interaction.guild.id);
      if (!player) {
        // Jika sudah deferred atau sudah reply, gunakan editReply; kalau belum, reply
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: "❌ No music is currently playing",
          });
        } else {
          return interaction.reply({
            content: "❌ No music is currently playing",
            ephemeral: true,
          });
        }
      }

      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel || voiceChannel.id !== player.voiceId) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: "❌ You must be in the same voice channel as the bot",
          });
        } else {
          return interaction.reply({
            content: "❌ You must be in the same voice channel as the bot",
            ephemeral: true,
          });
        }
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

      const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(
        trackTitle,
      );
      if (isJapanese) trackTitle += " Romanized";

      const response = await axios
        .get(
          `http://localhost:5000/lyrics?q=${encodeURIComponent(trackTitle)}`,
          {
            validateStatus: (status) => status < 500,
          },
        )
        .catch((err) => {
          // network error
          throw { type: "request", error: err };
        });

      if (response.status === 404) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: "🔹 No lyrics found for this track",
          });
        } else {
          return interaction.reply({
            content: "🔹 No lyrics found for this track",
            ephemeral: true,
          });
        }
      }

      if (response.status === 500) {
        console.error("Lyrics API error:", response.data);
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: "❌ Lyrics service is currently unavailable",
          });
        } else {
          return interaction.reply({
            content: "❌ Lyrics service is currently unavailable",
            ephemeral: true,
          });
        }
      }

      if (!response.data?.lyrics) {
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({
            content: "🔹 Could not retrieve lyrics for this track",
          });
        } else {
          return interaction.reply({
            content: "🔹 Could not retrieve lyrics for this track",
            ephemeral: true,
          });
        }
      }

      const { lyrics, artist, title, url } = response.data;
      let formattedLyrics = lyrics;
      if (lyrics.length > 4096) {
        formattedLyrics =
          lyrics.substring(0, 4000) + `...\n[Read more](${url})`;
      }

      const lyricsEmbed = new EmbedBuilder()
        .setColor(client.color || 0x2f3136)
        .setTitle(`Lyrics for ${track.title}`)
        .setDescription(formattedLyrics)
        .setFooter({ text: `Artist: ${artist} | Powered by Genius` })
        .setURL(url);

      // Kirim hasil: editReply kalau sudah didefer, else reply
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [lyricsEmbed] });
      } else {
        return interaction.reply({ embeds: [lyricsEmbed], ephemeral: true });
      }
    } catch (error) {
      console.error("Lyrics error:", error);

      // Tangani error berdasar jenis
      try {
        if (error.type === "request" || error.request) {
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
              content: "❌ Could not connect to lyrics service.",
            });
          } else {
            return interaction.reply({
              content: "❌ Could not connect to lyrics service.",
              ephemeral: true,
            });
          }
        } else if (error.response) {
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
              content: "❌ Failed to fetch lyrics. Please try again later.",
            });
          } else {
            return interaction.reply({
              content: "❌ Failed to fetch lyrics. Please try again later.",
              ephemeral: true,
            });
          }
        } else {
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
              content: "❌ An error occurred while fetching lyrics.",
            });
          } else {
            return interaction.reply({
              content: "❌ An error occurred while fetching lyrics.",
              ephemeral: true,
            });
          }
        }
      } catch (replyErr) {
        // final fallback: mungkin interaction sudah expired / unknown -> log saja
        console.error("[lyrics] Failed to send error reply:", replyErr);
      }
    }
  },
};
