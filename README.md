<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:6366f1,50:8b5cf6,100:ec4899&text=Kizoxy&textBg=false&fontSize=90&fontAlignY=38&fontColor=ffffff&animation=fadeIn&strokeWidth=0&desc=A%20premium%20multipurpose%20Discord%20bot&descAlignY=62&descSize=18" alt="Kizoxy Banner" />

<br />

<p>
  <a href="https://github.com/kenewjr/Kizoxy/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-Apache%202.0-6366f1?style=for-the-badge&logo=apache&logoColor=white" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-18%2B-43853d?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js Version" />
  <img src="https://img.shields.io/badge/Discord.js-14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js" />
  <a href="https://discord.gg/qeemvqq">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Server" />
  </a>
</p>

<p>
  <b>High-quality music · Smart utilities · Beautiful embeds</b><br />
  <sub>Built with Discord.js, Kazagumo, Shoukaku, and a Lavalink v4 backend.</sub>
</p>

<a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-→-ec4899?style=flat-square" /></a>
<a href="#-features"><img src="https://img.shields.io/badge/Features-→-8b5cf6?style=flat-square" /></a>
<a href="#-commands"><img src="https://img.shields.io/badge/Commands-→-6366f1?style=flat-square" /></a>
<a href="#-configuration"><img src="https://img.shields.io/badge/Configuration-→-3b82f6?style=flat-square" /></a>

</div>

<br />

## ✨ Features

<table>
  <tr>
    <td width="50%" valign="top">

#### 🎵 Music

- High-quality Lavalink v4 playback
- YouTube · SoundCloud · Spotify · Deezer
- Custom audio filters (Nightcore, Bassboost, 3D, Vibrato)
- Lofi 24/7 mode with auto-reconnect
- Static lyrics with romaji conversion (LRCLIB + Lavalink)

#### 🏆 Engagement

- Level & XP system with rank cards
- Server leaderboards
- Anime schedule via Jikan API

  </td>
  <td width="50%" valign="top">

#### ⏰ Utility

- Alarm system with auto-update countdown
- Social media embed fixer (Twitter, IG, TikTok)
- YouTube & TikTok notification alerts for new uploads
- Per-guild log channels

#### 🛠️ Developer Experience

- Slash & prefix command support
- AutoComplete suggestions on `/play`
- PM2-ready ecosystem config
- Webhook error reporting
- Hot-reloadable handlers

  </td>
  </tr>
</table>

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/kenewjr/Kizoxy.git
cd Kizoxy

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# edit .env with your token, owner ID, and Lavalink node

# 4. Deploy slash commands (one-time)
npm run deploy:slash global --clear-all

# 5. Run
npm start              # foreground
npm run start:pm2      # production with PM2
```

> [!TIP]
> Use `npm run start:pm2` in production. PM2 handles auto-restart, log rotation, and process monitoring out of the box.

---

## 📋 Requirements

| Tool                 | Version    | Purpose                                                                          |
| :------------------- | :--------- | :------------------------------------------------------------------------------- |
| **Node.js**          | `≥ 18.0.0` | Runtime                                                                          |
| **Lavalink**         | `v4`       | Audio streaming backend                                                          |
| **Discord Bot**      | —          | [Setup guide](https://discordjs.guide/preparations/setting-up-a-bot-application) |
| **PM2** _(optional)_ | `latest`   | Production process manager                                                       |

---

## ⚙️ Configuration

<details>
<summary><b>Click to expand environment variables</b></summary>

<br />

```env
# ── Bot ─────────────────────────────────────────
TOKEN=YOUR_BOT_TOKEN_HERE
OWNER_ID=YOUR_DISCORD_ID
PREFIX=!
EMBED_COLOR=#6366f1

# ── Music ───────────────────────────────────────
SEARCH_ENGINE=youtube      # youtube | soundcloud | youtube_music
LEAVE_EMPTY=120000         # ms before leaving empty channel

# ── Lavalink ────────────────────────────────────
NODE_NAME=kenewjr
NODE_URL=localhost:2333
NODE_AUTH=youshallnotpass
LAVALINK_URL=http://localhost:2333
LAVALINK_PASSWORD=youshallnotpass

