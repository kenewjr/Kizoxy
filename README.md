<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:6366f1,50:8b5cf6,100:ec4899&text=Kizoxy&textBg=false&fontSize=90&fontAlignY=38&fontColor=ffffff&animation=fadeIn&strokeWidth=0&desc=A%20premium%20multipurpose%20Discord%20bot&descAlignY=62&descSize=18" alt="Kizoxy Banner" />

<br />

<p>
  <a href="https://github.com/kenewjr/Kizoxy/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-Apache%202.0-6366f1?style=for-the-badge&logo=apache&logoColor=white" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A518-43853d?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js Version" />
  <img src="https://img.shields.io/badge/Discord.js-14.26.4-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js" />
  <img src="https://img.shields.io/badge/Dashboard-Express-3b82f6?style=for-the-badge&logo=express&logoColor=white" alt="Dashboard" />
  <img src="https://img.shields.io/badge/PM2-Ready-4EBC0F?style=for-the-badge&logo=pm2&logoColor=white" alt="PM2 Ready" />
</p>

<p>
  <b>High-quality music · Smart utilities · Beautiful embeds · Full web dashboard</b><br />
  <sub>Built with Discord.js, Kazagumo, Shoukaku, and a Lavalink v4 backend.</sub>
</p>

Quick Start | Features | Commands | Dashboard | Config

</div>

<br />

---

## ✨ Features

<table>
  <tr>
    <td width="50%" valign="top">

#### 🎵 Music

- High-quality Lavalink v4 playback.
- YouTube, SoundCloud + plugin sources (Spotify, Deezer, Apple Music via compatible Lavalink plugins).
- Custom audio filters (Nightcore, Bassboost, 3D, Vibrato, reset, doubletime, karaoke, slowmotion).
- Lofi 24/7 mode with auto-reconnect.
- Lyrics with romaji conversion (LRCLIB + local analyzer).
- Full queue management: skip, loop, shuffle, forward, remove, volume.

#### 🔔 Notifications

- YouTube channel notifications (new video, live, Shorts, upcoming) via RSS polling — no API quota usage.
- TikTok account notifications (new posts, live detection) via TikWM scraper.
- Per-type toggle (video/shorts/live/upcoming on/off per subscription).
- Custom notification message templates with dynamic tokens.

#### 📊 Engagement

- XP & leveling system with ranking cards.
- Server leaderboards.
- Anime schedule via Jikan API.

    </td>
    <td width="50%" valign="top">

#### 🏠 Temp Voice Channels

- Auto-created voice channels from a generator channel.
- Full in-channel control panel (15 buttons: lock, unlock, hide, show, reset, allow, ban, kick, transfer, claim, rename, limit, muteall, unbanall, pininfo).
- Voice roles, channel templates, name patterns with tokens.
- Bitrate and region settings per generator.

#### ⚙️ Administration

- Dashboard: browser-based admin panel (per-guild settings, log viewer with level filters, YouTube/TikTok subscription manager, active player monitor, bot presence editor, update checker).
- Social media embed fixer (Twitter/X, Instagram, TikTok, Reddit, Threads, Bluesky, Facebook, Tumblr, Mastodon).
- Alarm system (single/recurring, timezone-aware, countdown auto-updates).
- Per-guild log channels.

#### 🛠️ Developer Experience

- Slash AND prefix command support (prefix: `k`).
- AutoComplete suggestions on `/play`.
- PM2-ready ecosystem config.
- Webhook error reporting.
- Modular handler-loader architecture (11 dynamic loaders).
- JSON file storage with atomic writes + backup rotation.

    </td>
  </tr>

</table>

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/kenewjr/Kizoxy.git
cd Kizoxy

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum: TOKEN, OWNER_ID, Lavalink settings

# 4. Set up Lavalink
# Download and start Lavalink v4 before running the bot.
# See: https://lavalink.dev/getting-started/getting-started

# 5. Deploy slash commands (one-time setup)
npm run deploy:slash global --clear-all

