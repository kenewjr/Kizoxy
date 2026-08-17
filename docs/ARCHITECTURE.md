# 🏗️ System Architecture — Kizoxy

## 1. High-Level Architecture Diagram

```
                               ┌───────────────────────────┐
                               │   Discord Gateway & API   │
                               └─────────────┬─────────────┘
                                             │
                                             ▼
                                ┌─────────────────────────┐
                                │       src/index.js      │
                                │  Parallel Bootstrapper  │
                                └────────────┬────────────┘
                                             │
      ┌──────────────────────────────┬───────┴───────┬──────────────────────────────┐
      │                              │               │                              │
      ▼                              ▼               ▼                              ▼
┌──────────────┐             ┌──────────────┐ ┌──────────────┐             ┌────────────────┐
│   Loaders    │             │   Features   │ │ Integrations │             │   Dashboard    │
│ (12 Loaders) │             │ (Domain Brain│ │(YouTube/TikTok│            │ (Express HTTP) │
└──────┬───────┘             └──────┬───────┘ └──────┬───────┘             └───────┬────────┘
       │                            │                │                             │
       ▼                            ▼                ▼                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              src/persistence/ (JSON Storage)                              │
│       jsonStorage, tempVcStorage, levelStorage, youtubeStorage, tiktokStorage, etc.       │
│                  Atomic file writes via tmp -> rename + .bak rotation                     │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layered Architecture Principles

Codebase Kizoxy dibagi menjadi 5 layer utama di bawah `src/`:

1. **config** (`src/config/`): Sumber tunggal env reader dan konstanta global.
2. **loaders + index** (`src/loaders/`, `src/index.js`): Inisialisasi sistem, pendaftaran handler dinamis, dan recovery saat boot.
3. **features** (`src/features/`): Pusat logika bisnis domain (music, tempvc, alarm, fixembed, level, lyrics).
4. **persistence** (`src/persistence/`): Layer penyimpanan file JSON yang tahan korupsi.
5. **lib** (`src/lib/`): Primitive helper stateless (logger, embeds, interactions, webhookReporter).

_Catatan Arsitektur_: Surface adapters (commands, interactions, events) mengimpor logika dari layer `features` dan tidak pernah menyimpan business logic secara langsung.

---

## 3. Core Component Subsystems

### 3.1 Music Subsystem (Kazagumo + Lavalink + LRCLIB)

- **Kazagumo & Shoukaku**: Mengelola koneksi node Lavalink, player state, dan event track/queue.
- **Lyrics Orchestrator (`lyricsService.js`)**: Multi-phase LRCLIB client + Kuroshiro Romaji converter + NodeCache (24 jam TTL).

### 3.2 Temporary Voice Channels (`src/features/tempvc/`)

- **Lifecycle Engine**: Mendeteksi gerakan voice channel anggota via `voiceStateUpdate.js`.
- **Panel Interface Manager**: Mengelola 3 baris tombol kontrol dan menyelaraskan status panel secara otomatis (`updateInterface`).
- **State Healing**: Recovery generator dan channel aktif saat boot di `loadTempVC.js`.

### 3.3 TikTok Pure Direct Scraper (`src/integrations/tiktok/`)

- **Direct Scraper Architecture**: Bebas API pihak ketiga dan bebas proxy.
- **Strategy Chain**:
  - **Strategy 1 (Aggressive HTML Scraper)**: Rotasi 4 User-Agent (Desktop Chrome, Mac Chrome, Firefox, Android Chrome), parsing JSON blobs (`SIGI_STATE`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`, script tags), ekstraksi regex snowflake ID `7\d{18}`, dan penghitungan timestamp via `BigInt(id) >> 32n`.
  - **Strategy 2 (Direct HTML Rehydration)**: Ekstraksi script `__UNIVERSAL_DATA_FOR_REHYDRATION__`.
  - **Strategy 3 (TikTok oEmbed)**: Konfirmasi keberadaan akun.
- **Live Detection**: Parse `<script>` tag berisi JSON `LiveRoom` untuk memeriksa status siaran langsung (`status: 2` = Live).

### 3.4 Host-Only Express Admin Dashboard (`src/dashboard/`)

- Express HTTP server tertanam pada port `127.0.0.1:4040`.
- Menyediakan REST API privat (`/api/meta`, `/api/guilds`, `/api/logs`, `/api/config`, `/api/sendmsg`, dll.).
- Shell SPA tunggal berbasis Vanilla JS di `src/dashboard/public/`.

### 3.5 Persistence Engine (`src/persistence/`)

- Menggunakan `jsonStorage.js` sebagai kelas dasar.
- Penuangan data dilakukan secara atomic (`write to .tmp` → `fs.rename` ke file asli + `create .bak backup`).
- Lazy loading saat boot mencegah I/O berlebih.
