const Logger = require("../../lib/logger");
const { sendErrorWebhook } = require("../../lib/webhookReporter");

const logger = new Logger("KIZOXY-SCRAPER");

const BASE_URL = (
  process.env.SCRAPER_SERVICE_URL ||
  process.env.SCRAPER_API_URL ||
  "http://127.0.0.1:8100"
).replace(/\/+$/, "");

function getApiKey() {
  // SCRAPER_SERVICE_API_KEY is the documented name (matches
  // SCRAPER_SERVICE_URL and .env.example). API_KEY is kept as a fallback
  // for backward compatibility with existing deployments. Whichever name
  // is used here MUST match app/config.py's `api_key` (API_KEY env var)
  // on the kizoxy-scraper side, or every request gets rejected with 403.
  return (
    process.env.SCRAPER_SERVICE_API_KEY ||
    process.env.API_KEY ||
    "change-me-to-a-secure-random-secret"
  );
}

let _healthState = {
  status: "Unknown", // "Online" | "Degraded" | "Offline"
  lastChecked: null,
  browserPool: null,
  error: null,
  reconnectAttempts: 0,
};

let _lastLoggedOffline = false;
let _reconnectAttempts = 0;
let _isReconnecting = false;
let _reconnectTimer = null;

async function checkHealth() {
  const apiKey = getApiKey();
  const wasUnknown = _healthState.status === "Unknown";
  const wasOffline =
    _healthState.status === "Offline" ||
    _lastLoggedOffline ||
    _reconnectAttempts > 0;

  try {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const pool = data.browser_pool || null;
    const isDegraded = pool && pool.available === 0 && pool.total > 0;
    const status = isDegraded ? "Degraded" : "Online";

    if (wasUnknown) {
      logger.success(
        `[SCRAPER] [CONNECTED] Connected to kizoxy-scraper service at ${BASE_URL} (Status: ${status})`,
      );
    } else if (wasOffline) {
      logger.success(
        `[SCRAPER] [CONNECTED] Re-established connection to kizoxy-scraper service at ${BASE_URL} (Status: ${status})`,
      );
    }

    _lastLoggedOffline = false;
    _reconnectAttempts = 0;
    _isReconnecting = false;
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }

    _healthState = {
      status,
      lastChecked: new Date().toISOString(),
      browserPool: pool,
      error: null,
      reconnectAttempts: 0,
    };

    return _healthState;
  } catch (err) {
    const wasOnline =
      _healthState.status === "Online" ||
      _healthState.status === "Degraded" ||
      wasUnknown;
    _healthState = {
      status: "Offline",
      lastChecked: new Date().toISOString(),
      browserPool: null,
      error: err.message,
      reconnectAttempts: _reconnectAttempts,
    };

    if (wasOnline || !_lastLoggedOffline) {
      logger.error(
        `[SCRAPER] [DISCONNECTED] Service offline at ${BASE_URL} (${err.message})`,
      );
      _lastLoggedOffline = true;
      sendErrorWebhook(
        "Scraper Service Offline",
        new Error(`[SCRAPER] Service offline at ${BASE_URL}: ${err.message}`),
        { "Base URL": BASE_URL },
      ).catch(() => {});
    }

    triggerAutoReconnect();
    return _healthState;
  }
}

function triggerAutoReconnect() {
  if (_isReconnecting) return;
  _isReconnecting = true;
  _reconnectAttempts = 0;

  const runReconnectStep = () => {
    _reconnectAttempts++;
    const delay = Math.min(
      Math.round(5000 * Math.pow(1.3, _reconnectAttempts - 1)),
      30000,
    );
    logger.info(
      `[SCRAPER] [AUTO-RECONNECT] Attempt ${_reconnectAttempts}: Retrying connection to ${BASE_URL} in ${Math.round(delay / 1000)}s...`,
    );

    _reconnectTimer = setTimeout(async () => {
      try {
        const state = await checkHealth();
        if (state.status === "Offline") {
          runReconnectStep();
        } else {
          _isReconnecting = false;
        }
      } catch (_) {
        runReconnectStep();
      }
    }, delay);
  };

  runReconnectStep();
}

function getServiceStatus() {
  return _healthState;
}

let _healthIntervalTimer = null;
function initHealthCheck() {
  checkHealth();
  if (!_healthIntervalTimer) {
    _healthIntervalTimer = setInterval(async () => {
      if (!_isReconnecting) await checkHealth();
    }, 30_000);
    if (_healthIntervalTimer.unref) _healthIntervalTimer.unref();
  }
}

async function request(path, options = {}) {
  const apiKey = getApiKey();
  const headers = {
    "x-api-key": apiKey,
    Accept: "application/json",
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let body;
      try {
        body = JSON.parse(text);
      } catch (_) {}
      const err = new Error(
        body?.error?.message || body?.detail || `HTTP ${res.status}`,
      );
      err.code =
        body?.error?.code ||
        (res.status === 404
          ? "NOT_FOUND"
          : res.status === 403
            ? "BLOCKED"
            : "INTERNAL");
      err.status = res.status;
      throw err;
    }

    const body = await res.json();
    if (!body.success) {
      const err = new Error(body.error?.message ?? "Scraper service error");
      err.code = body.error?.code ?? "INTERNAL";
      err.status = res.status;
      throw err;
    }

    if (
      _healthState.status === "Offline" ||
      _lastLoggedOffline ||
      _reconnectAttempts > 0
    ) {
      logger.success(
        `[SCRAPER] [CONNECTED] Re-established connection to kizoxy-scraper service at ${BASE_URL} (Status: Online)`,
      );
    }
    _healthState.status = "Online";
    _healthState.error = null;
    _lastLoggedOffline = false;
    _reconnectAttempts = 0;
    _isReconnecting = false;
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }

    return body;
  } catch (err) {
    if (!err.status) {
      if (_healthState.status !== "Offline" || !_lastLoggedOffline) {
        logger.error(
          `[SCRAPER] [DISCONNECTED] Disconnected from kizoxy-scraper service during ${path} (${err.message})`,
        );
        sendErrorWebhook(
          "Scraper Request Timeout",
          new Error(
            `[SCRAPER] Request failed to ${path} at ${BASE_URL}: ${err.message}`,
          ),
        ).catch(() => {});
      }
      _healthState.status = "Offline";
      _healthState.error = err.message;
      _lastLoggedOffline = true;
      triggerAutoReconnect();
    }
    throw err;
  }
}

function buildTiktokPath(type, username) {
  const sid = (
    process.env.TIKTOK_SESSION_ID ||
    process.env.TIKTOK_COOKIE ||
    ""
  ).trim();
  const q = sid ? `?session_id=${encodeURIComponent(sid)}` : "";
  return `/tiktok/user/${username}/${type}${q}`;
}

module.exports = {
  checkHealth,
  getServiceStatus,
  initHealthCheck,
  triggerAutoReconnect,
  getTiktokPosts: (username) => request(buildTiktokPath("posts", username)),
  getTiktokLiveStatus: (username) => request(buildTiktokPath("live", username)),
  getYoutubeLatestVideos: async (channelId, limit = 5) => {
    const body = await request(
      `/youtube/channel/${channelId}/latest?limit=${limit}`,
    );
    return body.data;
  },
  getYoutubeLiveStatus: async (channelId) => {
    const body = await request(`/youtube/channel/${channelId}/live`);
    return body.data;
  },
  BASE_URL,
};
