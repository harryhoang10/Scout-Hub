import { RestoredData } from '../types';
import { hydrateRestoredProfile, normalizeProfileUrl } from './profileChangeDetection';

export type DuplicateGroup = {
  id: string;
  reason: string;
  profiles: RestoredData[];
};

const NICHE_RULES: Array<{ niche: string; audience: string; keywords: string[] }> = [
  { niche: 'Beauty', audience: 'Beauty shoppers / skincare & makeup interest', keywords: ['beauty', 'makeup', 'skincare', 'cosmetic', 'spa', 'salon', 'làm đẹp', 'mỹ phẩm', 'trang điểm', 'chăm sóc da'] },
  { niche: 'Fashion', audience: 'Fashion shoppers / style-conscious audience', keywords: ['fashion', 'style', 'outfit', 'clothing', 'thời trang', 'phối đồ', 'quần áo', 'local brand'] },
  { niche: 'Food', audience: 'Food lovers / dining & recipe audience', keywords: ['food', 'eat', 'recipe', 'restaurant', 'cooking', 'ăn uống', 'món ngon', 'nấu ăn', 'review quán'] },
  { niche: 'Tech', audience: 'Tech buyers / gadget & software users', keywords: ['tech', 'gadget', 'software', 'ai', 'laptop', 'phone', 'công nghệ', 'điện thoại'] },
  { niche: 'Education', audience: 'Students / learning & career audience', keywords: ['education', 'learn', 'study', 'teacher', 'english', 'học', 'giáo dục', 'tiếng anh', 'du học'] },
  { niche: 'Entertainment', audience: 'Mass entertainment audience', keywords: ['comedy', 'music', 'dance', 'movie', 'giải trí', 'hài', 'nhạc', 'phim', 'diễn viên'] },
  { niche: 'Lifestyle', audience: 'Lifestyle and daily inspiration audience', keywords: ['lifestyle', 'daily', 'vlog', 'life', 'sống', 'đời sống', 'truyền cảm hứng'] },
  { niche: 'Travel', audience: 'Travel planners / destination seekers', keywords: ['travel', 'hotel', 'trip', 'tour', 'du lịch', 'khách sạn', 'checkin'] },
  { niche: 'Health', audience: 'Health-conscious / wellness audience', keywords: ['health', 'fitness', 'gym', 'yoga', 'wellness', 'sức khỏe', 'giảm cân', 'tập luyện'] },
  { niche: 'Sports', audience: 'Sports fans / active lifestyle audience', keywords: ['sport', 'football', 'running', 'basketball', 'thể thao', 'bóng đá', 'chạy bộ'] },
  { niche: 'Finance', audience: 'Finance learners / money management audience', keywords: ['finance', 'invest', 'money', 'crypto', 'stock', 'tài chính', 'đầu tư', 'chứng khoán'] },
  { niche: 'Gaming', audience: 'Gamers / livestream viewers', keywords: ['game', 'gaming', 'gamer', 'streamer', 'liên quân', 'free fire', 'pubg'] },
  { niche: 'Parenting', audience: 'Parents / family-care audience', keywords: ['mom', 'baby', 'family', 'parenting', 'mẹ và bé', 'gia đình', 'nuôi con'] },
];

function isUsable(value: string | number | undefined) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return Boolean(normalized) && !['n/a', 'na', '-', 'none', 'null', 'undefined'].includes(normalized);
}

