import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Extractor Tab (default)
  console.log('Navigating to scouthubs.netlify.app...');
  await page.goto('https://scouthubs.netlify.app/', { waitUntil: 'networkidle0' });
  
  // Switch to light mode if possible (clicking the theme toggle)
  // Assuming there's a theme toggle button. Let's look for a button with Moon/Sun icon, or just force light mode via CSS
  await page.evaluate(() => {
    document.documentElement.className = 'theme-light';
  });
  // Wait a bit for transition
  await new Promise(r => setTimeout(r, 500));
  
  console.log('Taking screenshot of Universal Extractor...');
  await page.screenshot({ path: path.join(__dirname, 'scouthub_ext.png') });

  // 2. Scout CRM Tab
  console.log('Switching to Scout CRM tab...');
  // Find the button for Scout CRM and click it. 
  // It usually has text "Scout CRM"
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const crmTab = tabs.find(t => t.textContent && t.textContent.includes('Scout CRM'));
    if (crmTab) crmTab.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(__dirname, 'scouthub_crm.png') });

  // 3. Execution Hub (Wait, it might not be deployed yet!)
  // If it's not deployed, the Execution Hub tab won't exist on netlify.
  // We'll try to find it.
  console.log('Switching to Execution Hub tab...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const execTab = tabs.find(t => t.textContent && t.textContent.includes('Execution Hub'));
    if (execTab) execTab.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(__dirname, 'scouthub_exec.png') });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

run().catch(console.error);
