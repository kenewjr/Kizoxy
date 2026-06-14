const Embeds = require("../../lib/embeds");
const { searchLyrics } = require("../../features/lyrics/lyricsService");
const Logger = require("../../lib/logger");
const {
  buildMusicControlRow,
  buildNowPlayingEmbed,
  fetchNowPlayingMessage,
} = require("../../features/music/musicHelper");

const logger = new Logger("PLAYER-START");

const QUEUE_POLL_INTERVAL_MS = 3000;

module.exports = async (client, player, track) => {
  // Clear stale references from the previous track before touching anything else.
  // Prevents lyrics from the previous song bleeding into the new Now Playing message
  // when addLyricsToNowPlaying reads player.data.nowPlayingEmbed.
  player.data.nowPlayingEmbed = null;
  player.data.lyricsEmbed = null;
  player.data.nowPlayingMessage = null;

  const embed = buildNowPlayingEmbed(client, player, track);
  const buttons = buildMusicControlRow({
    paused: player.paused,
    queueLength: player.queue?.size ?? 0,
    lyricsEnabled: !!player.lyricsEnabled,
  });

  const channel = client.channels.cache.get(player.textId);

  try {
    let sentMsg = null;
    const existingMsg = channel && player.data._prevNowPlayingMessage;

    if (existingMsg) {
      try {
        sentMsg = await existingMsg.edit({
          embeds: [embed],
          components: [buttons],
        });
      } catch (_editErr) {
        // Pesan lama mungkin sudah dihapus — fallback ke send baru
        sentMsg = null;
      }
    }

    if (!sentMsg) {
      sentMsg = await channel.send({
        embeds: [embed],
        components: [buttons],
      });
    }

    player.data.nowPlayingMessage = sentMsg;
    player.data.nowPlayingEmbed = embed;
    // Simpan referensi untuk track berikutnya
    player.data._prevNowPlayingMessage = sentMsg;

    _startQueueWatcher(client, player, sentMsg);

    if (player.lyricsEnabled) {
      setImmediate(() => autoFetchLyrics(client, player, track, sentMsg));
    }
  } catch (err) {
    logger.error(`Error sending Now Playing embed: ${err.message}`);
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
    if (
      player.data.nowPlayingMessage?.id !== watchedMessageId ||
      !player.playing
    ) {
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
    const nowPlayingEmbed = player.data.nowPlayingEmbed;
    // Guard: if the track already changed before setImmediate fired, abort.
    if (!nowPlayingEmbed) return;

    const loadingEmbed = Embeds.info(client, {
      description: "🔍 Searching lyrics...",
    });

    if (isStale()) return;
    await message.edit({
      embeds: [nowPlayingEmbed, loadingEmbed],
      components: message.components,
    });

    const lyricsEmbed = await searchLyrics(track, player, client);

    if (isStale()) return;

    if (!lyricsEmbed) {
      await message.edit({
        embeds: [nowPlayingEmbed],
        components: message.components,
      });
      logger.warning("autoFetchLyrics: no lyrics found for this track");
      return;
    }

    await message.edit({
      embeds: [nowPlayingEmbed, lyricsEmbed],
      components: message.components,
    });
    player.data.lyricsEmbed = lyricsEmbed;
  } catch (err) {
    if (isStale()) return;
    logger.error(`Auto-fetch lyrics failed: ${err.message}`);
    try {
      const nowPlayingEmbed = player.data.nowPlayingEmbed;
      if (nowPlayingEmbed) {
        await message.edit({
          embeds: [nowPlayingEmbed],
          components: message.components,
        });
      }
    } catch (_e) {}
  }
}