function normalizeText(value: string | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractHandle(profile: Partial<RestoredData>) {
  if (isUsable(profile.channelId)) return String(profile.channelId).replace(/^@/, '').toLowerCase();
  const url = profile.url || '';
  const tiktok = url.match(/tiktok\.com\/@([^/?#]+)/i);
  if (tiktok?.[1]) return tiktok[1].toLowerCase();
  const facebook = url.match(/(?:facebook|fb)\.com\/([^/?#]+)/i);
  if (facebook?.[1] && !['profile.php', 'groups', 'watch', 'share'].includes(facebook[1].toLowerCase())) return facebook[1].toLowerCase();
  return '';
}

export function classifyProfile(profile: Partial<RestoredData>) {
  const text = normalizeText([
    profile.nickname,
    profile.channelId,
    profile.bio,
    ...(profile.group || []),
  ].filter(Boolean).join(' '));

  let best = { niche: profile.profileNiche || 'Unclassified', audience: profile.audienceHint || 'Needs manual review', matches: 0 };
  NICHE_RULES.forEach(rule => {
    const matches = rule.keywords.filter(keyword => text.includes(normalizeText(keyword))).length;
    if (matches > best.matches) best = { niche: rule.niche, audience: rule.audience, matches };
  });

  if (best.matches === 0 && profile.profileType === 'Community') {
    best = { niche: 'Community', audience: 'Community members / group audience', matches: 1 };
  }

  return {
    profileNiche: best.niche,
    audienceHint: best.audience,
    classificationConfidence: best.matches > 0 ? Math.min(0.95, 0.45 + best.matches * 0.2) : 0.2,
  };
}

function duplicateKeys(profile: RestoredData) {
  const keys: Array<{ key: string; reason: string }> = [];
  const url = normalizeProfileUrl(profile.url);
  const handle = extractHandle(profile);
  const name = normalizeText(profile.nickname);

  if (url) keys.push({ key: `url:${url}`, reason: 'Trùng URL sau normalize' });
  if (handle) keys.push({ key: `handle:${profile.platform || 'Any'}:${handle}`, reason: 'Trùng handle/channel ID' });
  if (isUsable(profile.email)) keys.push({ key: `email:${String(profile.email).toLowerCase()}`, reason: 'Trùng email' });
  if (isUsable(profile.phone)) keys.push({ key: `phone:${String(profile.phone).replace(/\D/g, '')}`, reason: 'Trùng SĐT' });
  if (isUsable(profile.bioLink)) keys.push({ key: `bio:${normalizeProfileUrl(profile.bioLink)}`, reason: 'Trùng bio link' });
  if (name.length >= 5) keys.push({ key: `name:${profile.platform || 'Any'}:${name}`, reason: 'Tên giống nhau trên cùng platform' });

  return keys;
}

export function findDuplicateGroups(data: RestoredData[]): DuplicateGroup[] {
  const hydrated = data.map(hydrateRestoredProfile);
  const buckets = new Map<string, { reason: string; ids: Set<string> }>();
  const byId = new Map(hydrated.map(profile => [profile.id, profile]));

  hydrated.forEach(profile => {
    duplicateKeys(profile).forEach(({ key, reason }) => {
      if (!buckets.has(key)) buckets.set(key, { reason, ids: new Set() });
      buckets.get(key)?.ids.add(profile.id);
    });
  });

  const seenSignatures = new Set<string>();
  return Array.from(buckets.entries()).reduce<DuplicateGroup[]>((groups, [key, bucket]) => {
    if (bucket.ids.size < 2) return groups;
    const ids = Array.from(bucket.ids).sort();
    const signature = ids.join('|');
    if (seenSignatures.has(signature)) return groups;
    seenSignatures.add(signature);

    groups.push({
      id: key,
      reason: bucket.reason,
      profiles: ids.map(id => byId.get(id)).filter(Boolean) as RestoredData[],
    });
    return groups;
  }, []);
}

function uniqueArray<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function profileScore(profile: RestoredData) {
  return [
    profile.notes?.length || 0,
    profile.tier?.length || 0,
    profile.location?.length || 0,
    profile.group?.length || 0,
    profile.campaign?.length || 0,
    profile.sow?.length || 0,
    profile.rateHistory?.length || 0,
    profile.rating || 0,
    profile.isWatchlisted ? 2 : 0,
    isUsable(profile.phone) ? 1 : 0,
    isUsable(profile.email) ? 1 : 0,
    isUsable(profile.bioLink) ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function prefer<T>(values: Array<T | undefined>, fallback: T | undefined = undefined) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== 'N/A') ?? fallback;
}

export function mergeDuplicateGroup(data: RestoredData[], ids: string[]) {
  const idSet = new Set(ids);
  const group = data.filter(profile => idSet.has(profile.id)).map(hydrateRestoredProfile);
  if (group.length < 2) return data;

  const primary = [...group].sort((a, b) => profileScore(b) - profileScore(a))[0];
  const merged: RestoredData = {
    ...primary,
    url: prefer(group.map(row => row.url), primary.url) || primary.url,
    nickname: prefer(group.map(row => row.nickname), primary.nickname),
    channelId: prefer(group.map(row => row.channelId), primary.channelId),
    followers: prefer(group.map(row => row.followers), primary.followers),
    averageView: Math.max(...group.map(row => row.averageView || 0)),
    averageEngagement: Math.max(...group.map(row => row.averageEngagement || 0)),
    phone: prefer(group.map(row => row.phone), primary.phone),
    email: prefer(group.map(row => row.email), primary.email),
    bioLink: prefer(group.map(row => row.bioLink), primary.bioLink),
    bio: prefer(group.map(row => row.bio), primary.bio),
    profilePic: prefer(group.map(row => row.profilePic), primary.profilePic),
    tier: uniqueArray(group.flatMap(row => row.tier || [])),
    location: uniqueArray(group.flatMap(row => row.location || [])),
    group: uniqueArray(group.flatMap(row => row.group || [])),
    campaign: uniqueArray(group.flatMap(row => row.campaign || [])),
    sow: uniqueArray(group.flatMap(row => row.sow || [])),
    notes: uniqueArray(group.flatMap(row => row.notes || []).map(note => JSON.stringify(note))).map(raw => JSON.parse(raw)),
    rateHistory: uniqueArray(group.flatMap(row => row.rateHistory || []).map(rate => JSON.stringify(rate))).map(raw => JSON.parse(raw)),
    rating: Math.max(...group.map(row => row.rating || 0)),
    workflowStatus: primary.workflowStatus || 'New',
    isWatchlisted: group.some(row => row.isWatchlisted),
    watchlistedAt: prefer(group.map(row => row.watchlistedAt), primary.watchlistedAt),
    changeHistory: group.flatMap(row => row.changeHistory || []).slice(0, 20),
  };

  const classified = classifyProfile(merged);
  merged.profileNiche = classified.profileNiche;
  merged.audienceHint = classified.audienceHint;
  merged.classificationConfidence = classified.classificationConfidence;

  return data.filter(profile => !idSet.has(profile.id) || profile.id === primary.id).map(profile => (
    profile.id === primary.id ? merged : profile
  ));
}
