const Embeds = require("../../lib/embeds");
const Logger = require("../../lib/logger");
const logger = new Logger("TRACK_EXCEPTION");

function sanitizeExceptionMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "Playback error";
  }

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("all clients failed") ||
    lower.includes("failed to load the item")
  ) {
    return "Audio stream could not be loaded by provider.";
  }
  if (
    lower.includes("decoding") ||
    lower.includes("cannot decode") ||
    lower.includes("unfriendlyexception") ||
    lower.includes("matroskastreamingfile")
  ) {
    return "Failed to decode audio format.";
  }
  if (
    lower.includes("requires login") ||
    lower.includes("sign in") ||
    lower.includes("age-restricted")
  ) {
    return "This track requires login or is age-restricted.";
  }
  if (
    lower.includes("not available") ||
    lower.includes("unavailable") ||
    lower.includes("blocked")
  ) {
    return "This track is unavailable or region-restricted.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "Connection to audio provider timed out.";
  }
  if (
    lower.includes("decoding") ||
    lower.includes("cannot decode") ||
    lower.includes("unfriendlyexception")
  ) {
    return "Failed to decode audio format.";
  }

  // Single line fallback without stack traces
  const firstLine = rawMessage.split("\n")[0].trim();
  const cleaned = firstLine
    .replace(/^[a-zA-Z0-9_$.]+:\s*/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();

  if (!cleaned || cleaned.startsWith("at ") || cleaned.length < 3) {
    return "Playback error occurred.";
  }

  // ponytail: truncate at 100 chars; upgrade when custom localization is added
  return cleaned.length > 100 ? `${cleaned.slice(0, 97)}...` : cleaned;
}

const playerException = async (client, player, payload) => {
  const track = player?.queue?.current;
  const title = track?.title || "Unknown track";
  const uri = track?.uri || "Unknown URL";
  const rawMessage = payload?.exception?.message || "Unknown playback error";

  logger.error(`Track exception: ${title} [${uri}] - ${rawMessage}`);

  const channel = client?.channels?.cache?.get(player?.textId);
  if (!channel) return;

  const friendlyMessage = sanitizeExceptionMessage(rawMessage);

  const embed = Embeds.brand(client, {
    description: `\`❌\` | *Track exception:* [${title}](${uri}) - \`${friendlyMessage}\``,
  });

  await channel.send({ embeds: [embed] }).catch(() => {});
};

playerException.sanitizeExceptionMessage = sanitizeExceptionMessage;

module.exports = playerException;
