<p align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&height=200&color=gradient&text=Kizoxy&textBg=false&fontSize=80&fontAlignY=40&animation=twinkling&strokeWidth=2"/> </a>
</p>

## 📑 Feature

- [x] Music Systems
- [x] Alarm Systems
- [x] Anime Systems
- [x] Slash Commands (Base, Group, Sub)
- [x] prefix Commands
- [x] AutoComplete (Play, Playskip, Playtop)
- [x] Custom Filters
- [x] Easy to use

## 🎶 Support Source

- [x] Youtube
- [x] SoundCloud
- [x] Spotify (Require Plugin)
- [x] Deezer (Require Plugin)

<details><summary>📎 Requirements [CLICK ME]</summary>
<p>

## 📎 Requirements

- Node.js+ **[Download](https://nodejs.org/en/download/)**
- Discord Bot Token **[Guide](https://discordjs.guide/legacy/preparations/installation)**
- LavaLink **[Guide](https://github.com/lavalink-devs/Lavalink)** (_Work on lavalink v4 only_)

</p>
</details>

## 📚 Installation

```
git clone https://github.com/kenewjr/Kizoxy
cd Kizoxy
npm install
```

<details><summary>📄 Configuration [CLICK ME]</summary>
<p>

## 📄 Configuration

Copy or Rename `.env.example` to `.env` and fill out the values:

```.env
# Bot
TOKEN=REPLACE_HERE
EMBED_COLOR=#000001
SEARCH_ENGINE=youtube
LEAVE_EMPTY=120000

# Dev
OWNER_ID=REPLACE_HERE

# Nodes
NODE_NAME=NanoSpace
NODE_URL=localhost:5555
NODE_AUTH=nanospace
```

Don't forget to do `node deploySlash.js global` to deploy slash commands

After installation or finishes all you can use `node .` to start the bot. or `Run Start.bat`

</p>
</details>

<details><summary>🔩 Features & Commands [CLICK ME]</summary>
<p>

## 🔩 Features & Commands

> Note: The default prefix is '/'

🎶 **Music Commands!**

- Play (/play [song/url])
- Nowplaying (/nowplaying)
- Queue (/queue [page])
- Loop (/loop)
- Shuffle (/shuffle)
- Volume control (/volume [1 - 100])
- Pause (/pause)
- Resume (/resume)
- Skip (/skip)
- Clear (/clear)
- Leave (/leave)
- Forward (/forward [seconds])
- Search (/search [songname])
- 247 (/247)
- Remove (/remove [song])

⏺ **Filter Commands!**

- Nightcore (/nightcore)
- Bassboost (/bassboost [-10 - 10])
- Reset (/reset)
- 3d (/3d)
- DoubleTime (/doubletime)
- Vibrato (/vibrato)
- Karaoke (/karaoke)
- SlowMotion (/slowmotion)

📑 **Misc Commands!**

- Help (/help)
- Alarm (/alarm [time])
- AnimeSchedule (/anime )

</p>
</details>
