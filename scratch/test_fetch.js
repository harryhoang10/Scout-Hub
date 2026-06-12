import * as cheerio from 'cheerio';

async function testFetchTikTok() {
  const url = "https://www.tiktok.com/@phananh/video/7234567890123456789";
  console.log("Fetching TikTok...");
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
    });
    console.log("TikTok Status:", res.status);
    const html = await res.text();
    console.log("TikTok Length:", html.length);
    const hasRehydration = html.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    console.log("TikTok contains hydration data:", hasRehydration);
  } catch (e) {
    console.error("TikTok Error:", e.message);
  }
}

async function testFetchFacebook() {
  const url = "https://www.facebook.com/share/p/1BEEgaStVN/?mibextid=wwXIfr";
  console.log("Fetching Facebook...");
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
    });
    console.log("Facebook Status:", res.status);
    const html = await res.text();
    console.log("Facebook Length:", html.length);
    const reactionMatch = html.match(/"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    console.log("Facebook reactionMatch:", reactionMatch ? reactionMatch[0] : "None");
  } catch (e) {
    console.error("Facebook Error:", e.message);
  }
}

async function test() {
  await testFetchTikTok();
  await testFetchFacebook();
}

test();
