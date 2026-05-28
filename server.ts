import 'dotenv/config';
import express from "express";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeContact } from './src/lib/contactParser';

const isServerlessRuntime = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

let currentFilename = "";
let currentDirname = "";

try {
  currentFilename = fileURLToPath(import.meta.url);
  currentDirname = path.dirname(currentFilename);
} catch (e) {
  currentFilename = typeof __filename !== 'undefined' ? __filename : '';
  currentDirname = typeof __dirname !== 'undefined' ? __dirname : '';
}

let stealthBrowser: any = null;
let puppeteerInstance: any = null;
async function getStealthBrowser() {
  if (isServerlessRuntime) {
    throw new Error("Puppeteer is disabled in serverless runtime environments (Netlify/Vercel).");
  }

  if (!puppeteerInstance) {
    const extraPkg = 'puppeteer-extra';
    const stealthPkg = 'puppeteer-extra-plugin-stealth';
    const [{ default: puppeteer }, { default: StealthPlugin }] = await Promise.all([
      import(extraPkg),
      import(stealthPkg),
    ]);
    puppeteer.use(StealthPlugin());
    puppeteerInstance = puppeteer;
  }

  if (!stealthBrowser) {
    stealthBrowser = await puppeteerInstance.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  return stealthBrowser;
}

type RapidApiKeyState = {
  key: string;
  cooldownUntil: number;
  lastUsedAt: number;
  successCount: number;
  failureCount: number;
  quotaHitCount: number;
};

type RapidApiRequestSuccess<T = any> = { ok: true; data: T };
type RapidApiRequestFailure = {
  ok: false;
  status: number;
  error: string;
  quotaExceeded: boolean;
  retryAfterMs?: number | null;
};
type RapidApiRequestResult<T = any> = RapidApiRequestSuccess<T> | RapidApiRequestFailure;
type ScrapeCacheEntry<T = any> = {
  data: T;
  cachedAt: number;
  expiresAt: number;
};

const RAPIDAPI_HOST = 'tiktok-scraper7.p.rapidapi.com';
const RAPIDAPI_DEFAULT_COOLDOWN_MS = Number(process.env.RAPIDAPI_COOLDOWN_MS || 15 * 60 * 1000);
const SCRAPE_CACHE_TTL_MS = Number(process.env.SCRAPE_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const rapidApiKeyPool = new Map<string, RapidApiKeyState>();
const scrapeCache = new Map<string, ScrapeCacheEntry>();
let rapidApiNextKeyIndex = 0;

function createEmptyTikTokMetrics(partialWarnings: string[] = []) {
  return {
    averageView: 0,
    averageEngagement: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalSaves: 0,
    videoCount: 0,
    partialWarnings,
  };
}

function normalizeCacheUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

function createScrapeCacheKey(platform: 'tiktok' | 'facebook', url: string, variant = 'default') {
  return `${platform}:${variant}:${normalizeCacheUrl(url)}`;
}

function getVisiblePageText($: cheerio.CheerioAPI) {
  const body = $('body').clone();
  body.find('script, style, noscript, template, svg').remove();
  return body.text().replace(/\s+/g, ' ').trim();
}

function getFacebookExternalLinks($: cheerio.CheerioAPI, baseUrl: string) {
  const blockedHosts = new Set([
    'facebook.com',
    'fb.com',
    'l.facebook.com',
    'm.facebook.com',
    'www.facebook.com',
    'messenger.com',
    'm.me',
    'instagram.com',
    'www.instagram.com',
    'tiktok.com',
    'www.tiktok.com',
  ]);

  const links = $('a[href]')
    .map((_, element) => $(element).attr('href') || '')
    .get()
    .map((rawHref) => {
      try {
        const parsed = new URL(rawHref, baseUrl);
        const normalizedHost = parsed.hostname.replace(/^www\./, '');
        if ((normalizedHost.endsWith('facebook.com') || normalizedHost === 'fb.com') && parsed.pathname === '/l.php') {
          return parsed.searchParams.get('u') || '';
        }
        return parsed.toString();
      } catch {
        return '';
      }
    })
    .filter((link, index, list) => {
      if (!link || list.indexOf(link) !== index) return false;
      try {
        const host = new URL(link).hostname.replace(/^www\./, '');
        return !blockedHosts.has(host);
      } catch {
        return false;
      }
    });

  return links;
}

function getCachedScrape<T>(cacheKey: string): (T & { cacheHit: true; cacheSource: 'server'; cachedAt: string }) | null {
  const entry = scrapeCache.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    scrapeCache.delete(cacheKey);
    return null;
  }

  return {
    ...entry.data,
    cacheHit: true,
    cacheSource: 'server',
    cachedAt: new Date(entry.cachedAt).toISOString(),
  };
}

function setCachedScrape(cacheKey: string, data: any) {
  const cachedAt = Date.now();
  scrapeCache.set(cacheKey, {
    data,
    cachedAt,
    expiresAt: cachedAt + SCRAPE_CACHE_TTL_MS,
  });
}

function maskApiKey(key: string) {
  return key.length <= 6 ? key : `...${key.slice(-6)}`;
}

function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
  }
  return `${totalMinutes} phút`;
}

