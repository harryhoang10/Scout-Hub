import fetch from 'node-fetch';

async function test() {
  const response = await fetch('https://www.facebook.com/zuck', {
    headers: {
      'User-Agent': 'Twitterbot/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });

  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Title:', text.match(/<title>(.*?)<\/title>/)?.[1]);
  console.log('Description:', text.match(/<meta name="description" content="(.*?)"/)?.[1]);
}

test();
