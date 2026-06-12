async function test() {
  const url = "https://www.tiktok.com/@vtv24official/video/7343940176865660161";
  console.log("Fetching TikTok...");
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  console.log("Status:", res.status);
  const html = await res.text();
  console.log("Length:", html.length);
  const match = html.match(/<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    const parsed = JSON.parse(match[1].trim());
    const defaultScope = parsed.__DEFAULT_SCOPE__;
    console.log("video-detail status:", defaultScope && defaultScope['webapp.video-detail'] ? defaultScope['webapp.video-detail'].statusCode : "Not found");
  } else {
    console.log("Rehydration script not matched!");
  }
}
test();
