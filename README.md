# Kizoxy

<p align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=gradient&text=Kizoxy&textBg=false&fontSize=80&fontAlignY=40&animation=twinkling&strokeWidth=2" alt="Kizoxy Banner"/>
</p>

<p align="center">
    <a href="https://github.com/kenewjr/kizoxy-bot/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License">
    </a>
    <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js Version">
    <a href="https://discord.gg/qeemvqq">
        <img src="https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white" alt="Discord Server">
    </a>
</p>

## 📑 Features

- [x] **Music Systems**: High-quality music playback.
- [x] **Alarm Systems**: Set reminders effectively.
- [x] **Anime Systems**: Schedule and info.
- [x] **Level Systems**: Rank tracking and leaderboards.
- [x] **Social Embed Fixer**: Automatically fix broken social media embeds.
- [x] **Slash Commands**: Full support for slash commands.
- [x] **Prefix Commands**: Legacy support for prefix commands.
- [x] **AutoComplete**: Smart completion for play commands.
- [x] **Custom Filters**: Nightcore, Bassboost, and more.
- [x] **Ease of Use**: Simple setup and configuration.

## 🎶 Supported Sources

- [x] YouTube
- [x] SoundCloud
- [x] Spotify (_Requires Plugin_)
- [x] Deezer (_Requires Plugin_)

---

<details>
<summary><h2>📎 Requirements</h2></summary>

- **Node.js**: [Download](https://nodejs.org/en/download/) (v18 or newer recommended)
- **Discord Bot Token**: [Guide](https://discordjs.guide/preparations/setting-up-a-bot-application)
- **LavaLink**: [Guide](https://github.com/lavalink-devs/Lavalink) (v4 required)

</details>

## 📚 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kenewjr/Kizoxy.git
   cd Kizoxy
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the bot:**

   ```bash
   node .
   # OR
   npm start
   ```

---

<details>
<summary><h2>📄 Configuration</h2></summary>

Copy `.env.example` to `.env` and fill in your details:

```env
# Bot Configuration
TOKEN=YOUR_BOT_TOKEN_HERE
EMBED_COLOR=#000001
SEARCH_ENGINE=youtube
LEAVE_EMPTY=120000

# Developer
OWNER_ID=YOUR_DISCORD_ID

# LavaLink Nodes
NODE_NAME=NanoSpace
NODE_URL=localhost:5555
NODE_AUTH=nanospace
```

**Deploy Slash Commands:**

```bash
node deploySlash.js global --clear-all
```

</details>

---

<details>
<summary><h2>🔩 Features & Commands</h2></summary>

> **Note:** The default prefix is `/`

### 🎶 Music Commands

| Command              | Description                                |
| :------------------- | :----------------------------------------- |
| `/play [song/url]`   | Play a song from YouTube, SoundCloud, etc. |
| `/nowplaying`        | Show the current playing song.             |
| `/queue [page]`      | Show the queue.                            |
| `/loop`              | Toggle loop mode.                          |
| `/shuffle`           | Shuffle the queue.                         |
| `/volume [1-100]`    | Adjust the volume.                         |
| `/pause`             | Pause playback.                            |
| `/resume`            | Resume playback.                           |
| `/skip`              | Skip the current song.                     |
| `/clear`             | Clear the queue.                           |
| `/leave`             | Disconnect the bot.                        |
| `/forward [seconds]` | Forward the song.                          |
| `/search [song]`     | Search for a song.                         |
| `/247`               | Toggle 24/7 mode.                          |
| `/remove [song]`     | Remove a song from the queue.              |
| `/lofi`              | Toggle Lofi mode.                          |
| `/lyrics`            | Fetch lyrics for the playing song.         |

### ⏺ Filter Commands

| Command            | Description                                  |
| :----------------- | :------------------------------------------- |
| `/filter [type]`   | Apply an audio filter (e.g., bassboost).     |

*(Available filters: `reset`, `3d`, `bassboost`, `doubletime`, `karaoke`, `nightcore`, `slowmotion`, `vibrato`)*

### 🏆 Level System

| Command              | Description                                |
| :------------------- | :----------------------------------------- |
| `/rank [user]`       | View your current level and XP.            |
| `/leaderboard`       | View the server leaderboard.               |
| `/addxp [user] [xp]` | Add XP to a user (Admin).                  |

### ⚙️ Settings Commands

| Command              | Description                                |
| :------------------- | :----------------------------------------- |
| `/fixembed`          | Configure the social media embed fixer.    |
| `/setlog [channel]`  | Sets the server log channel for events.    |

### 📑 Misc Commands

| Command         | Description                 |
| :-------------- | :-------------------------- |
| `/help`         | Show help menu.             |
| `/alarm [sub]`  | Manage your alarms.         |
| `/anime`        | Anime schedule and options. |

</details>

---

## 🌟 Made With

- [Discord.js](https://discord.js.org/)
- [LavaLink](https://github.com/lavalink-devs/Lavalink)
- [Kazagumo](https://github.com/Takiyo0/Kazagumo)
- [Shoukaku](https://github.com/Deivu/Shoukaku)
- [Prettier](https://prettier.io/)
