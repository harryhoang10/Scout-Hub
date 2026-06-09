import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  const url = "https://www.instagram.com/reel/DY9hZnczdim/?igsh=MWk3cnVvcjlwZ3VndA==";
  console.log("Navigating to Instagram URL:", url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 6000));
  
  const textContent = await page.evaluate(() => document.body.innerText);
  console.log("Instagram Inner Text Preview:");
  console.log(textContent.slice(0, 1000));
  
  const spans = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean);
  });
  
  console.log("\nSearching for numbers or keywords in Instagram spans:");
  for (const s of spans) {
    if (s.includes('plays') || s.includes('views') || s.includes('likes') || s.includes('comments') || /^\d+[\d,.]*[KkMm]?$/.test(s)) {
      console.log("Span:", repr(s));
    }
  }
  
  function repr(str) { return JSON.stringify(str); }
  
  await browser.close();
}

run().catch(console.error);
