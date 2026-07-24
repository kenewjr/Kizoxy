const PLATFORM_GROUPS = {
  social: [
    "twitter",
    "instagram",
    "tiktok",
    "reddit",
    "threads",
    "bluesky",
    "facebook",
    "tumblr",
    "mastodon",
  ],
  media: ["youtube", "twitch", "bilibili", "spotify"],
  art: ["pixiv", "deviantart", "newgrounds", "furaffinity"],
  embedez: [
    "snapchat",
    "pinterest",
    "imgur",
    "ifunny",
    "booru",
    "danbooru",
    "weibo",
  ],
};

const PLATFORM_META = {
  twitter: {
    emoji: "🐦",
    label: "Twitter / X",
    viewModes: ["Normal", "Gallery", "Direct", "Text"],
  },
  instagram: {
    emoji: "📸",
    label: "Instagram",
    viewModes: ["Normal", "Gallery", "Direct"],
  },
  tiktok: { emoji: "🎵", label: "TikTok", viewModes: ["Normal", "Direct"] },
  reddit: { emoji: "🤖", label: "Reddit", viewModes: [] },
  threads: { emoji: "🧵", label: "Threads", viewModes: [] },
  bluesky: {
    emoji: "☁️",
    label: "Bluesky",
    viewModes: ["Normal", "Gallery", "Direct", "Text"],
  },
  facebook: { emoji: "👤", label: "Facebook", viewModes: [] },
  tumblr: { emoji: "📓", label: "Tumblr", viewModes: [] },
  mastodon: { emoji: "🐘", label: "Mastodon", viewModes: [] },
  youtube: { emoji: "▶️", label: "YouTube", viewModes: [] },
  twitch: { emoji: "🎮", label: "Twitch Clips", viewModes: [] },
  bilibili: { emoji: "📺", label: "BiliBili", viewModes: [] },
  spotify: { emoji: "🎵", label: "Spotify Tracks", viewModes: [] },
  pixiv: { emoji: "🎨", label: "Pixiv", viewModes: [] },
  deviantart: { emoji: "🖼️", label: "DeviantArt", viewModes: [] },
  newgrounds: { emoji: "🎬", label: "Newgrounds", viewModes: [] },
  furaffinity: { emoji: "🐾", label: "Fur Affinity", viewModes: [] },
  snapchat: { emoji: "👻", label: "Snapchat", viewModes: [] },
  pinterest: { emoji: "📌", label: "Pinterest", viewModes: [] },
  imgur: { emoji: "🖼️", label: "Imgur", viewModes: [] },
  ifunny: { emoji: "😂", label: "iFunny", viewModes: [] },
  booru: { emoji: "🔞", label: "Booru sites", viewModes: [] },
  danbooru: { emoji: "🔞", label: "Danbooru", viewModes: [] },
  weibo: { emoji: "🌐", label: "Weibo", viewModes: [] },
};

module.exports = {
  PLATFORM_GROUPS,
  PLATFORM_META,
};
