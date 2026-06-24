const { normalizeUsername } = require("../../persistence/tiktokStorage");

const RESOLVE_ERROR =
  "Couldn't parse a TikTok profile from that input. Use the full profile URL, e.g. https://www.tiktok.com/@username";

// @username inside a profile URL.
const URL_HANDLE_RE = /tiktok\.com\/@([\w.-]+)/i;
// Bare @handle or plain handle (no slashes, no spaces).
const BARE_HANDLE_RE = /^@?([\w.-]+)$/;

// Short links (vt./vm.tiktok.com/XXXX) point at a single video, not a profile —
// they can't be resolved to a username without a network expansion the chosen
// provider may not support, so reject them with a clear message.
const SHORT_LINK_RE = /(?:vt|vm)\.tiktok\.com\//i;

// Returns { username, profileUrl }. Throws Error(RESOLVE_ERROR) on bad input.
// The numeric tiktokUserId is discovered later by the client against the
// configured provider, not here.
function resolveProfile(input) {
  const raw = (input || "").trim();
  if (!raw) throw new Error(RESOLVE_ERROR);

  if (SHORT_LINK_RE.test(raw)) {
    throw new Error(
      "That looks like a share link to a single video. Provide the creator's profile URL instead (https://www.tiktok.com/@username).",
    );
  }

  const urlMatch = URL_HANDLE_RE.exec(raw);
  if (urlMatch) {
    const username = normalizeUsername(urlMatch[1]);
    return { username, profileUrl: `https://www.tiktok.com/@${username}` };
  }

  // Only treat as a bare handle when it isn't some other URL.
  if (!raw.includes("/") && BARE_HANDLE_RE.test(raw)) {
    const username = normalizeUsername(raw);
    return { username, profileUrl: `https://www.tiktok.com/@${username}` };
  }

  throw new Error(RESOLVE_ERROR);
}

module.exports = { resolveProfile, RESOLVE_ERROR };
