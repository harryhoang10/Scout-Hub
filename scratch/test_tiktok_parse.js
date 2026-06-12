import * as cheerio from 'cheerio';

async function testParse() {
  const url = "https://www.tiktok.com/@phananh/video/7234567890123456789";
  console.log("Fetching TikTok...");
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await res.text();
    const match = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (match) {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      const defaultScope = parsed.__DEFAULT_SCOPE__;
      console.log("video-detail:", JSON.stringify(defaultScope['webapp.video-detail'], null, 2));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

testParse();
