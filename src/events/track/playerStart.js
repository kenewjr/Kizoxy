const Embeds = require("../../lib/embeds");
const {
  searchLyricsForNowPlaying,
} = require("../../features/lyrics/lyricsService");
const Logger = require("../../lib/logger");
const {
  buildNowPlayingComponents,
  buildNowPlayingEmbed,
  fetchNowPlayingMessage,
} = require("../../features/music/musicHelper");

const logger = new Logger("PLAYER-START");

const QUEUE_POLL_INTERVAL_MS = 3000;

module.exports = async (client, player, track) => {
  // Clear stale references from the previous track before touching anything else.
  // Prevents lyrics from the previous song bleeding into the next message.
  player.data.nowPlayingEmbed = null;
  player.data.lyricsEmbed = null;
  player.data.lyricsState = null;
  player.data.nowPlayingMessage = null;

  const embed = buildNowPlayingEmbed(client, player, track);
  const components = buildNowPlayingComponents(player);

  const channel = client.channels.cache.get(player.textId);

  try {
    let sentMsg = null;
    const existingMsg = channel && player.data._prevNowPlayingMessage;

    if (existingMsg) {
      try {
        sentMsg = await existingMsg.edit({
          embeds: [embed],
          components,
        });
      } catch (_editErr) {
        // Previous message may have been deleted — fall back to a fresh send.
        sentMsg = null;
      }
    }

    if (!sentMsg) {
      sentMsg = await channel.send({
        embeds: [embed],
        components,
      });
    }

    player.data.nowPlayingMessage = sentMsg;
    player.data.nowPlayingEmbed = embed;
    player.data._prevNowPlayingMessage = sentMsg;

    _startQueueWatcher(client, player, sentMsg);

    if (player.lyricsEnabled) {
      setImmediate(() => autoFetchLyrics(client, player, track, sentMsg));
    }
  } catch (err) {
    logger.error(`Error sending Now Playing embed: ${err.message}`);
  }
};

// Polls queue size + paused state. On change it REBUILDS the Now Playing embed
// from live player state so the Queue count and Total Duration fields stay
// accurate — editing only the components left those fields frozen at track start.
function _startQueueWatcher(client, player, message) {
  clearInterval(player.data?._watcherInterval);

  const watchedMessageId = message.id;
  let lastQueueSize = player.queue?.size ?? 0;
  let lastPaused = !!player.paused;

  player.data._watcherInterval = setInterval(async () => {
    try {
      if (
        player.data.nowPlayingMessage?.id !== watchedMessageId ||
        !player.playing
      ) {
        clearInterval(player.data?._watcherInterval);
        player.data._watcherInterval = null;
        return;
      }

      const currentQueueSize = player.queue?.size ?? 0;
      const currentPaused = !!player.paused;

      if (currentQueueSize === lastQueueSize && currentPaused === lastPaused) {
        return;
      }

      lastQueueSize = currentQueueSize;
      lastPaused = currentPaused;

      const msg = await fetchNowPlayingMessage(client, player);
      if (!msg || msg.id !== watchedMessageId) {
        clearInterval(player.data?._watcherInterval);
        player.data._watcherInterval = null;
        return;
      }

      const track = player.queue?.current;
      if (!track) return;

      const rebuiltEmbed = buildNowPlayingEmbed(client, player, track);
      player.data.nowPlayingEmbed = rebuiltEmbed;

      const embeds = player.data.lyricsEmbed
        ? [rebuiltEmbed, player.data.lyricsEmbed]
        : [rebuiltEmbed];

      const freshComponents = buildNowPlayingComponents(player, {
        paused: currentPaused,
        queueLength: currentQueueSize,
      });

      await msg.edit({ embeds, components: freshComponents });
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

    const result = await searchLyricsForNowPlaying(track, player, client);

    if (
      isStale() ||
      !player.lyricsEnabled ||
      player.queue?.current !== track ||
      player.data.nowPlayingMessage?.id !== message.id
    ) {
      return;
    }

    if (!result) {
      player.data.lyricsState = null;
      await message.edit({
        embeds: [nowPlayingEmbed],
        components: buildNowPlayingComponents(player),
      });
      logger.warning("autoFetchLyrics: no lyrics found for this track");
      return;
    }

    player.data.lyricsState = {
      cacheKey: result.cacheKey,
      canRomanize: result.canRomanize,
      mode: "romaji",
    };
    player.data.lyricsEmbed = result.embed;
    await message.edit({
      embeds: [nowPlayingEmbed, result.embed],
      components: buildNowPlayingComponents(player),
    });
  } catch (err) {
    if (isStale()) return;
    logger.error(`Auto-fetch lyrics failed: ${err.message}`);
    try {
      const nowPlayingEmbed = player.data.nowPlayingEmbed;
      if (nowPlayingEmbed) {
        player.data.lyricsState = null;
        player.data.lyricsEmbed = null;
        await message.edit({
          embeds: [nowPlayingEmbed],
          components: buildNowPlayingComponents(player),
        });
      }
    } catch (_e) {}
  }
}
