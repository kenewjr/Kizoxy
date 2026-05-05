// shared/music/playLogic.js
const {
  isSpotifyPlaylist,
  extractPlaylistId,
  getPlaylistTracks,
  isSpotifyTrack,
  getTrackInfoFromOEmbed,
} = require("../../../utils/spotifyResolver");
const { KazagumoTrack } = require("kazagumo");

module.exports = async function playLogic(client, ctx, args) {
  const isSlash = !!ctx.isChatInputCommand?.();

  try {
    // Adding Defer Reply specifically for slash commands to prevent timeout
    if (isSlash) await ctx.deferReply();

    // Get query from slash or prefix
    const query = isSlash ? ctx.options.getString("search") : args.join(" ");

    if (!query) {
      const msg = "❌ | Please provide a song name or URL.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    // Get user voice channel
    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice) {
      const msg = "❌ | You must be in a voice channel.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    // Check if bot is already in another channel
    const botVoiceChannelId = ctx.guild.members.me?.voice?.channelId;
    if (botVoiceChannelId && botVoiceChannelId !== userVoice.id) {
      const msg = "❌ | You must be in the same voice channel as the bot.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    let player = client.manager.players.get(ctx.guild.id);

    if (!player) {
      player = await client.manager.createPlayer({
        guildId: ctx.guild.id,
        voiceId: userVoice.id,
        textId: ctx.channel.id,
        volume: 100,
        deaf: true,
      });
    } else {
      if (player.voiceId !== userVoice.id) {
        player.voiceId = userVoice.id;
      }
    }

    const requester = isSlash ? ctx.user : ctx.author;

    // ─── Spotify Playlist: use custom resolver ───
    if (isSpotifyPlaylist(query)) {
      const playlistId = extractPlaylistId(query);
      if (!playlistId) {
        const msg = "❌ | Invalid Spotify playlist URL.";
        if (isSlash) return ctx.editReply({ content: msg });
        else return ctx.channel.send(msg);
      }

      const loadMsg = "⏳ | Loading Spotify playlist via YouTube...";
      if (isSlash) await ctx.editReply({ content: loadMsg });
      else await ctx.channel.send(loadMsg);

      try {
        const playlist = await getPlaylistTracks(playlistId);

        if (!playlist.tracks.length) {
          const msg = "❌ | Playlist is empty or failed to load.";
          if (isSlash) return ctx.editReply({ content: msg });
          else return ctx.channel.send(msg);
        }

        // Build KazagumoTrack objects — each will auto-resolve to YouTube when played
        let added = 0;
        for (const t of playlist.tracks) {
          const kazTrack = new KazagumoTrack(
            {
              encoded: "",
              pluginInfo: {},
              info: {
                sourceName: "spotify",
                identifier: t.identifier,
                isSeekable: true,
                author: t.author,
                length: t.duration,
                isStream: false,
                position: 0,
                title: t.title,
                uri: t.uri,
                artworkUrl: t.artworkUrl,
                isrc: t.isrc,
              },
            },
            requester,
          );
          kazTrack.setKazagumo(client.manager);
          player.queue.add(kazTrack);
          added++;
        }

        if (!player.playing && !player.paused) {
          try {
            player.play();
          } catch (e) {
            /* ignore */
          }
        }

        const msg = `📃 Added Spotify playlist **${playlist.name}** with **${added}** tracks to the queue. (via YouTube)`;
        if (isSlash) return ctx.editReply({ content: msg });
        else return ctx.channel.send(msg);
      } catch (spotifyErr) {
        console.error("[SPOTIFY-RESOLVER ERROR]", spotifyErr.message);
        const msg = `❌ | ${spotifyErr.message}`;
        if (isSlash) return ctx.editReply({ content: msg });
        else return ctx.channel.send(msg);
      }
    }

    // ─── Spotify Single Track: use oEmbed → YouTube search ───
    if (isSpotifyTrack(query)) {
      try {
        const trackInfo = await getTrackInfoFromOEmbed(query);
        if (trackInfo) {
          console.warn(
            `[SPOTIFY] Track detected, searching YouTube for: "${trackInfo}"`,
          );
          const result = await client.manager.search(trackInfo, { requester });

          if (result && result.tracks && result.tracks.length > 0) {
            const track = result.tracks[0];
            player.queue.add(track);
            if (!player.playing && !player.paused) {
              try {
                player.play();
              } catch (e) {
                /* ignore */
              }
            }
            const msg = `🎵 Added **${track.title}** to the queue. (Spotify → YouTube)`;
            if (isSlash) return ctx.editReply({ content: msg });
            else return ctx.channel.send(msg);
          }
        }
      } catch (e) {
        console.error("[SPOTIFY-OEMBED ERROR]", e.message);
        // Fall through to normal search
      }
    }

    // ─── Default: search via Kazagumo/Lavalink ───
    const result = await client.manager.search(query, { requester });

    if (!result || !result.tracks || result.tracks.length === 0) {
      const msg = "❌ | No results found.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    // Detect playlist robustly
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
        } catch (e) {
          /* ignore */
        }
      }
      const name = result.playlistName || result.playlist?.name || "Playlist";
      const msg = `📃 Added playlist **${name}** with **${added}** tracks to the queue.`;
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused) {
        try {
          player.play();
        } catch (e) {
          /* ignore */
        }
      }
      const msg = `🎵 Added **${track.title}** to the queue.`;
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }
  } catch (err) {
    console.error("[PLAY ERROR]", err);
    const msg = "❌ | Failed to play the song.";
    try {
      if (isSlash) {
        if (ctx.deferred || ctx.replied) return ctx.editReply({ content: msg });
        else return ctx.reply({ content: msg, ephemeral: true });
      } else {
        return ctx.channel.send(msg);
      }
    } catch (replyErr) {
      console.error("[PLAY ERROR] failed to reply:", replyErr);
    }
  }
};
