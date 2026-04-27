require("dotenv").config();

module.exports = {
  PREFIX: "k",
  TOKEN: process.env.TOKEN || "YOUR_TOKEN_BOT",
  OWNER_ID: process.env.OWNER_ID || "YOUR_DISCORD_OWNER_ID",
  EMBED_COLOR: process.env.EMBED_COLOR || "#000001",
  spotifyClientID: process.env.spotifyClientID,
  spotifySecret: process.env.spotifySecret,
  SEARCH_DEFAULT: ["yoasobi", "zutomayo", "kotoha", "lisa"],
  SEARCH_ENGINE: process.env.SEARCH_ENGINE || "youtube", // default -- 'youtube' | 'soundcloud' | 'youtube_music'
  LEAVE_EMPTY: process.env.LEAVE_EMPTY || "120000",
  NODES: [
    {
      name: process.env.NODE_NAME || "NanoSpace",
      url: process.env.NODE_URL || "localhost:5555",
      auth: process.env.NODE_AUTH || "nanospace",
    },
  ],

  // ── PostgreSQL (optional) ─────────────────────────
  POSTGRES: {
    host: process.env.POSTGRES_HOST || "",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "kizoxy",
    user: process.env.POSTGRES_USER || "kizoxy",
    password: process.env.POSTGRES_PASSWORD || "",
  },

  // ── Logging ───────────────────────────────────────
  LOG_FORMAT: process.env.LOG_FORMAT || "pretty", // "pretty" or "json"
};
