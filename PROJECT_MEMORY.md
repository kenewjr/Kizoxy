> ⚠️ **ATURAN PROSES WAJIB**: Baca seluruh dokumen ini terlebih dahulu (termasuk Changelog) sebelum melakukan task apa pun agar tidak mengulang kesalahan yang sama.

# 🧠 PROJECT MEMORY - Kizoxy Bot (v2.5.0)

Dokumentasi ini dibuat sebagai **Single Source of Truth** (Memory Project) agar AI agen lain atau developer baru dapat langsung memahami arsitektur, konfigurasi, file map, serta aturan proyek ini tanpa hambatan.

---

## 📌 1. Ringkasan Proyek (Project Overview)

**Kizoxy** adalah bot Discord multipurpose enterprise-grade berbahasa Indonesia. Fitur utama meliputi:

- **Music Player**: Lavalink / Kazagumo engine dengan lofi 24/7, 8 preset audio filter, sistem lirik LRCLIB + Kuroshiro Romaji converter.
- **Temporary Voice Channels (TempVC)**: Generator voice channel otomatis dengan control panel 3-row button grid, voice roles, dan auto-claim ownership.
- **Social Media Notifications**: Notifikasi YouTube (RSS polling) & TikTok (Pure Direct Scraper tanpa API pihak ketiga) dengan live stream detection.
- **FixEmbed Engine**: Auto-fix link media sosial (Twitter/X, Instagram, TikTok, Reddit, Threads, Bluesky, Facebook, Tumblr) ke service embed yang optimal.
- **Timezone-Aware Alarms**: Penjadwalan alarm satu kali atau berulang (WIB/WITA/WIT/UTC).
- **Leveling System**: XP per pesan, leaderboard server, dan role rewards.
- **Host-Only Admin Dashboard**: Express HTTP SPA di `127.0.0.1:4040` berbasis Vanilla JS + CSS Tokens.

---

## 🛠️ 2. Teknologi & Package Dependencies

1. **Runtime & Core**:
   - Node.js >= 20 (CommonJS).
   - `discord.js` v14 (Discord API wrapper).
2. **Music Engine**:
   - `kazagumo` + `shoukaku` (Lavalink client & node wrapper).
   - `@discordjs/voice` + `opusscript` / `tweetnacl`.
   - `kuroshiro` + `kuroshiro-analyzer-kuromoji` (Kanji → Romaji converter).
   - `node-cache` (Caching lirik 24 jam).
3. **HTTP Server & Dashboard**:
   - `express` (Internal HTTP server port 4040).
   - Vanilla JS Single Page Application (`src/dashboard/public/`).
4. **Testing**:
   - `jest` (Test runner dengan 83 test suites & 950+ unit tests).

---

## 📂 3. Peta File & Arsitektur (File Structure Map)

| File / Directory       | Peran & Tanggung Jawab                                                                                                        |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `src/index.js`         | Bootstrapper utama bot: inisialisasi client Discord, memuat 12 loaders, dan menjalankan HTTP server dashboard.                |
| `src/config/`          | Environtment reader (`index.js`) dan konstanta global (`constants.js`).                                                       |
| `src/loaders/`         | 12 modul pendaftaran handler dinamis (events, commands, music, tempvc, alarm, fixembed, youtube, tiktok, dll).                |
| `src/features/`        | Logika bisnis domain utama (`music/`, `tempvc/`, `alarm/`, `fixembed/`, `level/`, `lyrics/`).                                 |
| `src/integrations/`    | Service integrasi eksternal: TikTok Pure Direct Scraper (`tiktok/`), YouTube RSS (`youtube/`), Music Lavalink (`music/`).     |
| `src/persistence/`     | Atomic JSON storage layer (`jsonStorage.js`, `tempVcStorage.js`, `levelStorage.js`, `tiktokStorage.js`, `youtubeStorage.js`). |
| `src/dashboard/`       | Express HTTP server (`server.js`), API routes (`routes/`), dan Vanilla JS SPA (`public/`).                                    |
| `src/lib/`             | Utility primitive (`logger.js`, `embeds.js`, `interactions.js`, `webhookReporter.js`).                                        |
| `docs/PRD.md`          | Product Requirements Document.                                                                                                |
| `docs/ARCHITECTURE.md` | Dokumentasi Arsitektur & System Diagram.                                                                                      |
| `docs/DESIGN.md`       | Spesifikasi UI/UX & Design Tokens.                                                                                            |
| `docs/SCHEMA.md`       | Skema Storage JSON & Payloads API Dashboard.                                                                                  |
| `docs/RULES.md`        | Aturan Pengembang & Architecture Constraints.                                                                                 |

---

## 🛡️ 4. Subsistem Utama & Modul

### 4.1 TikTok Pure Direct Scraper (`src/integrations/tiktok/client.js`)

