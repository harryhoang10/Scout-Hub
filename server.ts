import 'dotenv/config';
import express from "express";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to extract contact info from bio
function extractContact(text: string) {
  let phone = '';
  let email = '';
  if (!text) return { phone, email };
  
  // Extract email
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) email = emailMatch[1];
  
  // Extract phone (VN format: 03, 05, 07, 08, 09) + 8 digits, allow dots, spaces
  const phoneRegex = /((?:\+|00)?84|0)\s*[3|5|7|8|9](?:[\s\.]*\d){8}\b/ig;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && phoneMatch.length > 0) {
     let cleanPhone = phoneMatch[0].replace(/[^\d]/g, '');
     if (cleanPhone.startsWith('84')) cleanPhone = '0' + cleanPhone.substring(2);
     if (cleanPhone.length >= 10) {
        phone = cleanPhone.substring(0, 10);
     }
  }
  
  return { phone, email };
}

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

  // ============ TikTok Scrape API ============
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.includes("tiktok.com")) {
        return res.status(400).json({ error: "Vui lòng nhập link TikTok hợp lệ" });
      }

      let fetchUrl = url.trim();
      if (!fetchUrl.startsWith('http')) fetchUrl = `https://${fetchUrl}`;

      let html = '';
      let responseOk = false;

      // Try multiple user agents
      const userAgents = [
        {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        }
      ];

      for (const headers of userAgents) {
        if (responseOk) break;
        try {
          const response = await fetch(fetchUrl, { headers });
          if (response.ok) {
            html = await response.text();
            responseOk = true;
          }
        } catch (e) {
          // continue to next UA
        }
      }

      if (!html) {
        throw new Error('TikTok không phản hồi. Có thể đang bị chặn (Captcha).');
      }

      const $ = cheerio.load(html);

      // Parse __UNIVERSAL_DATA_FOR_REHYDRATION__
      const scriptContent = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
      
      if (scriptContent) {
        try {
          const data = JSON.parse(scriptContent);
          const defaultScope = data?.__DEFAULT_SCOPE__;
          const webappExtra = defaultScope?.['webapp.user-detail'];
          const userInfo = webappExtra?.userInfo;
          
          if (userInfo && userInfo.user && userInfo.stats) {
            const user = userInfo.user;
            const stats = userInfo.stats;

            // Extract video stats for engagement metrics
            let averageView = 0;
            let averageEngagement = 0;
            let totalLikes = 0;
            let totalComments = 0;
            let totalShares = 0;
            let videoCount = 0;

            // Try to get video list from ItemModule or ItemList
            const itemModule = defaultScope?.['webapp.video-detail']?.itemInfo?.itemStruct;
            const userPost = defaultScope?.['webapp.user-detail'];
            
            // Try multiple paths for video data
            let videoItems: any[] = [];
            
            // Path 1: Check ItemModule in the data root
            if (data?.ItemModule) {
              videoItems = Object.values(data.ItemModule);
            }
            
            // Path 2: Check in user-detail scope
            if (videoItems.length === 0 && userPost?.userPost) {
              videoItems = userPost.userPost;
            }

            // Path 3: Look in the raw JSON for video items
            if (videoItems.length === 0) {
              try {
                const videoRegex = /"playCount"\s*:\s*(\d+).*?"diggCount"\s*:\s*(\d+).*?"commentCount"\s*:\s*(\d+).*?"shareCount"\s*:\s*(\d+)/g;
                let match;
                const videoStats: Array<{views: number, likes: number, comments: number, shares: number}> = [];
                const rawJson = scriptContent;
                
                while ((match = videoRegex.exec(rawJson)) !== null && videoStats.length < 10) {
                  videoStats.push({
                    views: parseInt(match[1]) || 0,
                    likes: parseInt(match[2]) || 0,
                    comments: parseInt(match[3]) || 0,
                    shares: parseInt(match[4]) || 0,
                  });
                }
                
                if (videoStats.length > 0) {
                  videoCount = videoStats.length;
                  const totals = videoStats.reduce((acc, v) => ({
                    views: acc.views + v.views,
                    likes: acc.likes + v.likes,
                    comments: acc.comments + v.comments,
                    shares: acc.shares + v.shares,
                  }), { views: 0, likes: 0, comments: 0, shares: 0 });
                  
                  averageView = Math.round(totals.views / videoCount);
                  totalLikes = totals.likes;
                  totalComments = totals.comments;
                  totalShares = totals.shares;
                  averageEngagement = Math.round((totals.likes + totals.comments + totals.shares) / videoCount);
                }
              } catch(e) {
                // Regex extraction failed, continue
              }
            }

            // If we got video items from structured data
            if (videoItems.length > 0) {
              const top10 = videoItems.slice(0, 10);
              videoCount = top10.length;
              
              const totals = top10.reduce((acc: any, video: any) => ({
                views: acc.views + (video.stats?.playCount || video.playCount || 0),
                likes: acc.likes + (video.stats?.diggCount || video.diggCount || 0),
                comments: acc.comments + (video.stats?.commentCount || video.commentCount || 0),
                shares: acc.shares + (video.stats?.shareCount || video.shareCount || 0),
              }), { views: 0, likes: 0, comments: 0, shares: 0 });
              
              averageView = Math.round(totals.views / videoCount);
              totalLikes = totals.likes;
              totalComments = totals.comments;
              totalShares = totals.shares;
              averageEngagement = Math.round((totals.likes + totals.comments + totals.shares) / videoCount);
            }

            return res.json({
              bio: user.signature || '',
              channelId: user.uniqueId || '',
              channelLink: `https://www.tiktok.com/@${user.uniqueId}`,
              following: stats.followingCount || 0,
              followers: stats.followerCount || 0,
              likes: stats.heartCount || 0,
              profilePic: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
              nickname: user.nickname || '',
              bioLink: user.bioLink?.link || '',
              email: user.bioEmail || user.email || extractContact(user.signature || '').email,
              phone: user.phone || extractContact(user.signature || '').phone,
              // Engagement metrics
              averageView,
              averageEngagement,
              totalLikes,
              totalComments,
              totalShares,
              videoCount,
            });
          }
        } catch (e) {
          console.error("Error parsing __UNIVERSAL_DATA_FOR_REHYDRATION__", e);
        }
      }

      // SIGI_STATE fallback
      const sigiScript = $('#SIGI_STATE').html();
      if (sigiScript) {
        try {
          const data = JSON.parse(sigiScript);
          const userModule = data?.UserModule;
          const users = userModule?.users;
          const statsMod = userModule?.stats;
          const itemModule = data?.ItemModule;
          
          if (users && statsMod) {
            const username = Object.keys(users)[0];
            const user = users[username];
            const userStats = statsMod[username];

            let averageView = 0, averageEngagement = 0, totalLikes = 0, totalComments = 0, totalShares = 0, videoCount = 0;

            if (itemModule) {
              const videos = Object.values(itemModule).slice(0, 10) as any[];
              videoCount = videos.length;
              if (videoCount > 0) {
                const totals = videos.reduce((acc: any, v: any) => ({
                  views: acc.views + (v.stats?.playCount || 0),
                  likes: acc.likes + (v.stats?.diggCount || 0),
                  comments: acc.comments + (v.stats?.commentCount || 0),
                  shares: acc.shares + (v.stats?.shareCount || 0),
                }), { views: 0, likes: 0, comments: 0, shares: 0 });

                averageView = Math.round(totals.views / videoCount);
                totalLikes = totals.likes;
                totalComments = totals.comments;
                totalShares = totals.shares;
                averageEngagement = Math.round((totals.likes + totals.comments + totals.shares) / videoCount);
              }
            }

            if (user && userStats) {
              return res.json({
                bio: user.signature || '',
                channelId: user.uniqueId || '',
                channelLink: `https://www.tiktok.com/@${user.uniqueId}`,
                following: userStats.followingCount || 0,
                followers: userStats.followerCount || 0,
                likes: userStats.heartCount || 0,
                profilePic: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
                nickname: user.nickname || '',
                bioLink: user.bioLink?.link || '',
                email: user.bioEmail || user.email || extractContact(user.signature || '').email,
                phone: user.phone || extractContact(user.signature || '').phone,
                averageView, averageEngagement, totalLikes, totalComments, totalShares, videoCount,
              });
            }
          }
        } catch (e) {
          console.error("Error parsing SIGI_STATE", e);
        }
      }

      // Meta tags fallback
      const title = $('title').text();
      const desc = $('meta[name="description"]').attr('content');
      const image = $('meta[property="og:image"]').attr('content');
      const urlCanonical = $('meta[property="og:url"]').attr('content');

      if (title && desc) {
        return res.json({
          bio: desc,
          channelId: title.split('|')[0].trim(),
          channelLink: urlCanonical || url,
          following: "N/A",
          followers: "N/A",
          likes: "N/A",
          profilePic: image,
          nickname: title.split('|')[0].trim()
        });
      }

      return res.status(404).json({ error: "Không thể trích xuất dữ liệu. TikTok có thể đang chặn (Captcha)." });

    } catch (error: any) {
      console.error("Scrape error:", error.message);
      res.status(500).json({ error: "Lỗi khi lấy dữ liệu: " + error.message });
    }
  });

  // ============ TikTok Video Engagement (RapidAPI) ============
  app.post('/api/tiktok-videos', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const RAPIDAPI_KEY = (req.headers['x-rapidapi-key'] as string) || process.env.RAPIDAPI_KEY;
      if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY') {
        return res.status(400).json({ error: 'RapidAPI key chưa được cấu hình. Vui lòng thiết lập trong Cài đặt hoặc file .env' });
      }

      // Call RapidAPI TikTok Scraper - get user posts
      const apiUrl = `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=15`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('RapidAPI error:', response.status, errText);
        throw new Error(`RapidAPI lỗi (${response.status})`);
      }

      const data = await response.json();
      
      // Extract video items from response
      let videos: any[] = [];
      if (data?.data?.videos) {
        videos = data.data.videos;
      } else if (Array.isArray(data?.data)) {
        videos = data.data;
      } else if (data?.videos) {
        videos = data.videos;
      }

      if (videos.length === 0) {
        return res.json({
          averageView: 0,
          averageEngagement: 0,
          videos: [],
          videoCount: 0,
        });
      }

      // Skip first 3 videos (most recent), take next 10
      const skipCount = Math.min(3, videos.length);
      const targetVideos = videos.length > 3 
        ? videos.slice(skipCount, skipCount + 10)
        : videos.slice(0, 10); // If <= 3 videos total, just use what we have

      const videoStats = targetVideos.map((v: any) => {
        const stats = v.stats || v;
        return {
          views: stats.play_count || stats.playCount || v.play_count || 0,
          likes: stats.digg_count || stats.diggCount || v.digg_count || 0,
          comments: stats.comment_count || stats.commentCount || v.comment_count || 0,
          shares: stats.share_count || stats.shareCount || v.share_count || 0,
          saves: stats.collect_count || stats.collectCount || v.collect_count || 0,
          description: v.title || v.desc || v.description || '',
        };
      });

      const videoCount = videoStats.length;
      const totals = videoStats.reduce((acc: any, v: any) => ({
        views: acc.views + v.views,
        likes: acc.likes + v.likes,
        comments: acc.comments + v.comments,
        shares: acc.shares + v.shares,
        saves: acc.saves + v.saves,
      }), { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

      const averageView = videoCount > 0 ? Math.round(totals.views / videoCount) : 0;
      const totalEngagementPerVideo = videoCount > 0 
        ? Math.round((totals.likes + totals.comments + totals.shares + totals.saves) / videoCount) 
        : 0;

      return res.json({
        averageView,
        averageEngagement: totalEngagementPerVideo,
        videos: videoStats,
        videoCount,
        totals,
      });

    } catch (error: any) {
      console.error('TikTok video fetch error:', error.message);
      return res.status(500).json({ error: error.message || 'Lỗi khi lấy dữ liệu video' });
    }
  });

  // ============ Facebook Extract API ============
  app.post('/api/extract-facebook', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      let fetchUrl = url.trim();
      if (!fetchUrl.startsWith('http')) fetchUrl = `https://${fetchUrl}`;
      
      try {
        fetchUrl = new URL(fetchUrl).toString();
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const userAgents = [
        {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      ];

      let response: Response | null = null;
      for (const headers of userAgents) {
        try {
          const r = await fetch(fetchUrl, { headers });
          if (r.ok) { response = r; break; }
          response = r; // keep last response for error info
        } catch (e) { /* continue */ }
      }

      // Try m.facebook.com
      if (!response?.ok) {
        const mobileUrl = fetchUrl.replace('www.facebook.com', 'm.facebook.com').replace('facebook.com', 'm.facebook.com');
        try {
          response = await fetch(mobileUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          });
        } catch(e) { /* continue */ }
      }

      const html = await (response as Response).text();
      const $ = cheerio.load(html);

      const title = $('title').text() || '';
      const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const profilePic = $('meta[property="og:image"]').attr('content') || '';
      const nickname = $('meta[property="og:title"]').attr('content') || title.split('|')[0].trim() || '';

      let followers = '';
      // 1. Try structured JSON data in HTML
      const followerMatch = html.match(/"follower_count":\s*(\d+)/) || html.match(/"followerCount":\s*(\d+)/);
      if (followerMatch && followerMatch[1]) {
        followers = followerMatch[1];
      }
      // 2. Try member count for groups
      if (!followers) {
        const memberMatch = html.match(/"member_count":\s*(\d+)/) || html.match(/"memberCount":\s*(\d+)/);
        if (memberMatch && memberMatch[1]) {
          followers = memberMatch[1];
        }
      }
      // 3. Try to extract from meta description (most reliable for public pages)
      // Description example: "Trần Minh Hiếu. 1,049,170 likes · 12,107 talking about this"
      if (!followers && description) {
        // Match patterns like "1,049,170 likes", "500K followers", "2.5 triệu người theo dõi"
        const patterns = [
          /(\d[\d,.]*\s*(?:triệu|nghìn|ngàn|[KkMm])?)\s*(?:followers|người theo dõi)/i,
          /(\d[\d,.]*\s*(?:triệu|nghìn|ngàn|[KkMm])?)\s*(?:likes|lượt thích)/i,
          /(\d[\d,.]*\s*(?:triệu|nghìn|ngàn|[KkMm])?)\s*(?:members|thành viên)/i,
        ];
        for (const pattern of patterns) {
          const match = description.match(pattern);
          if (match && match[1]) {
            followers = match[1].trim();
            break;
          }
        }
      }
      // 4. Try from visible text patterns in HTML body
      if (!followers) {
        const htmlPatterns = [
          /([\d,.]+)\s*(?:triệu|nghìn|ngàn|[KkMm])?\s*(?:người theo dõi|followers|members|thành viên|lượt thích|likes)/i,
          />\s*([\d,.]+)\s*(?:triệu|nghìn|ngàn|[KkMm])?\s*(?:người theo dõi|followers|members|thành viên)/i
        ];
        for (const pattern of htmlPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            followers = match[1].trim();
            break;
          }
        }
      }

      // Convert written Vietnamese terms to literal numeric strings so formatFollowers can process them consistently
      if (followers.toLowerCase().includes('triệu') || followers.toLowerCase().includes('m')) {
        const base = parseFloat(followers.replace(/,/g, '.').replace(/[^\d.]/g, ''));
        if (!isNaN(base)) followers = (base * 1000000).toString();
      } else if (followers.toLowerCase().includes('nghìn') || followers.toLowerCase().includes('ngàn') || followers.toLowerCase().includes('k')) {
        const base = parseFloat(followers.replace(/,/g, '.').replace(/[^\d.]/g, ''));
        if (!isNaN(base)) followers = (base * 1000).toString();
      } else {
        followers = followers.replace(/[^\d]/g, ''); // strip everything except digits if it's just a raw number
      }

      if (!title && !description && !response?.ok) {
        throw new Error(`Facebook responded with status: ${response?.status}`);
      }

      const fbContact = extractContact(description || html || '');

      return res.json({ title, description, profilePic, nickname, followers, url: fetchUrl, phone: fbContact.phone, email: fbContact.email });
    } catch (error: any) {
      console.error("Facebook extraction error:", error.message);
      return res.status(500).json({ error: error.message || 'Failed to extract Facebook data' });
    }
  });

  // ============ Webhook Proxy (to avoid CORS) ============
  app.post('/api/webhook/post', async (req, res) => {
    try {
      const { webhookUrl, data } = req.body;
      if (!webhookUrl) return res.status(400).json({ error: 'Webhook URL is required' });

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        redirect: 'follow',
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { message: text }; }
      
      return res.json({ success: response.ok, status: response.status, result });
    } catch (error: any) {
      console.error("Webhook POST error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/webhook/get', async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      if (!webhookUrl) return res.status(400).json({ error: 'Webhook URL is required' });

      const response = await fetch(webhookUrl, { 
        method: 'GET',
        redirect: 'follow',
      });

      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { raw: text }; }
      
      return res.json({ success: response.ok, data: result });
    } catch (error: any) {
      console.error("Webhook GET error:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the React app
    app.use(express.static(path.join(__dirname, "dist")));
    
    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production server running on http://localhost:${PORT}`);
    });
  }

export default app;
