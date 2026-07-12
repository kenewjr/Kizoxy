// One-off dry-run: fetch a TikTok profile, resolve its username, fetch details,
// and print what would be announced — without touching storage or posting to Discord.
//
// Usage:
//   node scripts/sandbox/tiktokFetchLatest.js "<url|@username|username>"
// Requires TIKTOK_API_BASE in .env.
require("dotenv").config();

const { resolveProfile } = require("../../src/integrations/tiktok/resolver");
const { fetchProfile } = require("../../src/integrations/tiktok/client");

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error(
      'Provide a TikTok profile URL or username. e.g. node scripts/sandbox/tiktokFetchLatest.js "@username"',
    );
    process.exit(1);
  }

  const resolved = resolveProfile(input);
  console.log("Resolved username:", resolved.username);
  console.log("Resolved profile URL:", resolved.profileUrl);

  console.log("Fetching profile from provider...");
  const data = await fetchProfile(resolved.username);

  console.log("----------------------------------------");
  console.log("User details:");
  console.log("ID        :", data.user.id);
  console.log("Username  :", data.user.username);
  console.log("Avatar    :", data.user.avatar);
  console.log("Live now  :", data.user.live ? "🔴 YES" : "NO");
  console.log("Live URL  :", data.user.liveUrl);
  console.log("Live ID   :", data.user.liveId);

  console.log("----------------------------------------");
  if (data.videos.length === 0) {
    console.log("No videos returned from the provider.");
  } else {
    console.log(`Latest videos (${data.videos.length} found):`);
    data.videos.forEach((video, idx) => {
      console.log(`\n[${idx + 1}] Video ID  :`, video.id);
      console.log(`    URL       :`, video.url);
      console.log(`    Title     :`, video.title);
      console.log(`    Is Live?  :`, video.isLive ? "Yes" : "No");
      console.log(`    Cover URL :`, video.cover);
      console.log(
        `    Published :`,
        video.createTime
          ? new Date(video.createTime * 1000).toISOString()
          : "Unknown",
      );
    });
  }
}

main().catch((e) => {
  console.error("FAILED:", e.stack || e.message);
  process.exit(1);
});