# 6. Start the bot
npm start              # Development / foreground
npm run start:pm2      # Production (recommended)
```

> [!TIP]
> Use `npm run start:pm2` in production. PM2 handles auto-restart, log rotation, and the built-in dashboard at http://127.0.0.1:4040.

---

## 📋 Requirements

| Tool           | Version  | Purpose                                                                 |
| :------------- | :------- | :---------------------------------------------------------------------- |
| Node.js        | ≥ 18.0.0 | Runtime                                                                 |
| Lavalink       | v4       | Audio streaming backend                                                 |
| Discord Bot    | —        | [Discord Developer Portal](https://discord.com/developers/applications) |
| PM2 (optional) | latest   | Production process manager                                              |

---

## ⚙️ Configuration

<details>
<summary><b>Click to expand environment variables</b></summary>

<br />

```env
# ── Required ─────────────────────────────────────────
TOKEN=                      # Your bot token
OWNER_ID=                   # Your Discord user ID

# ── Bot Appearance ───────────────────────────────────
PREFIX=k                    # Prefix for legacy k-commands (kplay, kskip…)
EMBED_COLOR=#000001         # Embed accent color (hex)
BOT_COLOR=#5865F2           # Dashboard theme accent color (hex)

# ── Lavalink Node Connection ─────────────────────────
NODE_NAME=NanoSpace         # Lavalink node label
NODE_URL=localhost:5555     # Lavalink host:port
NODE_AUTH=nanospace         # Lavalink password

# ── Music Settings ───────────────────────────────────
SEARCH_ENGINE=youtube       # default music search engine (youtube | soundcloud | youtube_music)
LEAVE_EMPTY=120000          # delay in ms before leaving empty voice channels

# ── YouTube Notifications (optional) ─────────────────
YOUTUBE_API_KEY=            # Enables live/Shorts detection (omit to use RSS-only mode)

# ── TikTok Notifications (optional) ──────────────────
TIKTOK_API_BASE=            # Custom TikTok API base URL (omit to use TikWM scraper)
TIKTOK_API_KEY=             # Custom TikTok API authentication key

# ── Logging & Reporter Options ───────────────────────
LOG_FORMAT=pretty           # Logs layout format (pretty | json)
LOG_TO_FILE=true            # Set to false to disable disk logs
ERROR_WEBHOOK_URL=          # Discord webhook URL for automated error reports

