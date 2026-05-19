const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const formatduration = require("../../structures/FormatDuration.js");
const { searchLyrics } = require("../../services/lyrics/lyricsService");

module.exports = async (client, player, track) => {
  const source = player.queue.current.sourceName || "unknow";
  let src =
    {
      youtube:
        "https://media.discordapp.net/attachments/1010784573061349496/1070282974848888863/youtube.png",
      spotify:
        "https://media.discordapp.net/attachments/1010784573061349496/1070282974404300902/spotify.png",
      soundcloud:
        "https://media.discordapp.net/attachments/1010784573061349496/1070282974190383124/soundcloud.png",
      twitch:
        "https://media.discordapp.net/attachments/1010784573061349496/1070282974634975292/twitch.png",
      unknow:
        "https://media.discordapp.net/attachments/1010784573061349496/1070283756100911184/question.png",
    }[source] || src.unknow;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music-pause")
      .setLabel(player.playing ? "Pause" : "Resume")
      .setEmoji(player.playing ? "⏸️" : "▶️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("music-skip")
      .setLabel("Skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("music-stop")
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music-lyrics")
      .setLabel("Lyrics")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music-shuffle")
      .setLabel("Shuffle")
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Success),
  );

  const embed = new EmbedBuilder()
    .setAuthor({
      name: "Now Playing...",
      iconURL: "https://cdn.discordapp.com/emojis/741605543046807626.gif",
    })
    .setDescription(`**[${track.title || "Unknown"}](${track.uri})**`)
    .setColor(client.color)
    .addFields(
      { name: `Author:`, value: `${track.author || "Unknown"}`, inline: true },
      { name: `Requester:`, value: `${track.requester}`, inline: true },
      { name: `Volume:`, value: `${player.options.volume}%`, inline: true },
      { name: `Queue Length:`, value: `${player.queue.size}`, inline: true },
      {
        name: `Duration:`,
        value: `${formatduration(track.length, true)}`,
        inline: true,
      },
      {
        name: `Total Duration:`,
        value: `${formatduration(player.queue.durationLength + track.length, true)}`,
        inline: true,
      },
    )
    .setFooter({ text: `Engine: ${UpCase(source)}`, iconURL: src })
    .setTimestamp();

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  else embed.setThumbnail(client.user.displayAvatarURL());

  const channel = client.channels.cache.get(player.textId);

  try {
    if (player.nowPlayingMessageId) {
      // Edit pesan lama
      const oldMsg = await channel.messages
        .fetch(player.nowPlayingMessageId)
        .catch(() => null);
      if (oldMsg) {
        await oldMsg.edit({ embeds: [embed], components: [buttons] });

        // Auto-fetch lyrics jika toggle aktif
        if (player.lyricsEnabled) {
          await autoFetchLyrics(client, player, track, oldMsg);
        }
        return;
      }
    }

    // Jika belum ada message tersimpan, kirim baru & simpan ID-nya
    const sentMsg = await channel.send({
      embeds: [embed],
      components: [buttons],
    });
    player.nowPlayingMessageId = sentMsg.id;

    // Auto-fetch lyrics jika toggle aktif
    if (player.lyricsEnabled) {
      await autoFetchLyrics(client, player, track, sentMsg);
    }
  } catch (err) {
    console.error("Error sending/updating Now Playing embed:", err);
  }
};

function UpCase(char) {
  return char.charAt(0).toUpperCase() + char.slice(1);
}

/**
 * Auto-fetch lyrics dan update now playing message
 */
async function autoFetchLyrics(client, player, track, message) {
  try {
    // Add loading notification
    const currentEmbeds = message.embeds;
    const loadingEmbed = new EmbedBuilder()
      .setDescription("🔍 Mencari lyrics...")
      .setColor(client.color);

    await message.edit({
      embeds: [...currentEmbeds, loadingEmbed],
      components: message.components,
    });

    // Fetch lyrics
    const result = await searchLyrics(player, track, client.color);

    if (result.error) {
      // Remove loading notification if not found
      await message.edit({
        embeds: currentEmbeds,
        components: message.components,
      });
      console.warn("[playerStart] Lyrics not found:", result.error);
      return;
    }

    // Replace loading notification with actual lyrics
    await message.edit({
      embeds: [...currentEmbeds, result.embed],
      components: message.components,
    });
  } catch (err) {
    console.error("[playerStart] Auto-fetch lyrics failed:", err.message);
    // Remove loading notification on error
    try {
      const currentEmbeds = message.embeds;
      if (currentEmbeds.length > 1) {
        await message.edit({
          embeds: currentEmbeds.slice(0, -1), // Remove last embed (loading)
          components: message.components,
        });
      }
    } catch (_e) {
      // Ignore
    }
  }
}
