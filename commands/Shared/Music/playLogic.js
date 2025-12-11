// shared/music/playLogic.js
module.exports = async function playLogic(client, ctx, args) {
  const isSlash = !!ctx.isChatInputCommand?.();

  try {
    // Adding Defer Reply specifically for slash commands to prevent timeout
    if (isSlash) await ctx.deferReply();

    // Ambil query dari slash or prefix
    const query = isSlash ? ctx.options.getString("search") : args.join(" ");
    if (!query) {
      const msg = "❌ | Please provide a song name or URL.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    // Ambil voice channel user
    const member = ctx.member;
    const userVoice = member?.voice?.channel;
    if (!userVoice) {
      const msg = "❌ | You must be in a voice channel.";
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    }

    // Jika bot sudah di voice channel lain -> tolak
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
        selfDeaf: true,
      });
    } else {
      // Jika player ada tapi voice berbeda, coba update voiceId (tergantung library)
      if (player.voiceId !== userVoice.id) {
        player.voiceId = userVoice.id;
      }
    }

    // Search menggunakan manager (sesuaikan bila pakai player.search)
    const result = await client.manager.search(query, {
      requester: isSlash ? ctx.user : ctx.author,
    });

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
      // Tambah semua track playlist
      let added = 0;
      for (const t of result.tracks) {
        player.queue.add(t);
        added++;
      }

      // Start player kalau belum main
      if (!player.playing && !player.paused) {
        try {
          player.play();
        } catch (e) {
          /* ignore if already connecting */
        }
      }

      const name = result.playlistName || result.playlist?.name || "Playlist";
      const msg = `📃 Added playlist **${name}** with **${added}** tracks to the queue.`;
      if (isSlash) return ctx.editReply({ content: msg });
      else return ctx.channel.send(msg);
    } else {
      // Single track
      const track = result.tracks[0];
      player.queue.add(track);

      // Start player kalau belum main
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
        // If already deferred, use editReply
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
