const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Logger = require("../../lib/logger");

const logger = new Logger("MUSIC-HELPERS");

// ════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════

/** TTL for ephemeral confirmations (ms). Keeps the channel clean on repeats. */
const EPHEMERAL_TTL_MS = 3000;

/** Slightly longer TTL for error notifications so the user can read them. */
const EPHEMERAL_ERROR_TTL_MS = 5000;

// ════════════════════════════════════════════════════════════════════════
// Validation
// ════════════════════════════════════════════════════════════════════════

/**
 * Validate that a music interaction has a player AND the user shares the
 * bot's voice channel. Returns either { player, voiceChannel } or { error }.
 */
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

// ════════════════════════════════════════════════════════════════════════
// Ephemeral auto-cleanup
// ════════════════════════════════════════════════════════════════════════

/**
 * Schedule deletion of the ephemeral reply after `ttl` ms. Errors swallowed
 * so already-deleted replies never throw.
 */
function scheduleAutoDelete(interaction, ttl = EPHEMERAL_TTL_MS) {
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, ttl);
}

// ════════════════════════════════════════════════════════════════════════
// Now Playing components
// ════════════════════════════════════════════════════════════════════════

/**
 * Build the standard music control row. Pass `isPaused = true` to show the
 * Resume label/emoji instead of Pause. Used by playerStart and the pause
 * button so the row stays consistent across re-renders.
 */
function buildMusicControlRow(isPaused = false) {
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
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("music-stop")
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music-lyrics")
      .setLabel("Lyrics")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music-shuffle")
      .setLabel("Shuffle")
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Success),
  );
}

// ════════════════════════════════════════════════════════════════════════
// Now Playing message manipulation
// ════════════════════════════════════════════════════════════════════════

/**
 * Fetch the player's Now Playing message, if any. Returns null if no message
 * tracked or the message no longer exists.
 */
async function fetchNowPlayingMessage(client, player) {
  if (!player?.nowPlayingMessageId) return null;
  const channel = client.channels.cache.get(player.textId);
  if (!channel) return null;
  return channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
}

/**
 * Append a lyrics embed to the Now Playing message. Existing embeds are
 * preserved; this simply pushes the lyrics embed at the end.
 */
async function addLyricsToNowPlaying(client, player, lyricsEmbed) {
  try {
    const message = await fetchNowPlayingMessage(client, player);
    if (!message) return false;
    await message.edit({
      embeds: [...message.embeds, lyricsEmbed],
      components: message.components,
    });
    return true;
  } catch (err) {
    logger.error(`addLyricsToNowPlaying failed: ${err.message}`);
    return false;
  }
}

/**
 * Strip every embed except the primary Now Playing one (index 0). Use this
 * to hide lyrics or to clear failed fetch artefacts.
 */
async function removeLyricsFromNowPlaying(client, player) {
  try {
    const message = await fetchNowPlayingMessage(client, player);
    if (!message) return false;
    const nowPlaying = message.embeds[0];
    await message.edit({
      embeds: nowPlaying ? [nowPlaying] : [],
      components: message.components,
    });
    return true;
  } catch (err) {
    logger.error(`removeLyricsFromNowPlaying failed: ${err.message}`);
    return false;
  }
}

/**
 * Replace only the components on the Now Playing message — typically used to
 * morph the pause button to resume (and vice versa). Embeds untouched.
 */
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
  scheduleAutoDelete,
  buildMusicControlRow,
  fetchNowPlayingMessage,
  addLyricsToNowPlaying,
  removeLyricsFromNowPlaying,
  swapNowPlayingComponents,
};
