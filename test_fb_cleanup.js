import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('fb_post_raw.html', 'utf8');
const $ = cheerio.load(html);

// Clean HTML first
const cleanDoc = cheerio.load(html);
cleanDoc('script, style, noscript, iframe').remove();
const textContent = cleanDoc('body').text().replace(/\s+/g, ' ');

console.log("=== Cleaned Visible Text (first 500 chars) ===");
console.log(textContent.slice(0, 500));

function parseNumeric(val) {
  if (!val) return 0;
  const clean = val.toUpperCase().replace(/,/g, '').trim();
  let v = clean;
  if (/[0-9]+,[0-9]+/.test(clean)) {
    v = clean.replace(',', '.');
  }
  if (v.includes('K')) {
    return Math.round(parseFloat(v.replace('K', '')) * 1000);
  }
  if (v.includes('M')) {
    return Math.round(parseFloat(v.replace('M', '')) * 1000000);
  }
  return parseInt(v, 10) || 0;
}

let comments = 0;
let shares = 0;
let reactions = 0;

// Reactions
const reactionsMatch = textContent.match(/(?:All reactions|Tần cả cảm xúc|Tất cả cảm xúc):\s*([\d.,]+[KkMm]?)/i);
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

console.log("\nParsed from Cleaned Text:", { reactions, comments, shares });
