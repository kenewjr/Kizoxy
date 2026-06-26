const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const formatduration = require("../../lib/FormatDuration");
const { COLORS } = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const { stats } = require("../../lib/ephemeralStats");

const logger = new Logger("MUSIC-HELPERS");

const EPHEMERAL_TTL_MS = 3000;

const EPHEMERAL_ERROR_TTL_MS = 5000;

function validateMusicContext(client, interaction) {
  const player = client.manager?.players?.get(interaction.guild.id);
  if (!player) {
    return { error: "❌ No music is currently playing." };
  }

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel || voiceChannel.id !== player.voiceId) {
    return {
      error: "❌ You must be in the same voice channel as the bot.",
    };
  }

  return { player, voiceChannel };
}

// Message-based counterpart of validateMusicContext for prefix commands.
function validateMusicContextMessage(client, message) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return { error: "❌ You must be in a voice channel." };

  const player = client.manager?.players?.get(message.guild.id);
  if (!player) return { error: "❌ Nothing is playing right now." };

  if (player.voiceId !== voiceChannel.id)
    return { error: "❌ You must be in the same voice channel as the bot." };

  return { player, voiceChannel };
}

function scheduleAutoDelete(interaction, ttl = EPHEMERAL_TTL_MS) {
  if (interaction._kizoxyAutoDeleteScheduled) {
    return;
  }
  interaction._kizoxyAutoDeleteScheduled = true;
  stats.scheduled++;

  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (err) {
      if (err.code === 10008) {
        logger.debug(
          `Auto-delete skipped: Message already deleted (code 10008) for interaction ${interaction.id}`,
        );
        stats.swallowed++;
      } else {
        logger.error(
          `Error deleting reply on interaction ${interaction.id}: ${err.message}`,
        );
      }
    } finally {
      stats.fired++;
    }
  }, ttl);
}

