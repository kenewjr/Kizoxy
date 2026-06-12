// src/events/track/playerStart.js
const Embeds = require("../../lib/embeds");
const { searchLyrics } = require("../../features/lyrics/lyricsService");
const Logger = require("../../lib/logger");
const {
  buildMusicControlRow,
  buildNowPlayingEmbed,
  swapNowPlayingComponents,
  fetchNowPlayingMessage,
} = require("../../features/music/musicHelper");

const logger = new Logger("PLAYER-START");

const QUEUE_POLL_INTERVAL_MS = 3000;

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
        _startQueueWatcher(client, player, oldMsg);
        if (player.lyricsEnabled) {
          setImmediate(() => autoFetchLyrics(client, player, track, oldMsg));
        }
        return;
      }
    }

    const sentMsg = await channel.send({
      embeds: [embed],
      components: [buttons],
    });
    player.nowPlayingMessageId = sentMsg.id;
    _startQueueWatcher(client, player, sentMsg);

    if (player.lyricsEnabled) {
      setImmediate(() => autoFetchLyrics(client, player, track, sentMsg));
    }
  } catch (err) {
    logger.error(`Error sending/updating Now Playing embed: ${err.message}`);
  }
};

function _startQueueWatcher(client, player, message) {
  if (player._queueWatcherInterval) {
    clearInterval(player._queueWatcherInterval);
    player._queueWatcherInterval = null;
  }

  const watchedMessageId = message.id;
  let lastKnownQueueSize = player.queue?.size ?? 0;
  let lastKnownPaused = !!player.paused;

  player._queueWatcherInterval = setInterval(async () => {
    if (player.nowPlayingMessageId !== watchedMessageId || !player.playing) {
      clearInterval(player._queueWatcherInterval);
      player._queueWatcherInterval = null;
      return;
    }

    const currentQueueSize = player.queue?.size ?? 0;
    const currentPaused = !!player.paused;

    if (
      currentQueueSize === lastKnownQueueSize &&
      currentPaused === lastKnownPaused
    ) {
      return;
    }

    lastKnownQueueSize = currentQueueSize;
    lastKnownPaused = currentPaused;

    try {
      const msg = await fetchNowPlayingMessage(client, player);
      if (!msg || msg.id !== watchedMessageId) {
        clearInterval(player._queueWatcherInterval);
        player._queueWatcherInterval = null;
        return;
      }

      const freshRow = buildMusicControlRow({
        paused: currentPaused,
        queueLength: currentQueueSize,
        lyricsEnabled: !!player.lyricsEnabled,
      });

      await msg.edit({ components: [freshRow] });
    } catch (err) {
      logger.warning(`Queue watcher edit failed: ${err.message}`);
    }
  }, QUEUE_POLL_INTERVAL_MS);
}

async function autoFetchLyrics(client, player, track, message) {
  const token = (player._lyricsFetchToken || 0) + 1;
  player._lyricsFetchToken = token;
  const isStale = () => player._lyricsFetchToken !== token;

  try {
    const currentEmbeds = message.embeds;
    const loadingEmbed = Embeds.info(client, {
      description: "🔍 Searching lyrics...",
    });

    if (isStale()) return;
    await message.edit({
      embeds: [...currentEmbeds, loadingEmbed],
      components: message.components,
    });

    const lyricsEmbed = await searchLyrics(track, player, client);

    if (isStale()) return;

    if (!lyricsEmbed) {
      await message.edit({
        embeds: currentEmbeds,
        components: message.components,
      });
      logger.warning("autoFetchLyrics: no lyrics found for this track");
      return;
    }

    await message.edit({
      embeds: [...currentEmbeds, lyricsEmbed],
      components: message.components,
    });
  } catch (err) {
    if (isStale()) return;
    logger.error(`Auto-fetch lyrics failed: ${err.message}`);
    try {
      const currentEmbeds = message.embeds;
      if (currentEmbeds.length > 1) {
        await message.edit({
          embeds: currentEmbeds.slice(0, -1),
          components: message.components,
        });
      }
    } catch (_e) {}
  }
}