# ── YouTube (optional) ──────────────────────────
YOUTUBE_API_KEY=
```

</details>

---

## 📚 Commands

> Default prefix is `/`. Replace it with your configured `PREFIX` for legacy commands.

<details open>
<summary><b>🎶 Music</b></summary>

| Command                         | Description                                       |
| :------------------------------ | :------------------------------------------------ |
| `/play <song\|url>`             | Play from YouTube, SoundCloud, Spotify, or Deezer |
| `/search <query>`               | Interactive search with selection                 |
| `/nowplaying`                   | Show the currently playing track                  |
| `/queue [page]`                 | Display the queue with pagination                 |
| `/skip` · `/pause` · `/resume`  | Playback controls                                 |
| `/loop` · `/shuffle` · `/clear` | Queue controls                                    |
| `/volume <1-100>`               | Adjust playback volume                            |
| `/forward <seconds>`            | Seek forward in the current track                 |
| `/remove <position>`            | Remove a specific track from queue                |
| `/247`                          | Toggle 24/7 stay-in-voice mode                    |
| `/lofi`                         | Stream Lofi radio non-stop                        |
| `/lyrics`                       | Fetch synced lyrics with romaji support           |
| `/leave`                        | Disconnect from voice                             |

</details>

<details>
<summary><b>🎛️ Filters</b></summary>

| Command          | Description           |
| :--------------- | :-------------------- |
| `/filter <type>` | Apply an audio filter |

Available types: `reset` · `3d` · `bassboost` · `doubletime` · `karaoke` · `nightcore` · `slowmotion` · `vibrato`

</details>

<details>
<summary><b>🏆 Leveling</b></summary>

| Command              | Description                       |
| :------------------- | :-------------------------------- |
| `/rank [user]`       | View level, XP, and progress card |
| `/leaderboard`       | Top members in the server         |
| `/addxp <user> <xp>` | _(Admin)_ Award XP to a member    |

</details>

<details>
<summary><b>⏰ Alarms</b></summary>

| Command       | Description                                                                                              |
| :------------ | :------------------------------------------------------------------------------------------------------- |
| `/alarm`      | Open the alarm panel — view, create (modal), edit (modal), cancel, toggle, change channel/role/recurring |
| `/alarmadmin` | _(Admin)_ View all server alarms                                                                         |

</details>

<details>
<summary><b>📺 YouTube Notifications</b></summary>

| Command                   | Description                                  |
| :------------------------ | :------------------------------------------- |
| `/youtube add <url> <ch>` | Subscribe a YouTube channel to announce here |
| `/youtube remove <url>`   | Unsubscribe from a YouTube channel           |
| `/youtube list`           | List this server's YouTube subscriptions     |

</details>

<details>
<summary><b>📱 TikTok Notifications</b></summary>

| Command                  | Description                                    |
| :----------------------- | :--------------------------------------------- |
| `/tiktok add <url> <ch>` | Subscribe a TikTok account to announce here    |
| `/tiktok remove <url>`   | Unsubscribe from a TikTok account              |
| `/tiktok list`           | List this server's TikTok subscriptions        |
| `/tiktok status <url>`   | Show current monitoring status for an account  |
| `/tiktok test`           | Send a test TikTok notification to this server |

</details>

<details>
<summary><b>👑 Owner</b></summary>

| Command                             | Description                                                            |
| :---------------------------------- | :--------------------------------------------------------------------- |
| `/owner sendmsg <guild> <ch> <msg>` | Send a message to a specific channel in a specific server (Owner only) |

</details>

<details>
<summary><b>⚙️ Settings & Misc</b></summary>

| Command             | Description                         |
| :------------------ | :---------------------------------- |
| `/fixembed`         | Configure social-media embed fixing |
| `/setlog <channel>` | Set the server log channel          |
| `/anime`            | Anime schedule and info (Jikan)     |
| `/help`             | Open the help menu                  |

</details>

---

## 🎵 Supported Sources

<p>
  <img src="https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white" />
  <img src="https://img.shields.io/badge/SoundCloud-FF5500?style=flat-square&logo=soundcloud&logoColor=white" />
  <img src="https://img.shields.io/badge/Spotify-1DB954?style=flat-square&logo=spotify&logoColor=white" />
  <img src="https://img.shields.io/badge/Deezer-FEAA2D?style=flat-square&logo=deezer&logoColor=black" />
  <img src="https://img.shields.io/badge/Apple%20Music-FA243C?style=flat-square&logo=applemusic&logoColor=white" />
</p>

> [!NOTE]
> Spotify and Deezer require their respective Lavalink plugins to be enabled on your node.

---

## 🧱 Tech Stack

<p>
  <a href="https://discord.js.org/"><img src="https://img.shields.io/badge/Discord.js-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://github.com/lavalink-devs/Lavalink"><img src="https://img.shields.io/badge/Lavalink-v4-1DB954?style=flat-square" /></a>
  <a href="https://github.com/Takiyo0/Kazagumo"><img src="https://img.shields.io/badge/Kazagumo-3.x-8b5cf6?style=flat-square" /></a>
  <a href="https://github.com/Deivu/Shoukaku"><img src="https://img.shields.io/badge/Shoukaku-4.x-ec4899?style=flat-square" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-43853d?style=flat-square&logo=node.js&logoColor=white" /></a>
  <a href="https://prettier.io/"><img src="https://img.shields.io/badge/Prettier-F7B93E?style=flat-square&logo=prettier&logoColor=black" /></a>
</p>

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

```bash
npm run lint        # check code style
npm run lint:fix    # auto-fix issues
npm run format      # format with prettier
npm test            # run jest test suite
```

---

## 📜 License

Distributed under the **Apache 2.0** License. See [LICENSE](./LICENSE) for details.

<div align="center">

<br />

<sub>Built with ❤️ by <a href="https://github.com/kenewjr">@kenewjr</a> · <a href="https://discord.gg/qeemvqq">Join the Discord</a></sub>

<img src="https://capsule-render.vercel.app/api?type=waving&height=80&section=footer&color=0:ec4899,50:8b5cf6,100:6366f1" />

</div>
