const {
  isSpotifyUrl,
  isSpotifyPlaylist,
  isSpotifyAlbum,
  isSpotifyTrack,
  spotifyToYouTubeSearch,
} = require("../../../modules/spotify/spotifyHelper");
const Logger = require("../../../utils/logger");

const logger = new Logger("PLAY");

module.exports = async function playLogic(client, ctx, args) {
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

    if (isSpotifyUrl(query)) {
      if (isSpotifyPlaylist(query)) {
        return reply(
          "❌ | Spotify playlists are not supported without a Premium subscription.\n" +
            "💡 Use a YouTube playlist or paste Spotify tracks one at a time.",
          true,
        );
      }

      if (isSpotifyAlbum(query)) {
        return reply(
          "❌ | Spotify albums are not supported without a Premium subscription.\n" +
            "💡 Use a YouTube playlist or paste Spotify tracks one at a time.",
          true,
        );
      }

      if (isSpotifyTrack(query)) {
        await reply("🎵 | Loading from Spotify...", true);
        const ytSearch = await spotifyToYouTubeSearch(query);
        if (ytSearch) {
          query = ytSearch; // Let Kazagumo handle search prefix
        } else {
          return reply("❌ | Failed to load from Spotify. Please try again.", true);
        }
      }
    }

    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice)
      return reply("❌ | You must be in a voice channel.", true);

    const botVoiceId = ctx.guild.members.me?.voice?.channelId;
    if (botVoiceId && botVoiceId !== userVoice.id)
      return reply(
        "❌ | You must be in the same voice channel as the bot.",
        true,
      );

    let player = client.manager.players.get(ctx.guild.id);
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

    const requester = isSlash ? ctx.user : ctx.author;

    const result = await client.manager.search(query, { requester });

    if (!result?.tracks?.length)
      return reply("❌ | No results found.", true);

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
      if (!player.playing && !player.paused) {
        try {
          player.play();
        } catch (_) {
          /* ignore */
        }
      }
      const name = result.playlistName || result.playlist?.name || "Playlist";
      return reply(
        `📃 Added playlist **${name}** with **${added}** track(s) to the queue.`,
        true,
      );
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused) {
        try {
          player.play();
        } catch (_) {
          /* ignore */
        }
      }
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
};
