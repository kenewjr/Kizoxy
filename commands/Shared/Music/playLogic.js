// shared/music/playLogic.js
const {
  isSpotifyPlaylist,
  isSpotifyAlbum,
  isSpotifyTrack,
  extractPlaylistId,
  extractAlbumId,
  getPlaylistTracks,
  getAlbumTracks,
  getTrackInfo,
  getTrackInfoFromOEmbed,
} = require("../../../utils/spotifyResolver");
const { KazagumoTrack } = require("kazagumo");

module.exports = async function playLogic(client, ctx, args) {
  const isSlash = !!ctx.isChatInputCommand?.();

  // Helper: kirim pesan (slash atau prefix)
  const reply = async (msg, edit = false) => {
    try {
      if (isSlash) {
        if (edit || ctx.deferred || ctx.replied) return ctx.editReply({ content: msg });
        return ctx.reply({ content: msg, ephemeral: false });
      }
      return ctx.channel.send(msg);
    } catch (_) { /* ignore double-reply error */ }
  };

  try {
    if (isSlash) await ctx.deferReply();

    // ── Ambil query ──────────────────────────────────────────
    const query = isSlash ? ctx.options.getString("search") : args.join(" ");
    if (!query) return reply("❌ | Masukkan nama lagu atau URL.", true);

    // ── Cek voice channel ────────────────────────────────────
    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice) return reply("❌ | Kamu harus berada di voice channel.", true);

    // ── Cek bot sudah di channel lain ────────────────────────
    const botVoiceId = ctx.guild.members.me?.voice?.channelId;
    if (botVoiceId && botVoiceId !== userVoice.id)
      return reply("❌ | Kamu harus di voice channel yang sama dengan bot.", true);

    // ── Buat / ambil player ──────────────────────────────────
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

    // Helper: tambah banyak track ke queue lalu play jika belum jalan
    const bulkAdd = (tracks) => {
      for (const t of tracks) player.queue.add(t);
      if (!player.playing && !player.paused) {
        try { player.play(); } catch (_) { /* ignore */ }
      }
    };

    // Helper: bangun KazagumoTrack dari data mentah Spotify
    const buildSpotifyTrack = (t) =>
      new KazagumoTrack(
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
        client.manager,
      );

    // ═══════════════════════════════════════════════════════════
    // SPOTIFY PLAYLIST
    // ═══════════════════════════════════════════════════════════
    if (isSpotifyPlaylist(query)) {
      const playlistId = extractPlaylistId(query);
      if (!playlistId) return reply("❌ | URL Spotify playlist tidak valid.", true);

      await reply("⏳ | Memuat Spotify playlist...", true);

      const playlist = await getPlaylistTracks(playlistId);
      if (!playlist.tracks.length)
        return reply("❌ | Playlist kosong atau gagal dimuat.", true);

      const kazTracks = playlist.tracks.map(buildSpotifyTrack);
      bulkAdd(kazTracks);

      return reply(
        `📃 Menambahkan playlist Spotify **${playlist.name}** dengan **${kazTracks.length}** lagu ke queue.`,
        true,
      );
    }

    // ═══════════════════════════════════════════════════════════
    // SPOTIFY ALBUM
    // ═══════════════════════════════════════════════════════════
    if (isSpotifyAlbum(query)) {
      const albumId = extractAlbumId(query);
      if (!albumId) return reply("❌ | URL Spotify album tidak valid.", true);

      await reply("⏳ | Memuat Spotify album...", true);

      const album = await getAlbumTracks(albumId);
      if (!album.tracks.length)
        return reply("❌ | Album kosong atau gagal dimuat.", true);

      const kazTracks = album.tracks.map(buildSpotifyTrack);
      bulkAdd(kazTracks);

      return reply(
        `💿 Menambahkan album Spotify **${album.name}** dengan **${kazTracks.length}** lagu ke queue.`,
        true,
      );
    }

    // ═══════════════════════════════════════════════════════════
    // SPOTIFY SINGLE TRACK
    // ═══════════════════════════════════════════════════════════
    if (isSpotifyTrack(query)) {
      // Coba lewat official API dulu, fallback ke oEmbed
      let searchQuery = await getTrackInfo(query);
      if (!searchQuery) searchQuery = await getTrackInfoFromOEmbed(query);

      if (searchQuery) {
        const result = await client.manager.search(searchQuery, { requester });
        if (result?.tracks?.length) {
          const track = result.tracks[0];
          player.queue.add(track);
          if (!player.playing && !player.paused) {
            try { player.play(); } catch (_) { /* ignore */ }
          }
          return reply(
            `🎵 Menambahkan **${track.title}** ke queue. (Spotify → YouTube)`,
            true,
          );
        }
      }
      // Jika semua gagal, fall-through ke default search
    }

    // ═══════════════════════════════════════════════════════════
    // DEFAULT: search via Kazagumo / Lavalink
    // ═══════════════════════════════════════════════════════════
    const result = await client.manager.search(query, { requester });

    if (!result?.tracks?.length)
      return reply("❌ | Tidak ada hasil ditemukan.", true);

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
        try { player.play(); } catch (_) { /* ignore */ }
      }
      const name = result.playlistName || result.playlist?.name || "Playlist";
      return reply(`📃 Menambahkan playlist **${name}** dengan **${added}** lagu ke queue.`, true);
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!player.playing && !player.paused) {
        try { player.play(); } catch (_) { /* ignore */ }
      }
      return reply(`🎵 Menambahkan **${track.title}** ke queue.`, true);
    }
  } catch (err) {
    console.error("[PLAY ERROR]", err);
    const msg = `❌ | ${err.message || "Gagal memutar lagu."}`;
    try {
      if (isSlash) {
        if (ctx.deferred || ctx.replied) return ctx.editReply({ content: msg });
        return ctx.reply({ content: msg, ephemeral: true });
      } else {
        return ctx.channel.send(msg);
      }
    } catch (replyErr) {
      console.error("[PLAY ERROR] failed to reply:", replyErr);
    }
  }
};