function formatProgressBar(position, duration, length = 14) {
  const safeDur = Number(duration) > 0 ? Number(duration) : 0;
  const safePos = Math.max(0, Math.min(safeDur, Number(position) || 0));
  if (safeDur === 0) return "▱".repeat(length);
  const ratio = safePos / safeDur;
  const filled = Math.round(ratio * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

const SOURCE_META = Object.freeze({
  youtube: { label: "YouTube", badge: "▶ YouTube", color: 0xff0000 },
  spotify: { label: "Spotify", badge: "🎵 Spotify", color: COLORS.SUCCESS },
  soundcloud: {
    label: "SoundCloud",
    badge: "🔊 SoundCloud",
    color: 0xff5500,
  },
  twitch: { label: "Twitch", badge: "🎮 Twitch", color: 0x9146ff },
  applemusic: {
    label: "Apple Music",
    badge: "🍎 Apple Music",
    color: 0xfa233b,
  },
  deezer: { label: "Deezer", badge: "🎧 Deezer", color: 0x00c7f2 },
});

function getSourceMeta(sourceName, fallbackColor) {
  const key = String(sourceName || "").toLowerCase();
  if (SOURCE_META[key]) return SOURCE_META[key];
  return {
    label: "Unknown",
    badge: "🎶 Unknown source",
    color: fallbackColor || COLORS.MUSIC,
  };
}

function buildNowPlayingEmbed(client, player, track) {
  const meta = getSourceMeta(track?.sourceName, client?.color);
  const requester = track?.requester ? String(track.requester) : "Unknown";
  const position = player?.position ?? 0;
  const duration = track?.length ?? 0;
  const progressBar = formatProgressBar(position, duration);
  const positionText = formatduration(position, true);
  const durationText = formatduration(duration, true);

  // EmbedBuilder used directly here: musicHelper owns the Now Playing embed
  // and is not a command surface, so the Embeds.* factory exception applies.
  const embed = new EmbedBuilder()
    .setAuthor({
      name: "Now Playing...",
      iconURL: "https://cdn.discordapp.com/emojis/741605543046807626.gif",
    })
    .setColor(meta.color)
    .setDescription(
      `**[${track?.title || "Unknown"}](${track?.uri || ""})**\n` +
        `\`${progressBar}\` \`${positionText} / ${durationText}\``,
    )
    .addFields(
      {
        name: "Author",
        value: track?.author || "Unknown",
        inline: true,
      },
      { name: "Requester", value: requester, inline: true },
      {
        name: "Volume",
        value: `${player?.options?.volume ?? player?.volume ?? 100}%`,
        inline: true,
      },
      {
        name: "Queue",
        value: `${player?.queue?.size ?? 0} track${
          (player?.queue?.size ?? 0) === 1 ? "" : "s"
        }`,
        inline: true,
      },
      {
        name: "Total Duration",
        value: formatduration(
          (player?.queue?.durationLength ?? 0) + duration,
          true,
        ),
        inline: true,
      },
    )
    .setFooter({ text: meta.badge })
    .setTimestamp();

  if (track?.thumbnail) embed.setThumbnail(track.thumbnail);
  else if (client?.user) embed.setThumbnail(client.user.displayAvatarURL());

  return embed;
}

function buildMusicControlRow(stateOrPaused = false) {
  const state =
    typeof stateOrPaused === "object" && stateOrPaused !== null
      ? stateOrPaused
      : { paused: !!stateOrPaused };

  const isPaused = !!state.paused;
  const queueLength = Number(state.queueLength ?? Infinity);
  const lyricsOn = !!state.lyricsEnabled;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music-pause")
      .setLabel(isPaused ? "Resume" : "Pause")
      .setEmoji(isPaused ? "▶️" : "⏸️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("music-skip")
      .setLabel("Skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Success)
      .setDisabled(queueLength <= 0),
    new ButtonBuilder()
      .setCustomId("music-stop")
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music-lyrics")
      .setLabel(lyricsOn ? "Hide Lyrics" : "Lyrics")
      .setEmoji("📝")
      .setStyle(lyricsOn ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music-shuffle")
      .setLabel("Shuffle")
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Success)
      .setDisabled(queueLength <= 1),
  );
}

// Returns the stored message object directly instead of re-fetching from Discord.
// playerStart.js keeps player.data.nowPlayingMessage in sync on every track start.
async function fetchNowPlayingMessage(client, player) {
  return player?.data?.nowPlayingMessage ?? null;
}

async function addLyricsToNowPlaying(client, player, lyricsEmbed) {
  try {
    const message = player?.data?.nowPlayingMessage;
    const nowPlayingEmbed = player?.data?.nowPlayingEmbed;
    if (!message || !nowPlayingEmbed) {
      logger.warning(
        "addLyricsToNowPlaying: nowPlayingMessage or nowPlayingEmbed not set on player.data",
      );
      return false;
    }
    await message.edit({
      embeds: [nowPlayingEmbed, lyricsEmbed],
      components: message.components,
    });
    player.data.lyricsEmbed = lyricsEmbed;
    return true;
  } catch (err) {
    logger.error(`addLyricsToNowPlaying failed: ${err.message}`);
    return false;
  }
}

async function removeLyricsFromNowPlaying(client, player) {
  try {
    const message = player?.data?.nowPlayingMessage;
    const nowPlayingEmbed = player?.data?.nowPlayingEmbed;
    if (!message || !nowPlayingEmbed) {
      logger.warning(
        "removeLyricsFromNowPlaying: nowPlayingMessage or nowPlayingEmbed not set on player.data",
      );
      return false;
    }
    await message.edit({
      embeds: [nowPlayingEmbed],
      components: message.components,
    });
    player.data.lyricsEmbed = null;
    return true;
  } catch (err) {
    logger.error(`removeLyricsFromNowPlaying failed: ${err.message}`);
    return false;
  }
}

async function swapNowPlayingComponents(interaction, components) {
  try {
    await interaction.message.edit({ components });
    return true;
  } catch (err) {
    logger.error(`swapNowPlayingComponents failed: ${err.message}`);
    return false;
  }
}

module.exports = {
  EPHEMERAL_TTL_MS,
  EPHEMERAL_ERROR_TTL_MS,
  validateMusicContext,
  validateMusicContextMessage,
  scheduleAutoDelete,
  buildMusicControlRow,
  buildNowPlayingEmbed,
  formatProgressBar,
  getSourceMeta,
  fetchNowPlayingMessage,
  addLyricsToNowPlaying,
  removeLyricsFromNowPlaying,
  swapNowPlayingComponents,
};
