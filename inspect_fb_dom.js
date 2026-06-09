import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('fb_post_raw.html', 'utf8');
const $ = cheerio.load(html);

// Find all elements that contain text matching "comments", "bình luận", "shares", "chia sẻ"
console.log("=== Searching for metric elements ===");

$('*').each((i, el) => {
  const text = $(el).text().trim();
  // Only look at leaf-like elements or elements with short text containing numbers and keywords
  if (text.length < 100 && /\d/.test(text) && /bình luận|chia sẻ|comment|share|like|thích/i.test(text)) {
    const tagName = el.name;
    const className = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    console.log(`Tag: <${tagName} class="${className}" id="${id}"> -> Text: "${text}"`);
  }
});
