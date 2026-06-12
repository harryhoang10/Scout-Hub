import * as cheerio from 'cheerio';

async function scrapeTikTokPost(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (response.ok) {
      const html = await response.text();
      const match = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        const parsed = JSON.parse(match[1].trim());
        const defaultScope = parsed.__DEFAULT_SCOPE__;
        if (defaultScope && defaultScope['webapp.video-detail']) {
          const itemInfo = defaultScope['webapp.video-detail'].itemInfo;
          if (itemInfo && itemInfo.itemStruct && itemInfo.itemStruct.stats) {
            const stats = itemInfo.itemStruct.stats;
            const playCount = Number(stats.playCount) || 0;
            const diggCount = Number(stats.diggCount) || 0;
            const commentCount = Number(stats.commentCount) || 0;
            const shareCount = Number(stats.shareCount) || 0;
            const collectCount = Number(stats.collectCount) || 0;
            return {
              view: playCount,
              engagement: diggCount + commentCount + shareCount + collectCount,
              details: { likes: diggCount, comments: commentCount, shares: shareCount, saves: collectCount }
            };
          }
        }
      }
    }
  } catch (e) {
    console.error("TikTok error:", e.message);
  }
  return null;
}

async function scrapeFacebookPost(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    if (response.ok) {
      const html = await response.text();
      const reactionMatch = html.match(/"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      const commentMatch = html.match(/"comments"\s*:\s*\{\s*"total_count"\s*:\s*(\d+)/);
      const shareMatch = html.match(/"share_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);

      let reactions = reactionMatch ? parseInt(reactionMatch[1]) : 0;
      let comments = commentMatch ? parseInt(commentMatch[1]) : 0;
      let shares = shareMatch ? parseInt(shareMatch[1]) : 0;

      let views = 0;
      const playMatch = html.match(/"play_count"\s*:\s*(\d+)/) || html.match(/"video_view_count"\s*:\s*(\d+)/);
      if (playMatch) {
        views = parseInt(playMatch[1], 10);
      }
      return {
        view: views,
        engagement: reactions + comments + shares,
        details: { reactions, comments, shares }
      };
    }
  } catch (e) {
    console.error("Facebook error:", e.message);
  }
  return null;
}

async function scrapeInstagramPost(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    if (response.ok) {
      const html = await response.text();
      let likeCountMatch = html.match(/"like_count"\s*:\s*(\d+)/) || html.match(/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      let commentCountMatch = html.match(/"comment_count"\s*:\s*(\d+)/) || html.match(/"edge_media_to_parent_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      let viewCountMatch = html.match(/"view_count"\s*:\s*(\d+)/) || html.match(/"play_count"\s*:\s*(\d+)/) || html.match(/"video_view_count"\s*:\s*(\d+)/);

      let likes = likeCountMatch ? parseInt(likeCountMatch[1]) : 0;
      let comments = commentCountMatch ? parseInt(commentCountMatch[1]) : 0;
      let views = viewCountMatch ? parseInt(viewCountMatch[1]) : 0;

      if (likes === 0 && comments === 0) {
        const $ = cheerio.load(html);
        const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
        if (desc) {
          const likeMatch = desc.match(/([\d.,KkMm]+)\s*(?:likes|lượt thích)/i);
          const commMatch = desc.match(/([\d.,KkMm]+)\s*(?:comments|bình luận)/i);
          const parseShortNum = (s) => {
            const lower = s.toLowerCase();
            if (lower.includes('k')) return parseFloat(lower) * 1000;
            if (lower.includes('m')) return parseFloat(lower) * 1000000;
            return parseFloat(s.replace(/,/g, ''));
          };
          if (likeMatch) likes = Math.round(parseShortNum(likeMatch[1])) || 0;
          if (commMatch) comments = Math.round(parseShortNum(commMatch[1])) || 0;
        }
      }
      return {
        view: views,
        engagement: likes + comments,
        details: { likes, comments }
      };
    }
  } catch (e) {
    console.error("Instagram error:", e.message);
  }
  return null;
}

async function runTests() {
  console.log("--- Test Scrape TikTok ---");
  const tk = await scrapeTikTokPost("https://www.tiktok.com/@vtv24official/video/7343940176865660161");
  console.log("TikTok result:", tk);

  console.log("\n--- Test Scrape Facebook ---");
  const fb = await scrapeFacebookPost("https://www.facebook.com/share/p/1BEEgaStVN/?mibextid=wwXIfr");
  console.log("Facebook result:", fb);

  console.log("\n--- Test Scrape Instagram ---");
  const ig = await scrapeInstagramPost("https://www.instagram.com/reel/DY9hZnczdim/?igsh=MWk3cnVvcjlwZ3VndA==");
  console.log("Instagram result:", ig);
}

runTests();
