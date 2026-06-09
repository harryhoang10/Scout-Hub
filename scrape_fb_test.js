import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const url = "https://www.facebook.com/share/p/1BEEgaStVN/?mibextid=wwXIfr";
  console.log("Navigating to Facebook URL:", url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Taking screenshot...");
  await page.screenshot({ path: 'fb_post.png' });
  
  const html = await page.content();
  fs.writeFileSync('fb_post_raw.html', html);
  
  const textContent = await page.evaluate(() => document.body.innerText);
  console.log("Text content preview (first 1000 chars):");
  console.log(textContent.slice(0, 1000));
  
  // Try to find numbers followed by comments/shares/likes in innerText
  const lines = textContent.split('\n');
  console.log("\nSearching lines containing metric keywords:");
  for (const line of lines) {
    if (/like|comment|share|reactions|thích|bình luận|chia sẻ/i.test(line)) {
      console.log("Line:", line.trim());
    }
  }
  
  await browser.close();
}

run().catch(console.error);
