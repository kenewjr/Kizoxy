const { EmbedBuilder } = require("discord.js");
const { searchLyrics } = require("../../features/lyrics/lyricsService");
const Logger = require("../../lib/logger");
const {
  buildMusicControlRow,
  buildNowPlayingEmbed,
} = require("../../features/music/musicHelper");

const logger = new Logger("PLAYER-START");

module.exports = async (client, player, track) => {
  const embed = buildNowPlayingEmbed(client, player, track);
  const buttons = buildMusicControlRow({
    paused: player.paused,
    queueLength: player.queue?.size ?? 0,
    lyricsEnabled: !!player.lyricsEnabled,
  });

  const channel = client.channels.cache.get(player.textId);

  try {
    if (player.nowPlayingMessageId) {
      const oldMsg = await channel.messages
        .fetch(player.nowPlayingMessageId)
        .catch(() => null);
      if (oldMsg) {
        await oldMsg.edit({ embeds: [embed], components: [buttons] });

        if (player.lyricsEnabled) {
          autoFetchLyrics(client, player, track, oldMsg);
        }
        return;
      }
    }

    const sentMsg = await channel.send({
      embeds: [embed],
      components: [buttons],
    });
    player.nowPlayingMessageId = sentMsg.id;

    if (player.lyricsEnabled) {
      autoFetchLyrics(client, player, track, sentMsg);
    }
  } catch (err) {
    logger.error(`Error sending/updating Now Playing embed: ${err.message}`);
  }
};

async function autoFetchLyrics(client, player, track, message) {
  const token = (player._lyricsFetchToken || 0) + 1;
  player._lyricsFetchToken = token;
  const isStale = () => player._lyricsFetchToken !== token;

  try {
    const currentEmbeds = message.embeds;
    const loadingEmbed = new EmbedBuilder()
      .setDescription("🔍 Searching lyrics...")
      .setColor(client.color);

    if (isStale()) return;
    await message.edit({
      embeds: [...currentEmbeds, loadingEmbed],
      components: message.components,
    });

    const result = await searchLyrics(player, track, client.color);

    if (isStale()) return; // newer track started; do not touch the message

    if (result.error) {
      await message.edit({
        embeds: currentEmbeds,
        components: message.components,
      });
      logger.warning(`[playerStart] Lyrics not found: ${result.error}`);
      return;
    }

    await message.edit({
      embeds: [...currentEmbeds, result.embed],
      components: message.components,
    });
  } catch (err) {
    if (isStale()) return;
    logger.error(`[playerStart] Auto-fetch lyrics failed: ${err.message}`);
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
