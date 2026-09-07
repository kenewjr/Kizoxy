const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const CUSTOM_ID_PREFIX = "lyrics-mode";

function nextMode(currentMode) {
  return currentMode === "original" ? "romaji" : "original";
}

function modeButton(customId, mode) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(mode === "original" ? "Original" : "Romaji")
    .setEmoji(mode === "original" ? "📜" : "🔤")
    .setStyle(ButtonStyle.Secondary);
}

function buildLyricsModeRow(ownerId, cacheKey, currentMode = "romaji") {
  const mode = nextMode(currentMode);
  return new ActionRowBuilder().addComponents(
    modeButton(`${CUSTOM_ID_PREFIX}:cmd:${mode}:${ownerId}:${cacheKey}`, mode),
  );
}

function buildNowPlayingLyricsModeRow(cacheKey, currentMode = "romaji") {
  const mode = nextMode(currentMode);
  return new ActionRowBuilder().addComponents(
    modeButton(`${CUSTOM_ID_PREFIX}:np:${mode}:${cacheKey}`, mode),
  );
}

function parseLyricsModeCustomId(customId) {
  const [prefix, scope, mode, value, cacheKey] = String(customId).split(":");
  if (
    prefix !== CUSTOM_ID_PREFIX ||
    !["cmd", "np"].includes(scope) ||
    !["original", "romaji"].includes(mode)
  ) {
    return null;
  }

  if (scope === "cmd" && value && cacheKey) {
    return { scope, mode, ownerId: value, cacheKey };
  }
  if (scope === "np" && value && !cacheKey) {
    return { scope, mode, cacheKey: value };
  }
  return null;
}

module.exports = {
  CUSTOM_ID_PREFIX,
  buildLyricsModeRow,
  buildNowPlayingLyricsModeRow,
  parseLyricsModeCustomId,
};

