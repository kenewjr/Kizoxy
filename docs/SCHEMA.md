# 📊 Persistence Schemas & API Payloads — Kizoxy

## 1. Storage System Mechanics (`src/persistence/`)

Penyimpanan data Kizoxy berbasis file JSON dengan mekanisme **Atomic File Writes**:

1. Menulis data baru ke file sementara (`data/<name>.json.tmp`).
2. Mengganti file lama secara atomic via `fs.rename`.
3. Membuat cadangan otomatis (`data/<name>.json.bak`) sebelum penulisan.
4. Lazy loading saat inisialisasi bot untuk menghemat memori.

---

## 2. Core JSON Data Schemas

### 2.1 TikTok Storage (`data/tiktok_subscriptions.json` & `data/tiktok_state.json`)

#### Subscriptions Schema:

```json
{
  "guild_id_123": [
    {
      "subId": "sub_1786200000000",
      "username": "elena.db2",
      "channelId": "123456789012345678",
      "pingRoleId": "987654321098765432",
      "customMessage": "{author} baru saja mengunggah video TikTok baru!",
      "createdAt": 1786200000000
    }
  ]
}
```

#### State Schema:

```json
{
  "guild_id_123:sub_1786200000000": {
    "lastVideoId": "7671848043116890902",
    "lastVideoCreateTime": 1786241951,
    "seenVideoIds": ["7671848043116890902", "7653055317907131656"],
    "isLive": true,
    "lastLiveId": "7671848043116890902",
    "updatedAt": 1786242000000
  }
}
```

---

### 2.2 YouTube Storage (`data/youtube_subscriptions.json` & `data/youtube_state.json`)

#### Subscriptions Schema:

```json
{
  "guild_id_123": [
    {
      "subId": "yt_1786200000000",
      "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "channelHandle": "@Google",
      "channelName": "Google",
      "discordChannelId": "123456789012345678",
      "pingRoleId": null,
      "customMessage": "{author} merilis video baru di YouTube!",
      "createdAt": 1786200000000
    }
  ]
}
```

---

### 2.3 TempVC Storage (`data/temp_vc_settings.json` & `data/temp_vc_active.json`)

#### Settings Schema:

```json
{
  "guild_id_123": {
    "generatorChannelId": "111222333444555666",
    "categoryId": "777888999000111222",
    "interfaceChannelId": "333444555666777888",
    "interfaceMessageId": "999000111222333444",
    "userLimit": 0,
    "nameTemplate": "🔊 Room {user}",
    "voiceRoleId": "555666777888999000"
  }
}
```

#### Active Channels Schema:

```json
{
  "channel_id_999": {
    "guildId": "guild_id_123",
    "channelId": "channel_id_999",
    "ownerId": "user_id_456",
    "createdAt": 1786200000000
  }
}
```

---

### 2.4 Alarm Storage (`data/alarms.json`)

```json
{
  "guild_id_123": [
    {
      "alarmId": "alarm_1786200000000",
      "channelId": "123456789012345678",
      "creatorId": "user_id_456",
      "message": "Pengingat Rapat Tim",
      "targetTimestamp": 1786300000,
      "recurring": "daily",
      "timezone": "Asia/Jakarta"
    }
  ]
}
```

---

## 3. Dashboard REST API Endpoint Overview

- `GET /api/meta`: Metadata bot, uptime, memory, total guilds, total channels.
- `GET /api/guilds`: Daftar guild yang dilayani bot.
- `GET /api/guilds/:id`: Detail konfigurasi dan fitur server tertentu.
- `GET /api/guilds/:id/tiktok`: Subskripsi TikTok per server.
- `POST /api/guilds/:id/tiktok`: Tambah subskripsi TikTok baru.
- `DELETE /api/guilds/:id/tiktok/:subId`: Hapus subskripsi TikTok.
- `POST /api/guilds/:id/tiktok/:subId/force-notify`: Kirim notifikasi paksa & perbarui state deduplikasi.
- `GET /api/logs`: Audit log real-time dengan paginasi dan filter level.
