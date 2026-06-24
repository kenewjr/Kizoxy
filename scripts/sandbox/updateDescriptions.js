/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const descriptions = {
  // alarm
  "alarm/admin.js": "Show all server alarms.",
  "alarm/list.js": "Show this server's alarm control panel.",
  // anime
  "anime/Anime.js": "Show the current season anime schedule and info.",
  // level
  "level/addxp.js": "Add XP points to a server member.",
  "level/leaderboard.js": "Show the server leveling leaderboard.",
  "level/rank.js": "Show your rank card and level progress.",
  // misc
  "misc/Help.js": "Show the bot help menu index.",
  // music
  "music/Filter.js": "Apply an audio filter/preset.",
  "music/Forward.js": "Fast-forward the current track by a specific amount of time.",
  "music/Leave.js": "Disconnect the bot from the voice channel and clear queue.",
  "music/Lofi.js": "Stream a continuous 24/7 Lofi radio station.",
  "music/Loop.js": "Cycle loop mode (off, track, queue).",
  "music/Lyrics.js": "Search and display lyrics for a song (converts JPN to romaji).",
  "music/NowPlaying.js": "Show progress bar and info for the current song.",
  "music/Pause.js": "Pause music playback.",
  "music/Play.js": "Play a track or playlist from YouTube, Spotify, SoundCloud, or Deezer.",
  "music/Queue.js": "Show the list of upcoming songs.",
  "music/Remove.js": "Remove a song at a specific index from the queue.",
  "music/Resume.js": "Resume paused music playback.",
  "music/Search.js": "Search for a song and provide a selection menu to play it.",
  "music/Shuffle.js": "Shuffle the order of tracks in the queue.",
  "music/Skip.js": "Skip the current song and play the next one.",
  "music/TwentyFourSeven.js": "Keep the bot in the voice channel permanently, even if empty.",
  "music/Volume.js": "Set the bot voice volume.",
  // owner
  "owner/sendmsg.js": "Send a message to a specific channel in a specific server (Owner only).",
  // settings
  "settings/fixembed.js": "Configure social-media embed fixing settings.",
  "settings/setlog.js": "Set the server moderation log channel.",
  // tempvoice
  "tempvoice/vcControl.js": "Control temporary voice channel settings.",
  "tempvoice/vcRole.js": "Configure voice roles for temporary voice channels.",
  "tempvoice/vcSetup.js": "Set up a temporary voice channel generator.",
  "tempvoice/vcTemplate.js": "Configure voice channel permission templates.",
  // tiktok
  "tiktok/add.js": "Subscribe a TikTok account to post notifications here.",
  "tiktok/list.js": "List this server's TikTok subscriptions.",
  "tiktok/remove.js": "Unsubscribe a TikTok account from this server.",
  "tiktok/status.js": "Show current monitoring status for a subscribed account.",
  "tiktok/test.js": "Send a sample TikTok notification to verify setup.",
  // youtube
  "youtube/add.js": "Subscribe a YouTube channel to announce here.",
  "youtube/list.js": "List this server's YouTube subscriptions.",
  "youtube/remove.js": "Unsubscribe a YouTube channel from this server."
};

const baseDir = path.join(__dirname, "../../src/commands/slash");

for (const [relPath, newDesc] of Object.entries(descriptions)) {
  const filePath = path.join(baseDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  
  // Replace description: "..." or description: '...'
  const regex = /(description:\s*)(["'`])([\s\S]*?)\2/g;
  const match = regex.exec(content);
  
  if (match) {
    // Only replace the first match which represents the command description
    const quote = match[2];
    const originalLine = match[0];
    const newLine = `description: ${quote}${newDesc}${quote}`;
    
    // Perform replacement on file content
    const updatedContent = content.replace(originalLine, newLine);
    fs.writeFileSync(filePath, updatedContent, "utf8");
    console.log(`Updated ${relPath} -> "${newDesc}"`);
  } else {
    console.error(`Could not find description field in: ${relPath}`);
  }
}
