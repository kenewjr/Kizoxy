require("dotenv").config();

module.exports = {
  PREFIX: process.env.PREFIX || "k",
  TOKEN: process.env.TOKEN || "YOUR_TOKEN_BOT",
  OWNER_ID: process.env.OWNER_ID || "YOUR_DISCORD_OWNER_ID",
  EMBED_COLOR: process.env.EMBED_COLOR || "#000001",
  SEARCH_DEFAULT: ["yoasobi", "zutomayo", "kotoha", "lisa"],
  SEARCH_ENGINE: process.env.SEARCH_ENGINE || "youtube", // default -- 'youtube' | 'soundcloud' | 'youtube_music'
  LEAVE_EMPTY: process.env.LEAVE_EMPTY || "120000",
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  // Configurable TikTok data provider. No official free feed exists, so the
  // client is provider-agnostic: point this at any HTTP endpoint that returns
  // the documented JSON contract (RSSHub instance, third-party API, etc.).
  TIKTOK_API_BASE: process.env.TIKTOK_API_BASE,
  TIKTOK_API_KEY: process.env.TIKTOK_API_KEY,
  NODES: [
    {
      name: process.env.NODE_NAME || "NanoSpace",
      url: process.env.NODE_URL || "localhost:5555",
      auth: process.env.NODE_AUTH || "nanospace",
    },
  ],

  LOG_FORMAT: process.env.LOG_FORMAT || "pretty", // "pretty" or "json"

  // Dashboard admin panel (host-only, no auth).
  DASHBOARD_HOST: process.env.DASHBOARD_HOST || "127.0.0.1",
  DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT, 10) || 4040,
  BOT_COLOR: process.env.BOT_COLOR || "#5865F2",
};
