const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== Deployment check ===');
  try {
    console.log('Current git commit:', execSync('git rev-parse HEAD').toString().trim());
  } catch (e) {
    console.log('Current git commit: (error reading git commit:', e.message + ')');
  }

  try {
    console.log('Uncommitted changes:', execSync('git status --porcelain').toString().trim() || '(none)');
  } catch (e) {
    console.log('Uncommitted changes: (error checking git status:', e.message + ')');
  }

  const clientPath = path.resolve(__dirname, '../src/integrations/tiktok/client.js');
  try {
    console.log('client.js last modified:', fs.statSync(clientPath).mtime);
  } catch (e) {
    console.log('client.js last modified: (error checking stat:', e.message + ')');
  }
  console.log('Process uptime (seconds):', process.uptime());
  // If process.uptime() is LARGER than the time since client.js was
  // last modified, the RUNNING bot process predates the latest code
  // change — meaning it has NOT picked up any recent fix. This is
  // the single most likely explanation given the repeated-failure
  // pattern across three attempts.

  const testUsernames = ['kenewjr', 'qingdaosixi', 'elena.db2', 'yghtfc928', 'wulanshop123'];

  console.log('\n=== Raw network diagnostic (run this ON the production host) ===');
  console.log('Outbound IP as seen by an external service:');
  const ipCheck = await fetch('https://api.ipify.org?format=json')
    .then((r) => r.json())
    .catch((e) => ({ error: e.message }));
  console.log(JSON.stringify(ipCheck));

  for (const username of testUsernames) {
    console.log(`\n--- Testing @${username} ---`);

    // Test 1: whichever third-party source Part A of the prior task
    // wired in as Strategy 1 — call its RAW fetch directly, not
    // through fetchProfile()'s abstraction, and print full details:
    try {
      const res = await fetch(`https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=12&cursor=0&web=1&hd=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const text = await res.text();
      console.log(`Primary source: HTTP ${res.status}`);
      console.log(`Response headers:`, Object.fromEntries(res.headers.entries()));
      console.log(`Response body (first 500 chars):`, text.slice(0, 500));
    } catch (e) {
      console.log(`Primary source: THREW — ${e.message}`);
    }

    // Test 2: direct HTML scrape with cookies, same raw approach
    try {
      const { loadCookies } = require('../src/integrations/tiktok/cookieStorage');
      const cookies = loadCookies();
      const hasCookies = Boolean(
        cookies && (Array.isArray(cookies) ? cookies.length > 0 : Boolean(cookies))
      );
      console.log(`Cookies configured: ${hasCookies ? 'yes' : 'NO — this may be the issue if direct scraping is the fallback'}`);

      let cookieHeader = null;
      if (cookies) {
        if (typeof cookies === 'string') {
          cookieHeader = cookies.trim();
        } else if (Array.isArray(cookies)) {
          cookieHeader = cookies
            .map((c) => {
              if (typeof c === 'string') return c.trim();
              if (c && c.name && c.value !== undefined && c.value !== null) {
                return `${c.name}=${c.value}`;
              }
              return null;
            })
            .filter(Boolean)
            .join('; ');
        }
      }

      const res = await fetch(`https://www.tiktok.com/@${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      const text = await res.text();
      console.log(`Direct HTML: HTTP ${res.status}, body length ${text.length}`);
      console.log(`Contains rehydration script: ${text.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__')}`);
      console.log(`Contains 'itemList': ${text.includes('itemList')}`);
      console.log(`Contains captcha/blocked indicators: ${/captcha|verify|blocked|denied/i.test(text.slice(0, 3000))}`);
    } catch (e) {
      console.log(`Direct HTML: THREW — ${e.message}`);
    }

    // Test 3: is this even a REAL, currently-existing TikTok account?
    // Sanity-check independent of this project's scraping code entirely —
    // just confirm the profile page itself resolves to a real account
    // vs a 404/removed/private account:
    try {
      const res = await fetch(`https://www.tiktok.com/@${username}`, { method: 'HEAD' });
      console.log(`Profile existence check: HTTP ${res.status} (404/410 = account doesn't exist or was removed)`);
    } catch (e) {
      console.log(`Profile existence check: THREW — ${e.message}`);
    }
  }

  console.log('\n=== fetchProfile() through the actual app code ===');
  const { fetchProfile } = require('../src/integrations/tiktok/client');
  for (const username of testUsernames) {
    try {
      const profile = await fetchProfile(username);
      console.log(`@${username}: live=${profile.user.live}, videos=${profile.videos.length}`);
    } catch (e) {
      console.log(`@${username}: fetchProfile THREW — ${e.message}`);
      console.log(e.stack);
    }
  }
})();