- **Tanpa Proxy / Third-Party API**: TikWM & Camofox telah dihapus sepenuhnya.
- **Strategy Chain**:
  - **Strategy 1 (Aggressive HTML Scraper)**: Rotasi 4 User-Agent, parsing JSON blobs (`SIGI_STATE`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`), ekstraksi snowflake ID, dan kalkulasi timestamp via `BigInt(id) >> 32n`.
  - **Strategy 2 (Direct HTML Rehydration)**: Parsing script rehidrasi TikTok.
  - **Strategy 3 (TikTok oEmbed)**: Validasi keberadaan akun.
- **Live Stream Detection**: Mendukung status siaran langsung `user.status === 2` atau `liveRoom.status === 2`.

### 4.2 Temporary Voice Channels (`src/features/tempvc/`)

- Membuat voice channel otomatis saat masuk channel generator.
- 3-Row interactive button grid di Discord (`lock`, `unlock`, `hide`, `show`, `reset`, `allow`, `ban`, `kick`, `transfer`, `claim`, `rename`, `limit`, `muteall`, `unbanall`, `pininfo`).
- Auto-claim kepemilikan jika owner keluar room.

### 4.3 Host-Only Admin Dashboard (`src/dashboard/`)

- Servis HTTP Express di `127.0.0.1:4040`.
- Vanilla JS Single Page Application (SPA) di `src/dashboard/public/`.
- Manajemen guild, notifikasi YouTube/TikTok, log audit, dan pengirim pesan manual.

---

## ⚡ 5. Cara Menjalankan & Testing

```bash
# Menjalankan Bot secara Local
npm start

# Menjalankan Unit Test Suite (Jest)
npm test
```

---

## 📋 6. Changelog & Audit Log

### [v2.5.2] - 2026-08-09

- **TikTok Multi-Source Resilience & Health Monitoring**:
  - **Empirical PRE-FLIGHT Audit**: Live-tested public TikTok API candidates (`TikWM`, `TiklyDown`, `Countik`, `oEmbed`) against 5 active test accounts (`kenewjr`, `qingdaosixi`, `elena.db2`, `yghtfc928`, `wulanshop123`). Diagnosed TikWM & Countik direct API calls returning `HTTP 403 Forbidden` due to Cloudflare WAF bot challenges.
  - **Restructured Strategy Chain**: Rebuilt `client.js` strategy chain combining Direct HTML + Cookie Auth (`_fetchHtmlAggressive`), Direct Rehydration (`_fetchHtmlProfile`), TikWM API fallback (`_fetchTikwm`), and official TikTok oEmbed verification (`_fetchOembedProfile`).
  - **Dashboard Health Warning Banner**: Extended `getStrategyStats()` with `primary_healthy` and `warning_banner` fields. Rendered prominent red health alert banner in `src/dashboard/public/pages-guild-notif.js` when primary strategy success rate drops below 20%.
  - **Unit Test Suite Expansion**: Added strategy fallback & health banner test cases in `tests/integrations/tiktok/tiktokClient.test.js`. All 83 test suites (964 unit tests) passing 100% green.

---

## 💡 7. Knowledge Items & Gotchas (KI)

- **TikTok Multi-Source Architecture Pivot**:
  - _Symptom_: Direct fetch scrapers without signed parameters (`X-Bogus`, `msToken`) or valid session cookies intermittently return 0 videos due to 2026-era TikTok anti-bot WAF protection.
  - _Architecture_: Multi-strategy fallback chain combining Direct HTML Scraper + Cookie Auth (`_fetchHtmlAggressive`), Direct Rehydration (`_fetchHtmlProfile`), TikWM API fallback (`_fetchTikwm`), and official keyless TikTok oEmbed (`_fetchOembedProfile`).
  - _Maintenance_: Third-party APIs and scraper selectors evolve periodically. "Primary source failing" is an expected recurring event. Always run empirical pre-flight `curl`/`fetch` checks before changing strategy order.
- **Dashboard TikTok Health Warning Banner**:
  - _Trigger_: When primary strategy success rate over `_STATS_WINDOW` (100 calls) falls below 20%, `getStrategyStats()` sets `warning_banner` string, rendering a red warning banner in the dashboard.
- **TikTok Live Dedup Instability**:
  - _Symptom_: TikTok live notifications firing repeated duplicate embeds during an ongoing live stream.
  - _Root Cause_: Multi-strategy/multi-UA scraper rotation caused `profile.user.liveId` to fluctuate between polls (e.g. roomId string vs `""` vs `null`), breaking equality checks (`state.lastLiveId === liveId`).
  - _Fix_: Gate re-announcements on `state.isLive === true` rising-edge transition with a 2-consecutive-miss `notLiveStreak` debounce. Do not use `liveId` equality as the announcement trigger.
- **TikTok Cookie Storage**:
  - _Location_: `src/integrations/tiktok/cookieStorage.js` (`data/tiktok_cookies.json`).
  - _Wiring_: `_buildCookieHeader()` in `src/integrations/tiktok/client.js` formats cookies as `key1=val1; key2=val2` for fetch headers. Never log raw cookie credentials.