function parseRapidApiKeys(rawKeys: string | string[] | undefined) {
  const joined = Array.isArray(rawKeys) ? rawKeys.join(',') : rawKeys || '';
  return [
    ...new Set(
      joined
        .split(/[\n,;]+/)
        .map((key) => key.trim())
        .filter((key) => key && key !== 'YOUR_RAPIDAPI_KEY'),
    ),
  ];
}

function getRapidApiKeyState(key: string) {
  let keyState = rapidApiKeyPool.get(key);
  if (!keyState) {
    keyState = {
      key,
      cooldownUntil: 0,
      lastUsedAt: 0,
      successCount: 0,
      failureCount: 0,
      quotaHitCount: 0,
    };
    rapidApiKeyPool.set(key, keyState);
  }
  return keyState;
}

function advanceRapidApiCursor(apiKeys: string[], key: string) {
  const currentIndex = apiKeys.indexOf(key);
  if (currentIndex !== -1) {
    rapidApiNextKeyIndex = (currentIndex + 1) % apiKeys.length;
  }
}

function markRapidApiSuccess(apiKeys: string[], key: string) {
  const keyState = getRapidApiKeyState(key);
  keyState.lastUsedAt = Date.now();
  keyState.successCount += 1;
  keyState.cooldownUntil = 0;
  advanceRapidApiCursor(apiKeys, key);
}

function markRapidApiFailure(apiKeys: string[], key: string) {
  const keyState = getRapidApiKeyState(key);
  keyState.lastUsedAt = Date.now();
  keyState.failureCount += 1;
  advanceRapidApiCursor(apiKeys, key);
}

function markRapidApiQuota(apiKeys: string[], key: string, retryAfterMs?: number | null) {
  const keyState = getRapidApiKeyState(key);
  keyState.lastUsedAt = Date.now();
  keyState.quotaHitCount += 1;
  keyState.cooldownUntil =
    Date.now() + (retryAfterMs && retryAfterMs > 0 ? retryAfterMs : RAPIDAPI_DEFAULT_COOLDOWN_MS);
  advanceRapidApiCursor(apiKeys, key);
}

function getRapidApiReadyKeys(apiKeys: string[]) {
  if (apiKeys.length === 0) return [];

  const now = Date.now();
  const startIndex = rapidApiNextKeyIndex % apiKeys.length;
  const rotatedKeys = [...apiKeys.slice(startIndex), ...apiKeys.slice(0, startIndex)];

  return rotatedKeys
    .map((key) => getRapidApiKeyState(key))
    .filter((keyState) => keyState.cooldownUntil <= now);
}

function getNextRapidApiReadyInMs(apiKeys: string[]) {
  const now = Date.now();
  const remainingTimes = apiKeys
    .map((key) => Math.max(0, getRapidApiKeyState(key).cooldownUntil - now))
    .filter((ms) => ms > 0);

  return remainingTimes.length > 0 ? Math.min(...remainingTimes) : 0;
}

