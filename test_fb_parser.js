import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('fb_post_raw.html', 'utf8');
const $ = cheerio.load(html);

function parseNumeric(val) {
  if (!val) return 0;
  val = val.toUpperCase().replace(/,/g, '').trim();
  if (val.includes('K')) {
    return Math.round(parseFloat(val.replace('K', '')) * 1000);
  }
  if (val.includes('M')) {
    return Math.round(parseFloat(val.replace('M', '')) * 1000000);
  }
  // Support Vietnamese format where comma is decimal (e.g. 2,8K -> 2800)
  if (/[0-9]+,[0-9]+/.test(val)) {
    val = val.replace(',', '.');
  }
  return parseInt(val, 10) || 0;
}

// 1. Current server.ts regex parser
function parseCurrentServer() {
  const getStats = (htmlStr) => {
    const reactionMatch = htmlStr.match(/"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
    const commentMatch = htmlStr.match(/"comments"\s*:\s*\{\s*"total_count"\s*:\s*(\d+)/);
    const shareMatch = htmlStr.match(/"share_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);

    let reactions = reactionMatch ? parseInt(reactionMatch[1]) : 0;
    let comments = commentMatch ? parseInt(commentMatch[1]) : 0;
    let shares = shareMatch ? parseInt(shareMatch[1]) : 0;
    return { reactions, comments, shares };
  };
  return getStats(html);
}

// 2. DOM Span offset parser (like test_all_fb.js)
function parseSpanOffset() {
  const spans = [];
  $('span').each((i, el) => {
    const text = $(el).text().trim();
    if (text) spans.push(text);
  });
  
  let comments = 0;
  let shares = 0;
  let reactions = 0;
  
  let commentIdx = -1;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (/\b\d+\s*(comments?|bình luận)\b/i.test(s)) {
      commentIdx = i;
      const match = s.match(/(\d+)/);
      if (match) comments = parseInt(match[1], 10);
      break;
    }
  }
  
  if (commentIdx !== -1) {
    // Reactions: search backwards
    for (let offset = 1; offset <= 10; offset++) {
      const prevIdx = commentIdx - offset;
      if (prevIdx >= 0) {
        const val = spans[prevIdx];
        if (/^[\d.,]+[kKmM]?$/.test(val)) {
          reactions = parseNumeric(val);
          break;
        }
      }
    }
    
    // Shares: search forwards
    for (let offset = 1; offset <= 10; offset++) {
      const nextIdx = commentIdx + offset;
      if (nextIdx < spans.length) {
        const val = spans[nextIdx];
        if (/\b\d+\s*(shares?|chia sẻ|lượt chia sẻ)\b/i.test(val)) {
          const match = val.match(/(\d+)/);
          if (match) shares = parseInt(match[1], 10);
          break;
        }
      }
    }
  }
  
  return { reactions, comments, shares };
}

// 3. Structured Text Parser using robust multilingual regexes on raw text
function parseMultilingualText() {
  const textContent = $('body').text();
  
  let comments = 0;
  let shares = 0;
  let reactions = 0;

  // Let's search for "All reactions:XXX" or "Tất cả cảm xúc:XXX"
  const reactionsMatch = textContent.match(/(?:All reactions|Tất cả cảm xúc):\s*([\d.,]+[KkMm]?)/i);
  if (reactionsMatch) {
    reactions = parseNumeric(reactionsMatch[1]);
  }

  // Comments
  const commentsMatch = textContent.match(/([\d.,]+[KkMm]?)\s*(?:comments?|bình luận)/i);
  if (commentsMatch) {
    comments = parseNumeric(commentsMatch[1]);
  }

  // Shares
  const sharesMatch = textContent.match(/([\d.,]+[KkMm]?)\s*(?:shares?|chia sẻ|lượt chia sẻ)/i);
  if (sharesMatch) {
    shares = parseNumeric(sharesMatch[1]);
  }

  return { reactions, comments, shares };
}

console.log("Current Server Regex Parser:", parseCurrentServer());
console.log("DOM Span Offset Parser:", parseSpanOffset());
console.log("Multilingual Text Parser:", parseMultilingualText());