# ── Local Dashboard Configuration ────────────────────
DASHBOARD_HOST=127.0.0.1    # Dashboard bind address
DASHBOARD_PORT=4040         # Dashboard bind port
```

> [!IMPORTANT]
> Never commit your `.env` file. It is gitignored by default.

</details>

---

## 📚 Commands

> Kizoxy supports both slash commands (/) and prefix commands (default prefix: `k`).

<details open>
<summary><b>🎶 Slash Music Commands</b></summary>

| Command             | Description                                                                                                           |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `/play <song\|url>` | Play a song or playlist from supported sources                                                                        |
| `/search <query>`   | Search tracks and choose which one to play                                                                            |
| `/nowplaying`       | View details of the currently playing track                                                                           |
| `/queue [page]`     | View the list of tracks in the queue                                                                                  |
| `/skip`             | Skip the current track                                                                                                |
| `/pause`            | Pause the music playback                                                                                              |
| `/lofi`             | Stream Lofi radio non-stop                                                                                            |
| `/filter <type>`    | Apply audio filter (types: `reset`, `3d`, `bassboost`, `doubletime`, `karaoke`, `nightcore`, `slowmotion`, `vibrato`) |

</details>

<details>
<summary><b>🎵 Music Subcommands (/music)</b></summary>

| Command                    | Description                                   |
| :------------------------- | :-------------------------------------------- |
| `/music forward <seconds>` | Fast forward by a set amount of seconds       |
| `/music leave`             | Disconnect the bot from the voice channel     |
| `/music loop`              | Toggle loop mode (off, track, queue)          |
| `/music lyric`             | Look up track lyrics with Romaji translation  |
| `/music remove <position>` | Remove a track at a specific index from queue |
| `/music resume`            | Resume music playback                         |
| `/music shuffle`           | Shuffle the queue tracks                      |
| `/music twentyfourseven`   | Toggle 24/7 stay-in-voice mode                |
| `/music volume <1-100>`    | Adjust the bot playback volume                |

</details>

<details>
<summary><b>🎵 Prefix Music Commands</b></summary>

| Command              | Description              |
| :------------------- | :----------------------- |
| `kplay <query\|url>` | Play a song or playlist  |
| `kskip`              | Skip the current track   |
| `kstop`              | Stop and clear queue     |
| `kpause`             | Pause playback           |
| `kresume`            | Resume playback          |
| `kloop`              | Toggle loop mode         |
| `kshuffle`           | Shuffle the queue        |
| `kremove <pos>`      | Remove track at position |
| `kqueue [page]`      | View the queue           |
| `knp`                | Now playing              |
| `klyrics`            | Fetch lyrics             |
| `kvolume <1-100>`    | Set volume               |
| `kforward <sec>`     | Skip forward             |
| `kleave`             | Disconnect               |
| `klofi`              | Start Lofi stream        |
| `k247`               | Toggle 24/7 mode         |

> [!NOTE]
> Prefix commands are for quick access in channels where slash commands may be slower. Replace `k` with your configured `PREFIX`.

</details>

<details>
<summary><b>🏠 Temp Voice Channels</b></summary>

| Command        | Description                           |
| :------------- | :------------------------------------ |
| `/vcsetup`     | Configure a generator voice channel   |
| `/vc <action>` | Manage your active temp voice channel |
| `/vcrole`      | Configure voice-specific roles        |
| `/vctemplate`  | Manage channel name templates         |

#### Available Actions for `/vc` Option:

- `lock` / `unlock`: Prevent or allow users to join.
- `hide` / `show`: Set channel visibility.
- `rename`: Edit channel name.
- `limit`: Set member limit (0-99).
- `allow` / `ban` / `unban`: Manage specific user permissions.
- `kick` / `transfer`: Eject members or transfer channel ownership.
- `template`: Apply a name pattern.
- `info`: Display current channel configurations.

</details>

<details>
<summary><b>📺 YouTube Notifications</b></summary>

| Command                        | Description                                                |
| :----------------------------- | :--------------------------------------------------------- |
| `/youtube add <url> <channel>` | Subscribe a YouTube channel for announcement alerts        |
| `/youtube remove <url>`        | Unsubscribe from a YouTube channel                         |
| `/youtube list`                | List all YouTube notification subscriptions in this server |

</details>

<details>
<summary><b>📱 TikTok Notifications</b></summary>

| Command                       | Description                                               |
| :---------------------------- | :-------------------------------------------------------- |
| `/tiktok add <url> <channel>` | Subscribe a TikTok account for announcement alerts        |
| `/tiktok remove <url>`        | Unsubscribe from a TikTok account                         |
| `/tiktok list`                | List all TikTok notification subscriptions in this server |
| `/tiktok status <url>`        | Show current scraping monitor status for an account       |
| `/tiktok test`                | Send a test TikTok notification alert to the server       |

</details>

<details>
<summary><b>⏰ Alarms</b></summary>

| Command       | Description                                                                     |
| :------------ | :------------------------------------------------------------------------------ |
| `/alarm`      | Open the unified alarm scheduler interface (view, create, edit, cancel, toggle) |
| `/alarmadmin` | View all active alarms across this server (Admin only)                          |

</details>

<details>
<summary><b>🏆 Leveling</b></summary>

| Command                      | Description                            |
| :--------------------------- | :------------------------------------- |
| `/rank [user]`               | View level, XP, and rank progress card |
| `/leaderboard`               | Show the server's top leveling ranks   |
| `/level add <user> <amount>` | Add XP to a server member (Owner only) |

</details>

<details>
<summary><b>⚙️ Settings & Misc</b></summary>

| Command             | Description                                            |
| :------------------ | :----------------------------------------------------- |
| `/fixembed`         | Configure social-media URL auto-embed settings         |
| `/setlog <channel>` | Set the logs channel for server updates                |
| `/anime`            | Search anime information or check release schedules    |
| `/donate`           | Send the donation link to support Kizoxy's development |
| `/help`             | Open the help menu interface                           |

</details>

<details>
<summary><b>👑 Owner</b></summary>

| Command                             | Description                                            |
| :---------------------------------- | :----------------------------------------------------- |
| `/owner sendmsg <guild> <ch> <msg>` | Send messages to a specific guild channel (Owner only) |

</details>

---

## 🖥️ Dashboard

Kizoxy includes a built-in web admin panel, accessible at `http://127.0.0.1:4040` while the bot is running.

