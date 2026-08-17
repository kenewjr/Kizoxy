# 📄 Product Requirements Document (PRD) — Kizoxy

## 1. Executive Summary

**Kizoxy** adalah bot Discord multipurpose enterprise-grade berbahasa Indonesia yang dirancang untuk memberikan pengalaman musik berkualitas tinggi (Lavalink / Kazagumo), manajemen Temporary Voice Channels (TempVC) otomatis, sistem alarm berulang, auto-fix embed media sosial (FixEmbed), notifikasi otomatis YouTube & TikTok (Direct Scraper tanpa API pihak ketiga), leveling XP, serta dashboard admin lokal (Express HTTP SPA).

---

## 2. Core Modules & Capabilities

### 2.1 Music Engine (Lavalink / Kazagumo)

- **Playback Control**: Slash commands (`/play`, `/pause`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/volume`, `/shuffle`, `/forward`, `/remove`) dan prefix commands (`kplay`, `kskip`, dll).
- **Lofi 24/7 Mode**: Auto-re-queue stream lofi saat antrean habis atau terputus.
- **Audio Presets & Filters**: 8 filter audio preset (BassBoost, Nightcore, 3D, Vaporwave, Pop, Soft, TrebleBass, Distortion).
- **Lyrics System**: Multi-phase LRCLIB client (Phase 0–5) + Kuroshiro Romaji converter (Kanji → Romaji) + NodeCache (24h TTL, 500 keys).

### 2.2 Temporary Voice Channels (TempVC)

- **Generator Channels**: Otomatis membuat voice channel baru saat member masuk generator channel.
- **Control Panel Interface**: Interactive 3-row button panel (Lock, Unlock, Hide, Show, Reset, Allow, Ban, Kick, Transfer, Claim, Rename, Limit, Mute All, Unban All, Pin Info).
- **Voice Roles & Claim**: Auto-role untuk anggota di voice channel dan klaim kepemilikan jika owner keluar dari channel.
- **Self-Healing State**: Penyelarasan ulang status channel dan pemulihan panel saat bot restart.

### 2.3 Social Notifications (YouTube & TikTok)

- **YouTube Notifications**: Polling RSS feed YouTube + channel ID @handle resolver.
- **TikTok Notifications (Pure Direct Scraper)**: Polling profil TikTok tanpa API pihak ketiga (Strategy 1: Aggressive Direct Scraper dengan rotasi User-Agent, parsing JSON blobs `SIGI_STATE`/`__UNIVERSAL_DATA_FOR_REHYDRATION__`, dan kalkulasi timestamp otomatis dari 64-bit TikTok Snowflake ID).
- **Multi-Content Support**: Mendukung video standar, slide foto, dan status siaran langsung (Live detection status code 2).

### 2.4 FixEmbed (Media Embed Fixer)

- Otomatis mendeteksi link media sosial pada pesan dan mengganti link dengan service fixer yang menghasilkan rich embed Discord yang optimal:
  - **Twitter / X**: `fxtwitter.com`
  - **Instagram**: `kkinstagram.com`
  - **TikTok**: `tnktok.com`
  - **Reddit**: `vxreddit.com`
  - **Threads**: `fixthreads.seria.moe`
  - **Bluesky**: `fxbsky.app`
  - **Facebook**: `embedez.com` / `facebed.com`
  - **Tumblr**: `tpmblr.com`

### 2.5 Timezone-Aware Alarm System

- **Single & Recurring Alarms**: Penjadwalan alarm satu kali atau berulang (harian, mingguan, hari kerja).
- **Timezone Awareness**: Mendukung WIB, WITA, WIT, UTC, dan zona waktu internasional.
- **Countdown Auto-Updater**: Memperbarui status hitung mundur secara real-time pada pesan alarm.

### 2.6 Leveling & XP System

- **Per-Message XP Gain**: Akumulasi XP acak dengan cooldown per member.
- **Leaderboard**: Visualisasi peringkatXP server via slash command `/level` dan dashboard.
- **Role Rewards**: Pemberian role otomatis saat mencapai level tertentu.

### 2.7 Host-Only Admin Dashboard

- **Local SPA Interface**: Servis HTTP Express di `127.0.0.1:4040` (tanpa auth, khusus akses localhost owner).
- **Developer Tool Aesthetics**: UI Dark mode modern berbasis Vanilla JS + CSS Tokens (Overview, Guild Settings, Subscription Manager, Log Viewer, Config Editor, Send Message Tool).

---

## 3. Non-Functional Requirements

- **Performance**: Event loop non-blocking dengan async I/O dan JSON storage atomic.
- **Reliability**: Atomic file writes (`tmp` → `rename` + `.bak` rotation) mencegah korupsi data saat shutdown mendadak.
- **Test Coverage**: 83 Jest test suites (950+ tests) passing 100% green.
- **Language Standard**: Seluruh pesan UX Discord, footer embed, dan balasan interaksi menggunakan Bahasa Indonesia.
