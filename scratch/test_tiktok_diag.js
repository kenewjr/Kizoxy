const fs = require('fs');
const path = require('path');
const Module = require('module');

const clientPath = path.resolve(__dirname, '../src/integrations/tiktok/client.js');
let clientCode = fs.readFileSync(clientPath, 'utf8');

// Export internal functions for diagnostic script
clientCode += `
module.exports._fetchTikwmSearch = _fetchTikwmSearch;
module.exports._fetchTikwmUserPosts = _fetchTikwmUserPosts;
module.exports._fetchHtmlProfile = _fetchHtmlProfile;
module.exports._fetchOembedProfile = _fetchOembedProfile;
module.exports._fetchHtmlProfileExtracted = _fetchHtmlProfileExtracted;
`;

const customModule = new Module(clientPath, module.parent);
customModule.filename = clientPath;
customModule.paths = Module._nodeModulePaths(path.dirname(clientPath));
customModule._compile(clientCode, clientPath);
const client = customModule.exports;

const accounts = ['mrbeast', 'khaby.lame', 'tiktok'];

(async () => {
  for (const username of accounts) {
    console.log(`\n==================================================`);
    console.log(`TESTING ACCOUNT: ${username}`);
    console.log(`==================================================`);

    // Strategy 1 (was TikWM Search)
    try {
      const res = await client._fetchTikwmSearch(username);
      console.log(`[TikWM Search] SUCCESS: ${res.videos.length} videos, live: ${res.user.live}`);
      if (res.videos.length > 0) {
        console.log(`  Top video ID: ${res.videos[0].id}, createTime: ${res.videos[0].createTime} (${new Date(res.videos[0].createTime * 1000).toISOString()})`);
      }
    } catch (e) {
      console.log(`[TikWM Search] FAILED: ${e.message}`);
    }

    // Strategy 2 (was TikWM User Posts)
    try {
      const res = await client._fetchTikwmUserPosts(username);
      console.log(`[TikWM User Posts] SUCCESS: ${res.videos.length} videos, live: ${res.user.live}`);
      if (res.videos.length > 0) {
        console.log(`  Top video ID: ${res.videos[0].id}, createTime: ${res.videos[0].createTime} (${new Date(res.videos[0].createTime * 1000).toISOString()})`);
      }
    } catch (e) {
      console.log(`[TikWM User Posts] FAILED: ${e.message}`);
    }

    // Strategy 3 (Direct HTML Profile)
    try {
      const res = await client._fetchHtmlProfile(username);
      console.log(`[Direct HTML] SUCCESS: ${res.videos.length} videos, live: ${res.user.live}, liveId: ${res.user.liveId}`);
      if (res.videos.length > 0) {
        console.log(`  Top video ID: ${res.videos[0].id}, createTime: ${res.videos[0].createTime} (${new Date(res.videos[0].createTime * 1000).toISOString()})`);
      }
    } catch (e) {
      console.log(`[Direct HTML] FAILED: ${e.message}`);
    }

    // Strategy 4 (oEmbed)
    try {
      const res = await client._fetchOembedProfile(username);
      console.log(`[oEmbed] SUCCESS: user: ${res.user.username}`);
    } catch (e) {
      console.log(`[oEmbed] FAILED: ${e.message}`);
    }

    // Strategy 5 (HTML Extracted)
    try {
      const res = await client._fetchHtmlProfileExtracted(username);
      console.log(`[HTML Extracted] SUCCESS: ${res.videos.length} videos`);
      if (res.videos.length > 0) {
        console.log(`  Top video ID: ${res.videos[0].id}, createTime: ${res.videos[0].createTime} (${new Date(res.videos[0].createTime * 1000).toISOString()})`);
      }
    } catch (e) {
      console.log(`[HTML Extracted] FAILED: ${e.message}`);
    }

    // checkLiveStatus
    try {
      const res = await client.checkLiveStatus(username);
      console.log(`[checkLiveStatus] live: ${res.live}, liveId: ${res.liveId}`);
    } catch (e) {
      console.log(`[checkLiveStatus] FAILED: ${e.message}`);
    }
  }
})();