function getRetryAfterMs(response: Response) {
  const retryAfterMs = response.headers.get('retry-after-ms');
  if (retryAfterMs) {
    const parsed = Number(retryAfterMs);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(retryAfter);
  if (!Number.isNaN(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }

  return null;
}

function isRapidApiQuotaExceeded(status: number, errorText: string) {
  return (
    status === 429 ||
    ((status === 403 || status === 400) &&
      /(quota|too many|rate limit|limit reached|request limit|exceed)/i.test(errorText))
  );
}

function isRapidApiRequestFailure<T>(result: RapidApiRequestResult<T>): result is RapidApiRequestFailure {
  return result.ok === false;
}

async function requestRapidApiJson<T = any>(apiPath: string, apiKey: string): Promise<RapidApiRequestResult<T>> {
  const response = await fetch(`https://${RAPIDAPI_HOST}${apiPath}`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });

  const rawText = await response.text();
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (response.ok) {
    return { ok: true, data: parsed as T };
  }

  const errorText =
    (typeof parsed?.message === 'string' && parsed.message) ||
    (typeof parsed?.error === 'string' && parsed.error) ||
    (typeof parsed?.status_message === 'string' && parsed.status_message) ||
    rawText.trim() ||
    `RapidAPI HTTP ${response.status}`;

  return {
    ok: false,
    status: response.status,
    error: errorText,
    quotaExceeded: isRapidApiQuotaExceeded(response.status, errorText),
    retryAfterMs: getRetryAfterMs(response),
  };
}

async function fetchTikTokMetricsFromRapidApi(
  username: string,
  apiKeys: string[],
  preferredKey?: string,
) {
  const partialWarnings: string[] = [];
  const keysInOrder = [
    ...(preferredKey ? [preferredKey] : []),
    ...getRapidApiReadyKeys(apiKeys).map((keyState) => keyState.key),
  ].filter((key, index, list) => Boolean(key) && list.indexOf(key) === index);

  for (const apiKey of keysInOrder) {
    try {
      const postsResult = await requestRapidApiJson<any>(
        `/user/posts?unique_id=${encodeURIComponent(username)}&count=15`,
        apiKey,
      );

      if (isRapidApiRequestFailure(postsResult)) {
        const failedPostsResult = postsResult;
        if (failedPostsResult.quotaExceeded) {
          markRapidApiQuota(apiKeys, apiKey, failedPostsResult.retryAfterMs);
          partialWarnings.push('Không lấy được TikTok video metrics vì key RapidAPI bị quota.');
          console.warn(
            `RapidAPI posts quota exceeded for key ${maskApiKey(apiKey)}, trying next key...`,
          );
          continue;
        }

        markRapidApiFailure(apiKeys, apiKey);
        partialWarnings.push('Không lấy được TikTok video metrics từ RapidAPI posts endpoint.');
        console.warn(
          `RapidAPI posts request failed for key ${maskApiKey(apiKey)}:`,
          failedPostsResult.error,
        );
        continue;
      }

      markRapidApiSuccess(apiKeys, apiKey);

      const postsData = postsResult.data;
      const videos: any[] = postsData?.data?.videos || postsData?.data || postsData?.videos || [];
      if (videos.length === 0) {
        return createEmptyTikTokMetrics();
      }

      const recentVideos = videos.slice(0, 15);
      const sortedVideos = [...recentVideos].sort((a: any, b: any) => {
        const viewsA = a.stats?.play_count || a.stats?.playCount || a.play_count || 0;
        const viewsB = b.stats?.play_count || b.stats?.playCount || b.play_count || 0;
        return viewsA - viewsB;
      });
      const targetVideos = sortedVideos.slice(0, 5);
      const videoCount = targetVideos.length;

      const totals = targetVideos.reduce(
        (acc: any, video: any) => {
          const stats = video.stats || video;
          return {
            views: acc.views + (stats.play_count || stats.playCount || video.play_count || 0),
            likes: acc.likes + (stats.digg_count || stats.diggCount || video.digg_count || 0),
            comments:
              acc.comments + (stats.comment_count || stats.commentCount || video.comment_count || 0),
            shares: acc.shares + (stats.share_count || stats.shareCount || video.share_count || 0),
            saves: acc.saves + (stats.collect_count || stats.collectCount || video.collect_count || 0),
          };
        },
        { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
      );

      return {
        averageView: videoCount > 0 ? Math.round(totals.views / videoCount) : 0,
        averageEngagement:
          videoCount > 0
            ? Math.round((totals.likes + totals.comments + totals.shares + totals.saves) / videoCount)
            : 0,
        totalLikes: totals.likes,
        totalComments: totals.comments,
        totalShares: totals.shares,
        totalSaves: totals.saves,
        videoCount,
      };
    } catch (error: any) {
      markRapidApiFailure(apiKeys, apiKey);
      partialWarnings.push('Không lấy được TikTok video metrics do lỗi request posts.');
      console.warn(`RapidAPI posts fetch crashed for key ${maskApiKey(apiKey)}:`, error.message);
    }
  }

  return createEmptyTikTokMetrics([
    ...new Set(partialWarnings.length > 0 ? partialWarnings : ['Không lấy được TikTok video metrics; vẫn giữ profile core.']),
  ]);
}

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

interface AIServerAnalysisResult {
  phone: string;
  email: string;
  bioLink: string;
  aiAnalysis: string;
}

async function runAIAnalysisServerSide(bio: string): Promise<AIServerAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const defaultResult = { phone: '', email: '', bioLink: '', aiAnalysis: '' };
  if (!apiKey || !bio || !bio.trim()) return defaultResult;

  let baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const prompt = `Bạn là chuyên gia phân tích dữ liệu profile mạng xã hội.
Hãy đọc kỹ phần Tiểu sử (Bio) sau đây và trích xuất thông tin liên hệ một cách chính xác nhất.

Nhiệm vụ:
1. Trích xuất Số điện thoại (Phone): Tìm số điện thoại (đặc biệt là Việt Nam, ví dụ bắt đầu bằng +84 hoặc 0). Giải mã các dạng viết ẩn ý như chữ thành số (không chín ba...), viết cách quãng (0 9 8...), hoặc ký tự đặc biệt. Định dạng kết quả về dạng chuỗi số liên tục (ví dụ: 0987654321). Nếu không có, điền "N/A".
2. Trích xuất Email: Tìm địa chỉ email. Giải mã các dạng chống bot như "name(at)gmail.com", "name[at]gmail.com", "name dot com". Định dạng về dạng email tiêu chuẩn (ví dụ: name@gmail.com). Nếu không có, điền "N/A".
3. Trích xuất Link Bio: Tìm các liên kết ngoài (website, linktree, locket, shoppe...). Nếu không có, điền "N/A".
4. Tóm tắt AI Analysis: Tóm tắt 1 câu cực kỳ ngắn gọn (tối đa 15 từ) về lĩnh vực chính (Niche) và tệp khán giả mục tiêu của kênh này.

Bạn BẮT BUỘC phải trả về kết quả dưới dạng một đối tượng JSON duy nhất có định dạng chính xác sau đây, không thêm bất kỳ chữ nào khác ngoài JSON:
{
  "phone": "Số điện thoại hoặc N/A",
  "email": "Email hoặc N/A",
  "bioLink": "Link hoặc N/A",
  "aiAnalysis": "Câu tóm tắt lĩnh vực & khán giả mục tiêu"
}

Bio để phân tích:
"""${bio}"""`;
    
    const response = await fetch(`${baseUrl}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 250,
      }),
    });

    if (!response.ok) return defaultResult;
    const resData: any = await response.json();
    const textResponse = resData?.choices?.[0]?.message?.content?.trim() || '';
    
    let cleaned = textResponse.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      const data = JSON.parse(cleaned);
      return {
        phone: data.phone && data.phone !== 'N/A' ? String(data.phone).trim() : '',
        email: data.email && data.email !== 'N/A' ? String(data.email).trim() : '',
        bioLink: data.bioLink && data.bioLink !== 'N/A' ? String(data.bioLink).trim() : '',
        aiAnalysis: data.aiAnalysis && data.aiAnalysis !== 'N/A' ? String(data.aiAnalysis).trim() : '',
      };
    } catch (e) {
      console.error("Failed to parse AI JSON response, falling back to raw text:", textResponse);
      return {
        phone: '',
        email: '',
        bioLink: '',
        aiAnalysis: textResponse.length < 100 ? textResponse : '',
      };
    }
  } catch (e) {
    console.error("Server-side AI analysis error:", e);
    return defaultResult;
  }
}

app.use(express.json({ limit: '10mb' }));

  // ============ TikTok Scrape API (RapidAPI Primary + HTML Fallback) ============
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url, fastMode = false, forceRefresh = false } = req.body;
      if (!url || !url.includes("tiktok.com")) {
        return res.status(400).json({ error: "Vui lòng nhập link TikTok hợp lệ" });
      }

      let fetchUrl = url.trim();
      if (!fetchUrl.startsWith('http')) fetchUrl = `https://${fetchUrl}`;
      const cacheKey = createScrapeCacheKey('tiktok', fetchUrl, fastMode ? 'fast' : 'full');
      const cachedResult = !forceRefresh ? getCachedScrape(cacheKey) : null;
      if (cachedResult) {
        return res.json(cachedResult);
      }

      // Extract username from URL
      const usernameMatch = fetchUrl.match(/@([^/?]+)/);
      const username = usernameMatch ? usernameMatch[1] : '';

      const headerRapidApiKeys = req.headers['x-rapidapi-key'];
      const apiKeys = parseRapidApiKeys(
        Array.isArray(headerRapidApiKeys) ? headerRapidApiKeys : headerRapidApiKeys || process.env.RAPIDAPI_KEY,
      );
      const canUsePuppeteerFallback =
        !isServerlessRuntime || process.env.ENABLE_SERVERLESS_PUPPETEER === 'true';
      const emptyMetrics = createEmptyTikTokMetrics();

      let rapidApiQuotaBlocked = false;
      let rapidApiNonQuotaError = false;

      // ====== METHOD 1: RapidAPI with Key Pool + Round Robin + Cooldown ======
      if (username && apiKeys.length > 0) {
        const readyKeys = getRapidApiReadyKeys(apiKeys);

        if (readyKeys.length === 0) {
          rapidApiQuotaBlocked = true;
          console.warn(
            `All RapidAPI keys are cooling down for @${username}. Next key ready in ${formatDurationMs(
              getNextRapidApiReadyInMs(apiKeys),
            )}.`,
          );
        } else {
          for (const keyState of readyKeys) {
            const rapidApiKey = keyState.key;
            try {
              const infoResult = await requestRapidApiJson<any>(
                `/user/info?unique_id=${encodeURIComponent(username)}`,
                rapidApiKey,
              );

              if (isRapidApiRequestFailure(infoResult)) {
                const failedInfoResult = infoResult;
                if (failedInfoResult.quotaExceeded) {
                  rapidApiQuotaBlocked = true;
                  markRapidApiQuota(apiKeys, rapidApiKey, failedInfoResult.retryAfterMs);
                  console.warn(
                    `RapidAPI info quota exceeded for key ${maskApiKey(rapidApiKey)}, trying next key...`,
                  );
                  continue;
                }

                rapidApiNonQuotaError = true;
                markRapidApiFailure(apiKeys, rapidApiKey);
                console.warn(
                  `RapidAPI info failed for key ${maskApiKey(rapidApiKey)}:`,
                  failedInfoResult.error,
                );
                continue;
              }

              const infoData = infoResult.data;
              const user = infoData?.data?.user || infoData?.user || {};
              const stats = infoData?.data?.stats || infoData?.stats || {};

              if (!(user.uniqueId || user.nickname)) {
                rapidApiNonQuotaError = true;
                markRapidApiFailure(apiKeys, rapidApiKey);
                console.warn(
                  `RapidAPI info returned empty user data for key ${maskApiKey(rapidApiKey)}.`,
                );
                continue;
              }

              markRapidApiSuccess(apiKeys, rapidApiKey);

              const metrics = fastMode
                ? emptyMetrics
                : await fetchTikTokMetricsFromRapidApi(username, apiKeys, rapidApiKey);

              const bio = user.signature || '';
              const aiResult = await runAIAnalysisServerSide(bio);
              const contact = normalizeContact({
                phone: user.phone || aiResult.phone,
                email: user.bioEmail || user.email || aiResult.email,
                bioLink: user.bioLink?.link || aiResult.bioLink,
                text: bio,
                source: user.phone || user.bioEmail || user.email || user.bioLink?.link ? 'api' : (aiResult.phone || aiResult.email || aiResult.bioLink ? 'ai' : 'api'),
              });
              console.log(
                `✓ RapidAPI success with key ${maskApiKey(rapidApiKey)} for @${username} (${fastMode ? 'fast' : 'full'} mode)`,
              );

              const payload = {
                bio,
                channelId: user.uniqueId || username,
                channelLink: `https://www.tiktok.com/@${user.uniqueId || username}`,
                following: stats.followingCount || stats.following_count || 0,
                followers: stats.followerCount || stats.follower_count || 0,
                likes: stats.heartCount || stats.heart_count || stats.heart || 0,
                profilePic: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
                nickname: user.nickname || '',
                bioLink: contact.bioLink,
                email: contact.email,
                phone: contact.phone,
                contactSource: contact.contactSource,
                contactWarnings: contact.contactWarnings,
                ...metrics,
                rapidApiMode: fastMode ? 'fast' : 'full',
                rapidApiKeyMask: maskApiKey(rapidApiKey),
                aiAnalysis: aiResult.aiAnalysis,
                cacheHit: false,
                scrapedAt: new Date().toISOString(),
              };
              setCachedScrape(cacheKey, payload);
              return res.json(payload);
            } catch (rapidErr: any) {
              rapidApiNonQuotaError = true;
              markRapidApiFailure(apiKeys, rapidApiKey);
              console.warn(`RapidAPI key ${maskApiKey(rapidApiKey)} crashed:`, rapidErr.message);
            }
          }
        }
      }

      if (rapidApiQuotaBlocked && !canUsePuppeteerFallback) {
        const waitMs = getNextRapidApiReadyInMs(apiKeys);
        const retryHint =
          waitMs > 0
            ? `Thử lại sau khoảng ${formatDurationMs(waitMs)} hoặc thêm key mới trong Cài đặt.`
            : 'Hãy thêm key mới trong Cài đặt để hệ thống tiếp tục xoay vòng.';

        return res.status(429).json({
          code: 'RAPIDAPI_ALL_KEYS_EXHAUSTED',
          error: `Tất cả RapidAPI key hiện đang hết quota hoặc trong thời gian cooldown. ${retryHint}`,
        });
      }

      if (!apiKeys.length && !canUsePuppeteerFallback) {
        return res.status(400).json({
          code: 'RAPIDAPI_KEYS_MISSING',
          error: 'Chưa cấu hình RapidAPI key cho môi trường serverless. Hãy thêm ít nhất 1 key trong Cài đặt.',
        });
      }

      if (apiKeys.length > 0) {
        console.warn('RapidAPI did not return usable data, falling back to Puppeteer Stealth');
      } else {
        console.warn('No RapidAPI key configured, trying Puppeteer Stealth fallback');
      }

      // ====== METHOD 2: Puppeteer Stealth Fallback ======
      if (canUsePuppeteerFallback) {
        try {
          const browser = await getStealthBrowser();
          const page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });
          await page.goto(fetchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 3000));

          const html = await page.content();
          await page.close();

          const $ = cheerio.load(html);
          const scriptContent = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
          if (scriptContent) {
            try {
              const data = JSON.parse(scriptContent);
              const userInfo = data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
              if (userInfo?.user && userInfo?.stats) {
                const user = userInfo.user;
                const stats = userInfo.stats;
                const bio = user.signature || '';
                const aiResult = await runAIAnalysisServerSide(bio);
                const contact = normalizeContact({
                  phone: user.phone || aiResult.phone,
                  email: user.bioEmail || aiResult.email,
                  bioLink: user.bioLink?.link || aiResult.bioLink,
                  text: bio,
                  source: user.phone || user.bioEmail || user.bioLink?.link ? 'fallback' : (aiResult.phone || aiResult.email || aiResult.bioLink ? 'ai' : 'fallback'),
                });
                const payload = {
                  bio,
                  channelId: user.uniqueId || '',
                  channelLink: `https://www.tiktok.com/@${user.uniqueId}`,
                  following: stats.followingCount || 0,
                  followers: stats.followerCount || 0,
                  likes: stats.heartCount || 0,
                  profilePic: user.avatarLarger || user.avatarMedium || '',
                  nickname: user.nickname || '',
                  bioLink: contact.bioLink,
                  email: contact.email,
                  phone: contact.phone,
                  contactSource: contact.contactSource,
                  contactWarnings: contact.contactWarnings,
                  ...emptyMetrics,
                  rapidApiMode: 'fallback',
                  partialWarnings: ['Dữ liệu lấy bằng fallback nên không có TikTok video metrics.'],
                  aiAnalysis: aiResult.aiAnalysis,
                  cacheHit: false,
                  scrapedAt: new Date().toISOString(),
                };
                setCachedScrape(cacheKey, payload);
                return res.json(payload);
              }
            } catch (e) {
              console.error("Puppeteer parse error:", e);
            }
          }
        } catch (puppeteerErr: any) {
          console.error("Puppeteer fallback error:", puppeteerErr.message);
        }
      }

      if (rapidApiQuotaBlocked) {
        const waitMs = getNextRapidApiReadyInMs(apiKeys);
        return res.status(429).json({
          code: 'RAPIDAPI_ALL_KEYS_EXHAUSTED',
          error:
            waitMs > 0
              ? `Tất cả RapidAPI key đã hết quota hoặc đang cooldown. Thử lại sau khoảng ${formatDurationMs(waitMs)}.`
              : 'Tất cả RapidAPI key đã hết quota hoặc không còn khả dụng.',
        });
      }

      if (!apiKeys.length) {
        return res.status(400).json({
          code: 'RAPIDAPI_KEYS_MISSING',
          error: "Chưa cấu hình RapidAPI key và fallback không lấy được dữ liệu TikTok.",
        });
      }

      if (rapidApiNonQuotaError && !canUsePuppeteerFallback) {
        return res.status(503).json({
          code: 'TIKTOK_SCRAPE_UNAVAILABLE',
          error: "RapidAPI không trả về dữ liệu hợp lệ và môi trường hiện tại không hỗ trợ Puppeteer fallback.",
        });
      }

      return res.status(404).json({
        code: 'TIKTOK_SCRAPE_FAILED',
        error: "Không thể trích xuất dữ liệu. RapidAPI không trả về dữ liệu hợp lệ và TikTok chặn truy cập trực tiếp.",
      });
    } catch (error: any) {
      console.error("Scrape error:", error.message);
      res.status(500).json({ error: "Lỗi khi lấy dữ liệu: " + error.message });
    }
  });



  // ============ Facebook Extract API ============
  app.post('/api/extract-facebook', async (req, res) => {
    try {
      const { url, forceRefresh = false } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      let fetchUrl = url.trim();
      if (!fetchUrl.startsWith('http')) fetchUrl = `https://${fetchUrl}`;
      
      try {
        fetchUrl = new URL(fetchUrl).toString();
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const cacheKey = createScrapeCacheKey('facebook', fetchUrl);
      const cachedResult = !forceRefresh ? getCachedScrape(cacheKey) : null;
      if (cachedResult) {
        return res.json(cachedResult);
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

      if (!response) {
        throw new Error("Không thể kết nối đến Facebook. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.");
      }

      const html = await response.text();
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

      const visibleText = getVisiblePageText($);
      const externalLinks = getFacebookExternalLinks($, fetchUrl);
      
      const aiResult = await runAIAnalysisServerSide(description || nickname || visibleText || '');
      
      const fbContact = normalizeContact({
        phone: aiResult.phone,
        email: aiResult.email,
        bioLink: externalLinks[0] || aiResult.bioLink,
        text: [nickname, title, description, visibleText].filter(Boolean).join(' '),
        source: aiResult.phone || aiResult.email ? 'ai' : 'regex',
      });

      const payload = {
        title,
        description,
        profilePic,
        nickname,
        followers,
        url: fetchUrl,
        phone: fbContact.phone,
        email: fbContact.email,
        bioLink: fbContact.bioLink,
        contactSource: fbContact.contactSource,
        contactWarnings: fbContact.contactWarnings,
        aiAnalysis: aiResult.aiAnalysis,
        cacheHit: false,
        scrapedAt: new Date().toISOString(),
      };
      setCachedScrape(cacheKey, payload);
      return res.json(payload);
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
    const vitePkg = "vite";
    import(vitePkg).then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then(vite => {
        app.use(vite.middlewares);
      });
    });
  } else {
    // Serve static files from the React app
    app.use(express.static(path.join(currentDirname, "dist")));
    
    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    app.get('*', (req, res) => {
      res.sendFile(path.join(currentDirname, "dist", "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else if (!isServerlessRuntime) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production server running on http://localhost:${PORT}`);
    });
  }

export default app;
