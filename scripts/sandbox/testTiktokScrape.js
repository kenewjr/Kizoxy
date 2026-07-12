async function main() {
  const username = "mrbeast";
  const url = `https://www.tiktok.com/@${username}`;
  console.log(`Fetching ${url}...`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    console.log("Status:", res.status);
    console.log("Headers:", Array.from(res.headers.keys()));
    const data = await res.text();
    console.log("HTML length:", data.length);

    // Try to find __UNIVERSAL_DATA_FOR_REHYDRATION__
    const matchRehydration = data.match(
      /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"\s+type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (matchRehydration) {
      console.log(
        "Found __UNIVERSAL_DATA_FOR_REHYDRATION__! Length:",
        matchRehydration[1].length,
      );
      try {
        const parsed = JSON.parse(matchRehydration[1]);
        console.log("Parsed keys:", Object.keys(parsed));
      } catch (err) {
        console.error("JSON parse failed for rehydration data:", err.message);
      }
    } else {
      console.log("__UNIVERSAL_DATA_FOR_REHYDRATION__ not found.");
    }

    // Try to find SIGI_STATE
    const matchSigi = data.match(
      /window\['SIGI_STATE'\]\s*=\s*(\{[\s\S]*?\});/,
    );
    if (matchSigi) {
      console.log("Found SIGI_STATE! Length:", matchSigi[1].length);
      try {
        const parsed = JSON.parse(matchSigi[1]);
        console.log("Parsed SIGI_STATE keys:", Object.keys(parsed));
      } catch (err) {
        console.error("JSON parse failed for SIGI_STATE:", err.message);
      }
    } else {
      console.log("SIGI_STATE not found.");
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

main();
