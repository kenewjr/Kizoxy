# 🎨 UI/UX Design System Specification — Kizoxy

## 1. Design System Overview
Kizoxy mengusung **Dark Developer Tool Aesthetics** yang konsisten di seluruh surface (Discord Embeds & HTTP Admin Dashboard). Desain berfokus pada scannability tinggi, kontras warna yang tajam, komponen yang responsif, serta animasi mikro yang halus.

---

## 2. Palette & Color Tokens

### 2.1 Core Dark Tokens (Dashboard & UI Shell)
| Token | Hex / Value | Penggunaan |
| :--- | :--- | :--- |
| `--bg-1` | `#0b0e14` | Latar belakang utama halaman |
| `--bg-2` | `#121722` | Permukaan card, panel, dan sidebar |
| `--bg-elevated` | `#1a202c` | Surface melayang, modal, dan dropdown |
| `--border` | `#2d3748` | Garis pembatas komponen |
| `--text-1` | `#f7fafc` | Teks utama / heading |
| `--text-2` | `#cbd5e0` | Teks sekunder / deskripsi |
| `--text-3` | `#a0aec0` | Teks muted / timestamp |

### 2.2 Functional Accent Colors
| Accent | Hex | Peran |
| :--- | :--- | :--- |
| `--accent` | `#6366f1` (Indigo) | Warna brand utama, tombol primer, active tab |
| `--green` | `#10b981` (Emerald) | Status sukses, indikator online, badge active |
| `--yellow` | `#f59e0b` (Amber) | Peringatan, status paused, warning toast |
| `--red` | `#ef4444` (Rose) | Status error, live indicator (🔴), tombol hapus |
| `--purple` | `#8b5cf6` (Purple) | Fitur khusus, TempVC badge |

---

## 3. Typography & Spacing
- **Discord Embed Font**: Native Discord System Font (`gg sans`, BlinkMacSystemFont).
- **Dashboard Font**: `Inter`, sans-serif (Google Fonts).
- **Monospace Font**: `JetBrains Mono` / `Fira Code` (digunakan untuk Channel ID, Role ID, log viewer, dan JSON code blocks).

---

## 4. Discord Component Layouts

### 4.1 TempVC Control Panel (3-Row Button Grid)
- **Baris 1**: 🔒 Lock | 🔓 Unlock | 🙈 Hide | 👁 Show | 🔄 Reset
- **Baris 2**: ➕ Allow | 🚫 Ban | 🦵 Kick | 👑 Transfer | 📋 Claim
- **Baris 3**: ✏️ Rename | 🔢 Limit | 🔇 Mute All | 👂 Unban All | 📌 Pin Info

### 4.2 Discord Card Message Previews
- Dashboard menyediakan visualisasi komponen Discord secara real-time sebelum pesan dikirim.
- Mendukung preview embed, tag mention, button action rows, dan custom message templates.

---

## 5. Dashboard SPA Component Architecture
- **Vanilla JS SPA**: Tanpa framework (Pure JS + CSS Custom Properties).
- **Modul Halaman**:
  - `pages-overview.js`: Ringkasan bot (stats, uptime, memory, player count).
  - `pages-guilds.js`: Daftar guild & navigator server.
  - `pages-guild-core.js`: Pengaturan dasar guild & tab switcher.
  - `pages-guild-notif.js`: Manajemen langganan YouTube & TikTok.
  - `pages-guild-system.js`: Pengaturan TempVC, Alarms, dan Leveling.
  - `pages-guild-sendmsg.js`: Interface Compose & Send Message.
  - `pages-logs.js`: Log viewer real-time dengan filter level.
  - `pages-admin.js`: Konfigurasi global & rotasi presence bot.
