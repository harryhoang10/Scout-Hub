async function testTikTokWithUA(ua, label) {
  const url = "https://www.tiktok.com/@phananh/video/7234567890123456789";
  console.log(`Fetching TikTok with ${label}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    console.log(`${label} Status:`, res.status);
    const html = await res.text();
    console.log(`${label} Length:`, html.length);
    const rehydration = html.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    console.log(`${label} Rehydration:`, rehydration);
    if (rehydration) {
      console.log("Success! Preview around rehydration:");
      const idx = html.indexOf('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      console.log(html.slice(idx, idx + 200));
    }
  } catch (e) {
    console.error(`${label} Error:`, e.message);
  }
}

async function test() {
  // Mobile Android Chrome
  await testTikTokWithUA(
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
    "Mobile Chrome"
  );
  // Facebook Bot
  await testTikTokWithUA(
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Facebook Bot"
  );
  // Desktop Safari
  await testTikTokWithUA(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Desktop Safari"
  );
}

test();
