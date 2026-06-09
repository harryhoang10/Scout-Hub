import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('fb_post_raw.html', 'utf8');
const $ = cheerio.load(html);

console.log("=== Page Title ===");
console.log($('title').text());

console.log("\n=== Meta Tags ===");
$('meta').each((i, el) => {
  const name = $(el).attr('name');
  const property = $(el).attr('property');
  const content = $(el).attr('content');
  if (name || property) {
    console.log(`${name || property}: ${content}`);
  }
});

console.log("\n=== Trying Regex Matches for JSON ===");
const reactionMatch = html.match(/"reaction_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
const commentMatch = html.match(/"comments"\s*:\s*\{\s*"total_count"\s*:\s*(\d+)/);
const shareMatch = html.match(/"share_count"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
console.log("JSON Regex matches:", {
  reactionMatch: reactionMatch ? reactionMatch[0] : null,
  commentMatch: commentMatch ? commentMatch[0] : null,
  shareMatch: shareMatch ? shareMatch[0] : null,
});

console.log("\n=== Checking for text patterns in body ===");
const text = $('body').text();
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
console.log(`Total body lines: ${lines.length}`);
console.log("Sample lines with numbers and keywords:");
for (const line of lines) {
  if (line.match(/\d/) && /thích|bình luận|chia sẻ|comment|share|like|reaction/i.test(line)) {
    console.log("  Line:", line.slice(0, 100));
  }
}
