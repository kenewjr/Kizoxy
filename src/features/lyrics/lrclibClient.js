// src/features/lyrics/lrclibClient.js
const axios = require("axios");
const Logger = require("../../lib/logger");

const logger = new Logger("LRCLIB");

const LRCLIB_API = "https://lrclib.net/api";
const LRCLIB_HEADERS = {
  "User-Agent": "Kizoxy Discord Bot (https://github.com/kenewjr/Kizoxy)",
};
const REQUEST_TIMEOUT_MS = 20_000;

const MIN_SCORE_ACCEPT = 55;
const MIN_SCORE_CONFIDENT = 120;

function _norm(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _jaccard(a, b) {
  const wa = new Set(_norm(a).split(" ").filter(Boolean));
  const wb = new Set(_norm(b).split(" ").filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function _scoreResult(result, trackName, artistName, durationSec) {
  let score = 0;

  const nt = _norm(trackName);
  const na = _norm(artistName);
  const rt = _norm(result.trackName || "");
  const ra = _norm(result.artistName || "");

  if (rt === nt) score += 100;
  else if (rt.includes(nt) || nt.includes(rt)) score += 60;
  else score += Math.round(_jaccard(rt, nt) * 55);

  if (na) {
    if (ra === na) score += 80;
    else if (ra.includes(na) || na.includes(ra)) score += 50;
    else score += Math.round(_jaccard(ra, na) * 45);
  }

  if (durationSec && result.duration) {
    const diff = Math.abs(result.duration - durationSec);
    if (diff <= 3) score += 60;
    else if (diff <= 10) score += 35;
    else if (diff <= 30) score += 15;
  }

  if (result.syncedLyrics) score += 15;
  if (result.plainLyrics || result.syncedLyrics) score += 5;

  return score;
}

function _pickBest(results, trackName, artistName, durationSec) {
  if (!results || results.length === 0) return null;

  const scored = results
    .filter((r) => r.plainLyrics || r.syncedLyrics)
    .map((r) => ({ result: r, score: _scoreResult(r, trackName, artistName, durationSec) }));

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.score >= MIN_SCORE_ACCEPT) {
    logger.debug(`Best match score=${best.score} "${best.result.trackName}" by "${best.result.artistName}"`);
    return best.result;
  }
  return null;
}

async function _get(trackName, artistName, durationSec) {
  if (!trackName || !artistName) return null;
  try {
    const params = { track_name: trackName, artist_name: artistName };
    if (durationSec) params.duration = Math.floor(durationSec);

    const res = await axios.get(`${LRCLIB_API}/get`, {
      params,
      headers: LRCLIB_HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    });

    if (res.status === 200 && res.data && (res.data.plainLyrics || res.data.syncedLyrics)) {
      return res.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function _search(params) {
  try {
    const res = await axios.get(`${LRCLIB_API}/search`, {
      params,
      headers: LRCLIB_HEADERS,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    });
    if (res.status === 200 && Array.isArray(res.data)) return res.data;
    return [];
  } catch {
    return [];
  }
}

async function searchLRCLIB(trackInfo) {
  const {
    cleanedTitle: trackName,
    cleanedAuthor: artistName,
    duration: durationSec,
    queries = [],
  } = trackInfo;

  logger.info(`Searching: "${trackName}" by "${artistName}"`);

  // Phase 1 — exact GET (most precise, short-circuits immediately)
  if (trackName && artistName) {
    const exact = await _get(trackName, artistName, durationSec);
    if (exact) {
      logger.success(`GET exact match: "${exact.trackName}" by "${exact.artistName}"`);
      return _format(exact);
    }
  }

  // Phase 2 — collect candidates from structured SEARCH (title + artist as separate params)
  const accumulated = new Map();

  const structuredResults = artistName
    ? await _search({ track_name: trackName, artist_name: artistName })
    : [];
  for (const r of structuredResults) if (r.id) accumulated.set(r.id, r);

  const best2 = _pickBest([...accumulated.values()], trackName, artistName, durationSec);
  if (best2 && _scoreResult(best2, trackName, artistName, durationSec) >= MIN_SCORE_CONFIDENT) {
    logger.success(`SEARCH structured high-confidence match: "${best2.trackName}" by "${best2.artistName}"`);
    return _format(best2);
  }

  // Phase 3 — freetext query strategies from buildQueryStrategies
  for (const q of queries) {
    const rows = await _search({ q });
    for (const r of rows) if (r.id && !accumulated.has(r.id)) accumulated.set(r.id, r);

    const candidate = _pickBest([...accumulated.values()], trackName, artistName, durationSec);
    if (candidate && _scoreResult(candidate, trackName, artistName, durationSec) >= MIN_SCORE_CONFIDENT) {
      logger.success(`SEARCH freetext high-confidence match after query "${q}"`);
      return _format(candidate);
    }
  }

  // Phase 4 — title-only search (catches tracks with no/wrong artist metadata)
  if (artistName) {
    const titleRows = await _search({ q: trackName });
    for (const r of titleRows) if (r.id && !accumulated.has(r.id)) accumulated.set(r.id, r);
  }

  // Phase 5 — best from all accumulated candidates above minimum threshold
  const finalBest = _pickBest([...accumulated.values()], trackName, artistName, durationSec);
  if (finalBest) {
    logger.success(`SEARCH best-of-all match (score=${_scoreResult(finalBest, trackName, artistName, durationSec)}): "${finalBest.trackName}" by "${finalBest.artistName}"`);
    return _format(finalBest);
  }

  logger.warning(`No lyrics found for "${trackName}" by "${artistName}"`);
  return null;
}

function _format(data) {
  const formatted = {
    source: "lrclib",
    text: data.plainLyrics || data.syncedLyrics || "",
    lines: [],
    hasSyncedLyrics: false,
  };

  if (data.syncedLyrics) {
    formatted.lines = _parseLrc(data.syncedLyrics);
    formatted.hasSyncedLyrics = formatted.lines.length > 0;
  }
  if (!formatted.text && formatted.lines.length > 0) {
    formatted.text = formatted.lines.map((l) => l.line).join("\n");
  }

  return formatted;
}

function _parseLrc(lrcText) {
  if (!lrcText) return [];

  const lines = [];
  for (const line of lrcText.split("\n")) {
    const m = line.match(/^\[(\d+):(\d+)\.?(\d+)?\](.*)/);
    if (!m) continue;

    const text = m[4].trim();
    if (!text || text.startsWith("[") || text.toLowerCase().includes("instrumental")) continue;

    const timestamp =
      parseInt(m[1]) * 60_000 +
      parseInt(m[2]) * 1_000 +
      (m[3] ? parseInt(m[3]) * 10 : 0);

    lines.push({ line: text, timestamp, duration: 2000 });
  }

  for (let i = 0; i < lines.length - 1; i++) {
    lines[i].duration = lines[i + 1].timestamp - lines[i].timestamp;
  }

  return lines;
}

module.exports = { searchLRCLIB };
