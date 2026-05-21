const { EmbedBuilder } = require("discord.js");
const formatduration = require("../../lib/FormatDuration");
const { searchLyrics } = require("../../features/lyrics/lyricsService");
const Logger = require("../../lib/logger");
const { buildMusicControlRow } = require("../../features/music/musicHelper");

const logger = new Logger("PLAYER-START");

const SOURCE_ICONS = {
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
};

module.exports = async (client, player, track) => {
  const source = player.queue.current.sourceName || "unknow";
  const src = SOURCE_ICONS[source] || SOURCE_ICONS.unknow;

  const buttons = buildMusicControlRow(player.paused);

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
      // Edit existing message
      const oldMsg = await channel.messages
        .fetch(player.nowPlayingMessageId)
        .catch(() => null);
      if (oldMsg) {
        await oldMsg.edit({ embeds: [embed], components: [buttons] });

        // Auto-fetch lyrics if toggle enabled
        if (player.lyricsEnabled) {
          autoFetchLyrics(client, player, track, oldMsg);
        }
        return;
      }
    }

    // No saved message yet, send a new one and store its ID
    const sentMsg = await channel.send({
      embeds: [embed],
      components: [buttons],
    });
    player.nowPlayingMessageId = sentMsg.id;

    // Auto-fetch lyrics if toggle enabled
    if (player.lyricsEnabled) {
      autoFetchLyrics(client, player, track, sentMsg);
    }
  } catch (err) {
    logger.error(`Error sending/updating Now Playing embed: ${err.message}`);
  }
};

function UpCase(char) {
  return char.charAt(0).toUpperCase() + char.slice(1);
}

async function autoFetchLyrics(client, player, track, message) {
  // Per-player fetch token: only the most-recent autoFetchLyrics call is
  // allowed to mutate the message. When a new track starts we bump the token
  // and any in-flight fetches for the old track abandon their edits.
  const token = (player._lyricsFetchToken || 0) + 1;
  player._lyricsFetchToken = token;
  const isStale = () => player._lyricsFetchToken !== token;

  try {
    // Add loading notification
    const currentEmbeds = message.embeds;
    const loadingEmbed = new EmbedBuilder()
      .setDescription("🔍 Searching lyrics...")
      .setColor(client.color);

    if (isStale()) return;
    await message.edit({
      embeds: [...currentEmbeds, loadingEmbed],
      components: message.components,
    });

    // Fetch lyrics
    const result = await searchLyrics(player, track, client.color);

    if (isStale()) return; // newer track started; do not touch the message

    if (result.error) {
      // Remove loading notification if not found
      await message.edit({
        embeds: currentEmbeds,
        components: message.components,
      });
      logger.warning(`[playerStart] Lyrics not found: ${result.error}`);
      return;
    }

    // Replace loading notification with actual lyrics
    await message.edit({
      embeds: [...currentEmbeds, result.embed],
      components: message.components,
    });
  } catch (err) {
    if (isStale()) return;
    logger.error(`[playerStart] Auto-fetch lyrics failed: ${err.message}`);
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
