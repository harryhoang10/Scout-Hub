import { ProfileChangeRecord, ProfileFieldChange, RestoredData, Tier } from '../types';

type ChangeSource = ProfileChangeRecord['source'];

const MAX_CHANGE_RECORDS = 20;

const COMPARED_FIELDS: Array<{ field: keyof RestoredData; label: string; metric?: boolean }> = [
  { field: 'nickname', label: 'Tên' },
  { field: 'channelId', label: 'ID' },
  { field: 'followers', label: 'Followers', metric: true },
  { field: 'phone', label: 'SĐT' },
  { field: 'email', label: 'Email' },
  { field: 'bioLink', label: 'Link Bio' },
  { field: 'bio', label: 'Bio' },
  { field: 'averageView', label: 'Avg View', metric: true },
  { field: 'averageEngagement', label: 'Avg Engage', metric: true },
  { field: 'profilePic', label: 'Ảnh đại diện' },
];

const MANUAL_FIELDS: Array<keyof RestoredData> = [
  'tier',
  'location',
  'group',
  'campaign',
  'sow',
  'notes',
  'rateHistory',
  'rating',
  'saveDate',
  'workflowStatus',
  'isWatchlisted',
  'watchlistedAt',
  'changeHistory',
  'lastChangedAt',
];

function createId() {
  return Math.random().toString(36).substring(7);
}

function toArray<T>(value: T[] | undefined, fallback: T[] = []) {
  return Array.isArray(value) ? value : fallback;
}