**No additional setup required** — the dashboard starts automatically with the bot.

**What you can do from the dashboard:**

| Feature              | Description                                                                                          |
| :------------------- | :--------------------------------------------------------------------------------------------------- |
| **Overview**         | View bot stats, uptime, memory usage, Lavalink node connection status, and active player statistics. |
| **Guild Settings**   | Configure per-guild FixEmbed modes, log channels, and notification alerts.                           |
| **YouTube / TikTok** | Add, remove, and edit video subscription trackers per guild.                                         |
| **Log Viewer**       | Browse, live-tail, search, and filter bot logs by level (ERROR, WARN, INFO, DEBUG).                  |
| **Config**           | Edit runtime configurations (bot color, prefix) without restart.                                     |
| **Send Message**     | Compose and send messages to any server text channel from the browser.                               |
| **Update Checker**   | Check which packages in `package.json` have newer updates available.                                 |
| **Commands**         | View slash commands structure and customize command display aliases.                                 |

> [!TIP]
> The dashboard binds to localhost only (`127.0.0.1`) and has no authentication — access requires direct server access. Use an SSH tunnel if you need remote access.

---

## 🎵 Supported Sources

<p>
  <img src="https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube" />
  <img src="https://img.shields.io/badge/SoundCloud-FF5500?style=flat-square&logo=soundcloud&logoColor=white" alt="SoundCloud" />
</p>

#### Sources requiring a Lavalink plugin:

- 🔌 **Spotify** (via `spotify-source` Lavalink plugin)
- 🔌 **Deezer** (via `deezer-source` Lavalink plugin)
- 🔌 **Apple Music** (via `apple-music` Lavalink plugin)

> [!NOTE]
> Spotify, Deezer, and Apple Music require their respective Lavalink source plugins. See [Lavalink plugins](https://lavalink.dev/plugins/) for setup details.

---

## 🧱 Tech Stack

<p>
  <a href="https://discord.js.org/"><img src="https://img.shields.io/badge/Discord.js-14.26.4-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord.js" /></a>
  <a href="https://github.com/lavalink-devs/Lavalink"><img src="https://img.shields.io/badge/Lavalink-v4-1DB954?style=flat-square" alt="Lavalink" /></a>
  <a href="https://github.com/Takiyo0/Kazagumo"><img src="https://img.shields.io/badge/Kazagumo-3.4.3-8b5cf6?style=flat-square" alt="Kazagumo" /></a>
  <a href="https://github.com/Deivu/Shoukaku"><img src="https://img.shields.io/badge/Shoukaku-4.3.0-ec4899?style=flat-square" alt="Shoukaku" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A518-43853d?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://prettier.io/"><img src="https://img.shields.io/badge/Prettier-3.9.4-F7B93E?style=flat-square&logo=prettier&logoColor=black" alt="Prettier" /></a>
  <a href="https://jestjs.io/"><img src="https://img.shields.io/badge/Jest-30.4.2-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest" /></a>
  <a href="https://pm2.keymetrics.io/"><img src="https://img.shields.io/badge/PM2-latest-4EBC0F?style=flat-square&logo=pm2&logoColor=white" alt="PM2" /></a>
</p>

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

```bash
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix ESLint issues
npm run format      # Prettier format
npm test            # Run Jest test suite
```

---

## 📜 License

Distributed under the **Apache 2.0** License. See [LICENSE](./LICENSE) for details.

<div align="center">

<br />

<sub>Built with ❤️ by <a href="https://github.com/kenewjr">@kenewjr</a></sub>

<img src="https://capsule-render.vercel.app/api?type=waving&height=80&section=footer&color=0:ec4899,50:8b5cf6,100:6366f1" />

</div>
