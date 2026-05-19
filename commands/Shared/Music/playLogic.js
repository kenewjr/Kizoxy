// shared/music/playLogic.js
const {
  isSpotifyUrl,
  isSpotifyPlaylist,
  isSpotifyAlbum,
  isSpotifyTrack,
  spotifyToYouTubeSearch,
} = require("../../../utils/spotify/spotifyHelper");

module.exports = async function playLogic(client, ctx, args) {
  const isSlash = !!ctx.isChatInputCommand?.();

  // Helper: kirim pesan (slash atau prefix)
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

    // ── Ambil query ──────────────────────────────────────────
    let query = isSlash ? ctx.options.getString("search") : args.join(" ");
    if (!query) return reply("❌ | Masukkan nama lagu atau URL.", true);

    // ── Convert Spotify URLs ke YouTube search ───────────────
    if (isSpotifyUrl(query)) {
      // Playlist dan Album tidak support tanpa Spotify Premium
      if (isSpotifyPlaylist(query)) {
        return reply(
          "❌ | Spotify playlist tidak support tanpa Premium subscription.\n" +
            "💡 Gunakan YouTube playlist atau paste track Spotify satu per satu.",
          true,
        );
      }

      if (isSpotifyAlbum(query)) {
        return reply(
          "❌ | Spotify album tidak support tanpa Premium subscription.\n" +
            "💡 Gunakan YouTube playlist atau paste track Spotify satu per satu.",
          true,
        );
      }

      // Single track: convert ke YouTube search
      if (isSpotifyTrack(query)) {
        await reply("🎵 | Memuat dari Spotify...", true);
        const ytSearch = await spotifyToYouTubeSearch(query);
        if (ytSearch) {
          query = ytSearch; // Let Kazagumo handle search prefix
        } else {
          return reply("❌ | Gagal memuat dari Spotify. Coba lagi.", true);
        }
      }
    }

    // ── Cek voice channel ────────────────────────────────────
    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice)
      return reply("❌ | Kamu harus berada di voice channel.", true);

    // ── Cek bot sudah di channel lain ────────────────────────
    const botVoiceId = ctx.guild.members.me?.voice?.channelId;
    if (botVoiceId && botVoiceId !== userVoice.id)
      return reply(
        "❌ | Kamu harus di voice channel yang sama dengan bot.",
        true,
      );

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
        try {
          player.play();
        } catch (_) {
          /* ignore */
        }
      }
      const name = result.playlistName || result.playlist?.name || "Playlist";
      return reply(
        `📃 Menambahkan playlist **${name}** dengan **${added}** lagu ke queue.`,
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
