import * as cheerio from 'cheerio';

async function testFetchInstagram() {
  const url = "https://www.instagram.com/reel/DY9hZnczdim/?igsh=MWk3cnVvcjlwZ3VndA==";
  console.log("Fetching Instagram...");
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
    });
    console.log("Instagram Status:", res.status);
    const html = await res.text();
    console.log("Instagram Length:", html.length);
    const likeCountMatch = html.match(/"like_count"\s*:\s*(\d+)/) || html.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    console.log("Instagram likeCountMatch:", likeCountMatch ? likeCountMatch[0] : "None");
    
    // Check if there is some meta tags for likes/comments
    const $ = cheerio.load(html);
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    console.log("Instagram Meta Description:", desc);
  } catch (e) {
    console.error("Instagram Error:", e.message);
  }
}

testFetchInstagram();
