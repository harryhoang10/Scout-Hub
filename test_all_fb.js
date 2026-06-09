import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const urls = [
  "https://www.facebook.com/share/p/1BEEgaStVN/?mibextid=wwXIfr",
  "https://www.facebook.com/share/p/18h4jLfJWe/?mibextid=wwXIfr",
  "https://www.facebook.com/share/p/1BHGncNZtK/?mibextid=wwXIfr"
];

function parseNumeric(val) {
  if (!val) return 0;
  val = val.toUpperCase().replace(/,/g, '').trim();
  if (val.includes('K')) {
    return Math.round(parseFloat(val.replace('K', '')) * 1000);
  }
  if (val.includes('M')) {
    return Math.round(parseFloat(val.replace('M', '')) * 1000000);
  }
  return parseInt(val, 10) || 0;
}

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  for (const url of urls) {
    console.log(`\nScraping Facebook URL: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 6000));
      
      const spans = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean);
      });
      
      console.log(`Spans extracted: ${spans.length}`);
      
      // Parse metrics
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
        for (let offset = 1; offset <= 5; offset++) {
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
        for (let offset = 1; offset <= 5; offset++) {
          const nextIdx = commentIdx + offset;
          if (nextIdx < spans.length) {
            const val = spans[nextIdx];
            if (/\b\d+\s*(shares?|chia sẻ)\b/i.test(val)) {
              const match = val.match(/(\d+)/);
              if (match) shares = parseInt(match[1], 10);
              break;
            }
          }
        }
      } else {
        // If comment_idx is not found, maybe comments/shares are 0 and not shown,
        // let's look for any span that looks like reactions count or matches "reaction"
        console.log("Comment span not found. Let's dump candidate spans:");
        for (let i = 0; i < Math.min(spans.length, 50); i++) {
          console.log(`Span ${i}: ${spans[i]}`);
        }
      }
      
      console.log(`Result -> Reactions: ${reactions}, Comments: ${comments}, Shares: ${shares}`);
    } catch (err) {
      console.error(`Scrape failed for ${url}:`, err.message);
    }
  }
  
  await browser.close();
}

run().catch(console.error);
