const Logger = require("../../lib/logger");
const { Constants } = require("shoukaku");

const logger = new Logger("PLAY");

const NODE_READY_TIMEOUT_MS = 10000;
const SEARCH_RETRY_DELAY_MS = 600;
const PLAYLIST_RETRY_DELAY_MS = 2000;
const NODE_POLL_INTERVAL_MS = 200;

const PLAYLIST_URL_RE = /[?&]list=|\bplaylist\b/i;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves once at least one Lavalink node reports CONNECTED, or false on timeout.
// On a fresh boot the node WebSocket may still be connecting, which previously
// made the very first search return zero tracks ("No results found").
async function waitForNodeReady(client, timeoutMs = NODE_READY_TIMEOUT_MS) {
  const nodesReady = () => {
    const nodes = client.manager?.shoukaku?.nodes;
    if (!nodes) return false;
    for (const node of nodes.values()) {
      if (node.state === Constants.State.CONNECTED) return true;
    }
    return false;
  };

  if (nodesReady()) return true;

  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (nodesReady()) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(iv);
        resolve(false);
      }
    }, NODE_POLL_INTERVAL_MS);
  });
}

// Awaits player.play() so failures surface instead of being swallowed. Retries
// once after a short delay to absorb the voice-connection race that previously
// required users to issue /play twice before audio started.
async function startPlayback(player) {
  if (player.playing || player.paused) return;
  try {
    await player.play();
  } catch (err) {
    logger.warning(
      `Initial play() failed, retrying once: ${err.message || err}`,
    );
    await delay(500);
    if (player.playing || player.paused) return;
    try {
      await player.play();
    } catch (err2) {
      logger.error(`Retry play() failed: ${err2.message || err2}`);
      throw err2;
    }
  }
}

async function playLogic(client, ctx, args) {
  const isSlash = !!ctx.isChatInputCommand?.();

  const reply = async (msg, edit = false) => {
    try {
      if (isSlash) {
        if (edit || ctx.deferred || ctx.replied)
          return ctx.editReply({ content: msg });
        return ctx.reply({ content: msg, ephemeral: false });
      }
      return ctx.channel.send(msg);
    } catch (_) {
      /* ignore double-reply error */
    }
  };

  try {
    if (isSlash) await ctx.deferReply();

    let query = isSlash ? ctx.options.getString("search") : args.join(" ");
    if (!query) return reply("❌ | Please provide a song name or URL.", true);

    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice) return reply("❌ | You must be in a voice channel.", true);

    const botVoiceId = ctx.guild.members.me?.voice?.channelId;
    if (botVoiceId && botVoiceId !== userVoice.id)
      return reply(
        "❌ | You must be in the same voice channel as the bot.",
        true,
      );

    // Skip the readiness gate for warm guilds (player already exists).
    const existingPlayer = client.manager.players.get(ctx.guild.id);
    if (!existingPlayer) {
      const ready = await waitForNodeReady(client);
      if (!ready)
        return reply(
          "❌ | Music server is still connecting. Please try again in a moment.",
          true,
        );
    }

    const requester = isSlash ? ctx.user : ctx.author;
    const looksLikePlaylist = PLAYLIST_URL_RE.test(query);

    // Immediate feedback — overwritten by the real result once resolved.
    let placeholderMsg;
    if (isSlash) {
      await reply("🔍 Searching...", true);
    } else {
      try {
        placeholderMsg = await ctx.channel.send("🔍 Searching...");
      } catch (_) {
        /* channel may be gone */
      }
    }

    // Search BEFORE creating the player: a failed lookup should not leave an
    // idle voice connection behind. Retry once to absorb a node that just
    // finished connecting.
    let result = await client.manager.search(query, { requester });
    if (!result?.tracks?.length) {
      logger.debug("Search returned empty, retrying once...");
      const retryDelay = looksLikePlaylist
        ? PLAYLIST_RETRY_DELAY_MS
        : SEARCH_RETRY_DELAY_MS;
      await delay(retryDelay);
      result = await client.manager.search(query, { requester });
    }
    if (!result?.tracks?.length) {
      logger.warning(
        `Search retry also empty for query "${query}" — genuine no results`,
      );
      if (placeholderMsg) {
        try {
          await placeholderMsg.delete();
        } catch (_) {
          /* already gone */
        }
      }
      return reply("❌ | No results found.", true);
    }

    // Clean up prefix placeholder — slash placeholder is overwritten by reply()
    if (placeholderMsg) {
      try {
        await placeholderMsg.delete();
      } catch (_) {
        /* already gone */
      }
    }

    let player = existingPlayer;
    if (!player) {
      player = await client.manager.createPlayer({
        guildId: ctx.guild.id,
        voiceId: userVoice.id,
        textId: ctx.channel.id,
        volume: 100,
        deaf: true,
      });
    } else if (player.voiceId !== userVoice.id) {
      player.voiceId = userVoice.id;
    }

    const isPlaylist =
      (result.type && String(result.type).toUpperCase().includes("PLAYLIST")) ||
      !!result.playlistName ||
      !!result.playlist?.name;

    if (isPlaylist) {
      let added = 0;
      for (const t of result.tracks) {
        player.queue.add(t);
        added++;
      }
      await startPlayback(player);
      const name = result.playlistName || result.playlist?.name || "Playlist";
      return reply(
        `📃 Added playlist **${name}** with **${added}** track(s) to the queue.`,
        true,
      );
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      await startPlayback(player);
      return reply(`🎵 Added **${track.title}** to the queue.`, true);
    }
  } catch (err) {
    logger.error(`[PLAY ERROR] ${err.message || err}`);
    const msg = `❌ | ${err.message || "Failed to play the track."}`;
    try {
      if (isSlash) {
        if (ctx.deferred || ctx.replied) return ctx.editReply({ content: msg });
        return ctx.reply({ content: msg, ephemeral: true });
      } else {
        return ctx.channel.send(msg);
      }
    } catch (replyErr) {
      logger.error(`[PLAY ERROR] failed to reply: ${replyErr.message}`);
    }
  }
}

module.exports = playLogic;
module.exports.playLogic = playLogic;
module.exports.waitForNodeReady = waitForNodeReady;
module.exports.startPlayback = startPlayback;
module.exports._NODE_READY_TIMEOUT_MS = NODE_READY_TIMEOUT_MS;
module.exports._SEARCH_RETRY_DELAY_MS = SEARCH_RETRY_DELAY_MS;
module.exports._PLAYLIST_RETRY_DELAY_MS = PLAYLIST_RETRY_DELAY_MS;
module.exports._NODE_POLL_INTERVAL_MS = NODE_POLL_INTERVAL_MS;
