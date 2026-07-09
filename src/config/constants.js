// Shared constants used across 3+ files go here (Rule N5). Subsystem-local
// values that are only used within one file stay at the top of that file.

module.exports = {
  // YouTube notifications subsystem.
  YOUTUBE_POLL_INTERVAL_MS: 60000,
  // YouTube API does not expose a stable "is this a Short" flag, so duration is
  // the fallback signal: Shorts are <= 3 minutes.
  YOUTUBE_SHORT_MAX_SECONDS: 180,
  YOUTUBE_HTTP_TIMEOUT_MS: 10000,

  // TikTok notifications subsystem.
  TIKTOK_POLL_INTERVAL_MS: 45000,
  TIKTOK_HTTP_TIMEOUT_MS: 10000,
  // Exponential backoff for a failing profile: base * 2^consecutiveFailures,
  // capped. Prevents hammering the provider (and getting rate-limited) when an
  // account is deleted or the provider is down.
  TIKTOK_BACKOFF_BASE_MS: 60000,
  TIKTOK_BACKOFF_MAX_MS: 1800000,

  // Ephemeral auto-delete settings (Rule Q1).
  EPHEMERAL_AUTO_DELETE_MS: 15000,

  // Dashboard log viewer caps.
  MAX_LOG_LINES: 5000,
  LOG_TAIL_DEFAULT: 200,
  LOG_SEARCH_MAX: 500,
};
