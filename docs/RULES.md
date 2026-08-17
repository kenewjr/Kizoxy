# 📜 Development Guidelines & Engineering Rules — Kizoxy

## 1. Core Engineering Principles

1. **Single Source of Truth**: Dokumentasi `PROJECT_MEMORY.md` wajib selalu diperbarui setiap kali terjadi perubahan arsitektur, integrasi, atau penambahan fitur utama.
2. **Laziness is Efficiency**: Gunakan API native Node.js dan standar JavaScript terlebih dahulu sebelum menambahkan dependensi external baru.
3. **Shortest Working Diff**: Diutamakan modifikasi kode yang minimal, bersih, dan langsung menyelesaikan akar masalah.
4. **Never Mask Errors**: Dilarang menyembunyikan exception dengan try/catch kosong tanpa logging atau fallback yang valid.

---

## 2. TikTok Scraper Architecture Rules

1. **Zero Third-Party API Policy**: Scraper TikTok wajib menggunakan Pure Direct Scraper (`_fetchHtmlAggressive` + `_fetchHtmlProfile` + `_fetchOembedProfile`) tanpa ketergantungan pada TikWM atau Camofox proxy.
2. **Deduplication State Persistence**: Panggilan paksa notifikasi (`force-notify`) WAJIB memperbarui `tiktokStateStorage` (`lastVideoId`, `lastVideoCreateTime`, `seenVideoIds`, `isLive`, `lastLiveId`) untuk mencegah background scheduler menganggap video sebagai "baru" dan mengirimkan notifikasi berulang.
3. **Snowflake Timestamp Rule**: Jika `createTime` dari HTML metadata kosong, waktu pembuatan video WAJIB dihitung secara deterministic dari 64-bit TikTok Snowflake Video ID menggunakan rumus `Number(BigInt(id) >> 32n)`.
4. **Live Status Enum Rule**: Pengecekan siaran langsung TikTok WAJIB mendukung kode status `2` (`user.status === 2` atau `liveRoom.status === 2`) selain `1`.

---

## 3. Temporary Voice Channel (TempVC) Rules

1. **UI Panel Preservation**: Panel kontrol TempVC di Discord WAJIB mempertahankan grid 3 baris tombol interaktif.
2. **Ownership Transfer**: Jika pemilik channel keluar dari voice channel sementara anggota lain masih ada di dalam, kepemilikan WAJIB dialihkan secara otomatis ke anggota tertua yang tersisa.
3. **Self-Healing Requirement**: Saat bot di-restart, handler `loadTempVC.js` WAJIB memeriksa keberadaan channel di Discord API dan membersihkan status channel yang sudah dihapus secara manual.

---

## 4. Dashboard Architecture Rules

1. **Vanilla JS Dashboard**: Dashboard admin menggunakan arsitektur SPA Vanilla JS di `src/dashboard/public/`. Penggunaan Vue 3 atau framework frontend eksternal telah dihapus.
2. **Host-Only Access**: Dashboard Express HTTP server berjalan pada `127.0.0.1:4040` dan tidak diperbolehkan dibuka ke publik tanpa autentikasi yang memadai.

---

## 5. Persistence & Data Safety Rules

1. **Atomic Writes Only**: Semua operasi simpan file JSON di `src/persistence/` WAJIB menggunakan `jsonStorage.js` yang menjamin `tmp` file write + `fs.rename` + rotasi `.bak`.
2. **No Data Loss on Restart**: Modifikasi file konfigurasi atau state tidak boleh merusak struktur JSON saat proses berhenti mendadak.

---

## 6. Testing & Quality Standards

1. **Mandatory Verification**: Perubahan kode pada `src/` WAJIB diverifikasi dengan menjalankan suite unit test Jest (`npm test`).
2. **Zero Failing Tests**: Seluruh suite test (83 test suites, 950+ tests) WAJIB tetap 100% green setelah refactoring.
