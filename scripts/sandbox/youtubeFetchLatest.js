// One-off dry-run: fetch a channel's LATEST video, classify it, and print what
// would be announced — without touching storage or posting to Discord.
//
// Usage:
//   node scripts/sandbox/youtubeFetchLatest.js "<url|@handle|UC...>"
// Requires YOUTUBE_API_KEY in .env.
require("dotenv").config();

const {
  resolveChannel,
  fetchLatestFeedEntry,
  fetchVideoDetails,
} = require("../../src/integrations/youtube/client");
const { classify } = require("../../src/integrations/youtube/classifier");

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error(
      'Provide a channel. e.g. node scripts/sandbox/youtubeFetchLatest.js "@MrBeast"',
    );
    process.exit(1);
  }
  if (!process.env.YOUTUBE_API_KEY) {
    console.error("YOUTUBE_API_KEY not set in .env");
    process.exit(1);
  }

  const channel = await resolveChannel(input);
  console.log("Resolved channel:", channel);

  const entry = await fetchLatestFeedEntry(channel.youtubeChannelId);
  console.log("Latest feed entry:", entry);
  if (!entry?.videoId) {
    console.log("No videos in feed.");
    return;
  }

  const videoItem = await fetchVideoDetails(entry.videoId);
  const type = await classify(videoItem);

  console.log("----------------------------------------");
  console.log("Would announce as:", type.toUpperCase());
  console.log("Title  :", videoItem?.snippet?.title);
  console.log("URL    :", `https://www.youtube.com/watch?v=${entry.videoId}`);
  console.log("Live   :", videoItem?.snippet?.liveBroadcastContent);
  console.log("Length :", videoItem?.contentDetails?.duration);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