function formatDateForSave(date = new Date()) {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

export function normalizeProfileUrl(url: string | undefined) {
  if (!url) return '';

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

function normalizeEmpty(value: unknown) {
  if (value === undefined || value === null) return '';
  const normalized = String(value).trim();
  return ['n/a', 'na', '-', 'null', 'undefined'].includes(normalized.toLowerCase()) ? '' : normalized;
}

function parseMetric(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = normalizeEmpty(value).toLowerCase().replace(/\s+/g, '');
  if (!raw) return 0;

  let multiplier = 1;
  if (raw.includes('triệu') || raw.endsWith('m')) multiplier = 1_000_000;
  else if (raw.includes('nghìn') || raw.includes('ngàn') || raw.endsWith('k')) multiplier = 1_000;

  const numericText = raw.replace(/[^0-9.,]/g, '');
  if (!numericText) return 0;

  let normalized = numericText;
  if (numericText.includes(',') && numericText.includes('.')) {
    normalized = numericText.replace(/,/g, '');
  } else if (numericText.includes(',') && !numericText.includes('.')) {
    const parts = numericText.split(',');
    normalized = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : numericText.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function valuesMatch(oldValue: unknown, newValue: unknown, metric = false) {
  if (metric) return parseMetric(oldValue) === parseMetric(newValue);
  return normalizeEmpty(oldValue).toLowerCase() === normalizeEmpty(newValue).toLowerCase();
}

function displayValue(value: unknown, metric = false): string | number | null {
  if (metric) {
    const parsed = parseMetric(value);
    return parsed > 0 ? parsed : null;
  }

  const normalized = normalizeEmpty(value);
  return normalized || null;
}

export function hydrateRestoredProfile(profile: Partial<RestoredData>): RestoredData {
  return {
    id: profile.id || createId(),
    url: profile.url || '',
    status: profile.status || 'success',
    errorMsg: profile.errorMsg,
    errorCode: profile.errorCode,
    errorCategory: profile.errorCategory,
    retryCount: profile.retryCount,
    lastAttemptAt: profile.lastAttemptAt,
    nickname: profile.nickname || '',
    channelId: profile.channelId || '',
    followers: profile.followers || '',
    following: profile.following,
    likes: profile.likes,
    bio: profile.bio || '',
    profilePic: profile.profilePic || '',
    phone: profile.phone || '',
    email: profile.email || '',
    bioLink: profile.bioLink || '',
    contactSource: profile.contactSource,
    contactWarnings: toArray(profile.contactWarnings),
    platform: profile.platform || 'TikTok',
    profileType: profile.profileType || 'Individual',
    averageView: Number(profile.averageView) || 0,
    averageEngagement: Number(profile.averageEngagement) || 0,
    totalLikes: profile.totalLikes,
    totalComments: profile.totalComments,
    totalShares: profile.totalShares,
    totalSaves: profile.totalSaves,
    videoCount: profile.videoCount,
    aiAnalysis: profile.aiAnalysis,
    cacheHit: profile.cacheHit,
    cacheSource: profile.cacheSource,
    cachedAt: profile.cachedAt,
    scrapedAt: profile.scrapedAt,
    partialWarnings: toArray(profile.partialWarnings),
    tier: toArray<Tier>(profile.tier),
    location: toArray(profile.location),
    group: toArray(profile.group),
    campaign: toArray(profile.campaign),
    sow: toArray(profile.sow),
    notes: toArray(profile.notes),
    rateHistory: toArray(profile.rateHistory),
    rating: Number(profile.rating) || 0,
    saveDate: profile.saveDate || formatDateForSave(),
    workflowStatus: profile.workflowStatus || 'New',
    lastUpdated: profile.lastUpdated,
    isWatchlisted: Boolean(profile.isWatchlisted),
    watchlistedAt: profile.watchlistedAt,
    lastReviewedAt: profile.lastReviewedAt,
    lastChangedAt: profile.lastChangedAt,
    changeHistory: toArray(profile.changeHistory),
  };
}

export function detectProfileChanges(existing: RestoredData, incoming: Partial<RestoredData>): ProfileFieldChange[] {
  return COMPARED_FIELDS.reduce<ProfileFieldChange[]>((changes, item) => {
    const oldValue = existing[item.field];
    const newValue = incoming[item.field];
    if (newValue === undefined || valuesMatch(oldValue, newValue, item.metric)) return changes;

    changes.push({
      field: String(item.field),
      label: item.label,
      oldValue: displayValue(oldValue, item.metric),
      newValue: displayValue(newValue, item.metric),
    });
    return changes;
  }, []);
}

function mergeProfile(existing: RestoredData, incoming: Partial<RestoredData>, source: ChangeSource, detectedAt: string): RestoredData {
  const changes = detectProfileChanges(existing, incoming);
  const hydratedIncoming = hydrateRestoredProfile({ ...existing, ...incoming, id: existing.id });
  const merged: RestoredData = {
    ...existing,
    ...hydratedIncoming,
    id: existing.id,
    url: existing.url || hydratedIncoming.url,
    lastUpdated: detectedAt,
    lastReviewedAt: detectedAt,
  };

  MANUAL_FIELDS.forEach((field) => {
    (merged as any)[field] = existing[field];
  });

  if (changes.length > 0) {
    const record: ProfileChangeRecord = {
      id: createId(),
      detectedAt,
      source,
      changes,
    };
    merged.lastChangedAt = detectedAt;
    merged.changeHistory = [record, ...(existing.changeHistory || [])].slice(0, MAX_CHANGE_RECORDS);
  }

  return merged;
}

export function mergeProfileBatch(
  existingProfiles: RestoredData[],
  incomingProfiles: Partial<RestoredData>[],
  source: ChangeSource,
) {
  const detectedAt = new Date().toISOString();
  const mergedProfiles = existingProfiles.map(hydrateRestoredProfile);
  const indexByUrl = new Map<string, number>();
  mergedProfiles.forEach((profile, index) => {
    const key = normalizeProfileUrl(profile.url);
    if (key) indexByUrl.set(key, index);
  });

  const stats = { added: 0, updated: 0, changed: 0 };

  incomingProfiles.forEach((incoming) => {
    const key = normalizeProfileUrl(incoming.url);
    if (!key) return;

    const existingIndex = indexByUrl.get(key);
    if (existingIndex === undefined) {
      const hydrated = hydrateRestoredProfile({
        ...incoming,
        lastUpdated: detectedAt,
      });
      mergedProfiles.push(hydrated);
      indexByUrl.set(key, mergedProfiles.length - 1);
      stats.added += 1;
      return;
    }

    const existing = mergedProfiles[existingIndex];
    const changes = detectProfileChanges(existing, incoming);
    mergedProfiles[existingIndex] = mergeProfile(existing, incoming, source, detectedAt);
    stats.updated += 1;
    if (changes.length > 0) stats.changed += 1;
  });

  return { data: mergedProfiles, stats };
}
