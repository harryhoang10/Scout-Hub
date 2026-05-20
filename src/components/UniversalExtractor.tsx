import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileDown, Trash2, Link as LinkIcon, Globe, Play, Save, CheckCircle, AlertCircle, Loader2, Send, RotateCcw, RefreshCw, Filter, Bookmark, X, Star } from 'lucide-react';
import { ProfileData, RestoredData, Tier } from '../types';
import * as XLSX from 'xlsx';
import { upsertToSheet } from '../lib/api';
import { normalizeContact } from '../lib/contactParser';


interface UniversalExtractorProps {
  onSaveToRestored: (data: RestoredData[]) => void;
  webhookUrl?: string;
  theme?: string;
  prefillRequest?: {
    id: string;
    urls: string[];
    forceRefresh?: boolean;
  } | null;
}

const PROFILE_CACHE_VERSION = 'v3-contact-evidence';
const PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EXTRACTOR_QUEUE_STORAGE_KEY = 'scout_hub_extractor_queue_v1';
const SAVED_EXTRACTOR_VIEWS_STORAGE_KEY = 'scout_hub_saved_extractor_views_v1';
const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 2500;

type ProcessMode = 'pending' | 'errors';
type ErrorCategory = NonNullable<ProfileData['errorCategory']>;
type PriorityViewId = 'all' | 'hot' | 'need_review' | 'missing_contact' | 'errors' | 'pending';
type PlatformFilter = 'All' | 'TikTok' | 'Facebook';
type StatusFilter = 'All' | ProfileData['status'];
type ContactFilter = 'All' | 'has_contact' | 'missing_contact' | 'phone' | 'email' | 'bio_link';
type ExtractorFilters = {
  priorityView: PriorityViewId;
  platform: PlatformFilter;
  status: StatusFilter;
  contact: ContactFilter;
  minFollowers: string;
  query: string;
};
type SavedExtractorView = {
  id: string;
  name: string;
  filters: ExtractorFilters;
  createdAt: string;
};
type BatchMonitor = {
  runId: string;
  mode: ProcessMode;
  status: 'running' | 'paused' | 'completed';
  startedAt: string;
  finishedAt?: string;
  total: number;
  attempted: number;
  succeeded: number;
  failed: number;
  cached: number;
  partial: number;
  autoRetried: number;
  currentBatch: number;
  totalBatches: number;
  pauseReason?: string;
};

const DEFAULT_EXTRACTOR_FILTERS: ExtractorFilters = {
  priorityView: 'all',
  platform: 'All',
  status: 'All',
  contact: 'All',
  minFollowers: '',
  query: '',
};

const PRIORITY_VIEW_COPY: Record<PriorityViewId, { label: string; description: string }> = {
  all: { label: 'Tất cả', description: 'Toàn bộ queue hiện tại' },
  hot: { label: 'Hot', description: 'Có contact + metric mạnh' },
  need_review: { label: 'Need review', description: 'Có cảnh báo hoặc thiếu field quan trọng' },
  missing_contact: { label: 'Missing contact', description: 'Chưa có phone/email/bio link usable' },
  errors: { label: 'Errors', description: 'Các link đang lỗi để retry' },
  pending: { label: 'Pending', description: 'Link chờ xử lý hoặc đang chạy' },
};

// Detect platform from URL
function detectPlatform(url: string): 'TikTok' | 'Facebook' | null {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'Facebook';
  return null;
}

function parseRapidApiKeyPool(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,;]+/)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ];
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

function createProfileCacheKey(platform: 'TikTok' | 'Facebook', url: string, variant = 'default') {
  return `scout_hub_profile_cache:${PROFILE_CACHE_VERSION}:${platform}:${variant}:${normalizeCacheUrl(url)}`;
}

function getCachedProfile(cacheKey: string): Partial<ProfileData> | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { data?: Partial<ProfileData>; cachedAt?: number; expiresAt?: number };
    if (!parsed.data || !parsed.cachedAt || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return {
      ...parsed.data,
      cacheHit: true,
      cacheSource: 'client',
      cachedAt: new Date(parsed.cachedAt).toISOString(),
    };
  } catch {
    localStorage.removeItem(cacheKey);
    return null;
  }
}

function setCachedProfile(cacheKey: string, data: Partial<ProfileData>) {
  try {
    const cachedAt = Date.now();
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data,
        cachedAt,
        expiresAt: cachedAt + PROFILE_CACHE_TTL_MS,
      }),
    );
  } catch {
    // Ignore storage quota/private mode errors; live scraping should still work.
  }
}

function restoreExtractorQueue() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(EXTRACTOR_QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row): row is ProfileData => Boolean(row?.id && row?.url))
      .map((row) => ({
        ...row,
        status: row.status === 'processing' ? 'pending' : row.status,
        errorMsg: row.status === 'processing' ? 'Phiên trước bị ngắt, đã đưa về hàng chờ.' : row.errorMsg,
      }));
  } catch {
    return [];
  }
}

function restoreSavedExtractorViews(): SavedExtractorView[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(SAVED_EXTRACTOR_VIEWS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((view): view is SavedExtractorView => Boolean(view?.id && view?.name && view?.filters))
      .map((view) => ({
        ...view,
        filters: {
          ...DEFAULT_EXTRACTOR_FILTERS,
          ...view.filters,
        },
      }));
  } catch {
    return [];
  }
}

function classifyExtractorError(error: Error & { code?: string }): ErrorCategory {
  const code = error.code || '';
  const message = error.message || '';
  const text = `${code} ${message}`.toLowerCase();

  if (code === 'RAPIDAPI_ALL_KEYS_EXHAUSTED' || code === 'RAPIDAPI_KEYS_MISSING' || /quota|429|cooldown|rapidapi key/.test(text)) {
    return 'quota';
  }
  if (/invalid|không hợp lệ|url is required|vui lòng nhập link/.test(text)) {
    return 'invalid';
  }
  if (/blocked|403|503|unavailable|chặn/.test(text)) {
    return 'blocked';
  }
  if (/network|failed to fetch|timeout|timed out|econn|socket/.test(text)) {
    return 'network';
  }
  return 'unknown';
}

function shouldAutoRetry(category: ErrorCategory) {
  return category === 'network' || category === 'blocked' || category === 'unknown';
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isUsableValue(value: string | number | undefined): boolean {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return Boolean(normalized) && !['n/a', 'na', '-', 'none', 'null', 'undefined'].includes(normalized);
}

function parseMetricValue(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  if (!raw || raw === 'n/a' || raw === '-') return 0;

  let multiplier = 1;
  if (raw.includes('triệu') || raw.endsWith('m')) multiplier = 1_000_000;
  else if (raw.includes('nghìn') || raw.includes('ngàn') || raw.endsWith('k')) multiplier = 1_000;

  const numericText = raw.replace(/[^0-9.,]/g, '');
  if (!numericText) return 0;

  let normalized = numericText;
  if (numericText.includes(',') && numericText.includes('.')) {
    normalized = numericText.replace(/,/g, '');
  } else if (numericText.includes(',') && !numericText.includes('.')) {
    const commaParts = numericText.split(',');
    normalized = commaParts.length === 2 && commaParts[1].length <= 2
      ? `${commaParts[0]}.${commaParts[1]}`
      : numericText.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function hasAnyContact(profile: ProfileData): boolean {
  return isUsableValue(profile.phone) || isUsableValue(profile.email) || isUsableValue(profile.bioLink);
}

function needsReview(profile: ProfileData): boolean {
  if (profile.status !== 'success') return false;
  return Boolean(
    (profile.partialWarnings && profile.partialWarnings.length > 0) ||
    (profile.contactWarnings && profile.contactWarnings.length > 0) ||
    !isUsableValue(profile.nickname) ||
    !isUsableValue(profile.followers),
  );
}

function isHotPriority(profile: ProfileData): boolean {
  if (profile.status !== 'success' || !hasAnyContact(profile)) return false;
  return parseMetricValue(profile.followers) >= 100_000 ||
    (profile.averageView || 0) >= 10_000 ||
    (profile.averageEngagement || 0) >= 1_000;
}

function matchesPriorityView(profile: ProfileData, priorityView: PriorityViewId): boolean {
  if (priorityView === 'all') return true;
  if (priorityView === 'hot') return isHotPriority(profile);
  if (priorityView === 'need_review') return needsReview(profile);
  if (priorityView === 'missing_contact') return profile.status === 'success' && !hasAnyContact(profile);
  if (priorityView === 'errors') return profile.status === 'error';
  if (priorityView === 'pending') return profile.status === 'pending' || profile.status === 'processing';
  return true;
}

function matchesExtractorFilters(profile: ProfileData, filters: ExtractorFilters): boolean {
  if (!matchesPriorityView(profile, filters.priorityView)) return false;
  if (filters.platform !== 'All' && profile.platform !== filters.platform) return false;
  if (filters.status !== 'All' && profile.status !== filters.status) return false;

  if (filters.contact === 'has_contact' && !hasAnyContact(profile)) return false;
  if (filters.contact === 'missing_contact' && hasAnyContact(profile)) return false;
  if (filters.contact === 'phone' && !isUsableValue(profile.phone)) return false;
  if (filters.contact === 'email' && !isUsableValue(profile.email)) return false;
  if (filters.contact === 'bio_link' && !isUsableValue(profile.bioLink)) return false;

  const minFollowers = parseMetricValue(filters.minFollowers);
  if (minFollowers > 0 && parseMetricValue(profile.followers) < minFollowers) return false;

  const query = filters.query.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    profile.nickname,
    profile.channelId,
    profile.url,
    profile.bio,
    profile.phone,
    profile.email,
    profile.bioLink,
    profile.platform,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(query);
}

// Format followers
function formatFollowers(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '' || val === 'N/A') return '';
  if (typeof val === 'number') {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return val.toString();
  }
  const num = parseFloat(val.toString().replace(/,/g, ''));
  if (!isNaN(num)) {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  }
  let strVal = val.toString().toLowerCase().trim();
  let multiplier = 1;
  if (strVal.includes('triệu') || strVal.endsWith('m')) multiplier = 1_000_000;
  else if (strVal.includes('nghìn') || strVal.includes('ngàn') || strVal.endsWith('k')) multiplier = 1_000;
  const numStr = strVal.replace(/[^0-9.,]/g, '').replace(',', '.');
  const parsed = parseFloat(numStr) * multiplier;
  if (isNaN(parsed)) return val.toString();
  if (parsed >= 1_000_000) return (parsed / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (parsed >= 1_000) return (parsed / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return parsed.toString();
}

function roundView(val: number | undefined): number {
  if (!val) return 0;
  if (val >= 10000) return Math.round(val / 5000) * 5000;
  return Math.round(val / 1000) * 1000;
}

function roundEngagement(val: number | undefined): number {
  if (!val) return 0;
  if (val < 200) return 0;
  const rounded = Math.round(val / 500) * 500;
  return rounded === 0 ? 500 : rounded;
}

function formatView(val: number | undefined): string {
  if (!val) return '-';
  return roundView(val).toString();
}

function formatEngagement(val: number | undefined): string {
  if (!val) return '-';
  return roundEngagement(val).toString();
}

export function UniversalExtractor({ onSaveToRestored, webhookUrl, theme, prefillRequest }: UniversalExtractorProps) {
  const [links, setLinks] = useState<ProfileData[]>(() => restoreExtractorQueue());
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [fastMode, setFastMode] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [batchMonitor, setBatchMonitor] = useState<BatchMonitor | null>(null);
  const [filters, setFilters] = useState<ExtractorFilters>(DEFAULT_EXTRACTOR_FILTERS);
  const [savedViews, setSavedViews] = useState<SavedExtractorView[]>(() => restoreSavedExtractorViews());
  const [savedViewName, setSavedViewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledPrefillRequestRef = useRef<string | null>(null);
  const MAX_LINKS = 1000;
  const PARALLEL_COUNT = 3; // Process 3 profiles simultaneously
  
  // API keys stay in browser storage so they are not bundled into the client build.
  const RAPIDAPI_KEY = localStorage.getItem('scout_hub_rapidapi_key') || '';
  const rapidApiKeyPool = parseRapidApiKeyPool(RAPIDAPI_KEY);
  const rapidApiKeyHeader = rapidApiKeyPool.join(',');

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';
  const inputBg = isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const tableBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const rowHover = isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const dropBg = isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200';
  const tagBg = isDark ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-700';
  const btnPrimary = 'bg-violet-600 text-white hover:bg-violet-700';
  const btnOutline = isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50';

  useEffect(() => {
    try {
      const queueToPersist = links.map(link => ({
        ...link,
        status: link.status === 'processing' ? 'pending' : link.status,
      }));
      localStorage.setItem(EXTRACTOR_QUEUE_STORAGE_KEY, JSON.stringify(queueToPersist));
    } catch {
      // Queue persistence is best-effort; extraction should keep working without it.
    }
  }, [links]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_EXTRACTOR_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
    } catch {
      // Saved views are a UX helper only; keep the extractor usable even if storage fails.
    }
  }, [savedViews]);

  const addLinks = useCallback((urls: string[]) => {
    const validUrls = urls
      .map(u => u.trim())
      .filter(u => u && detectPlatform(u))
      .filter(u => !links.some(l => l.url === u));
    
    const remaining = MAX_LINKS - links.length;
    const toAdd = validUrls.slice(0, remaining);
    
    const newLinks: ProfileData[] = toAdd.map(url => ({
      id: Math.random().toString(36).substring(7),
      url,
      status: 'pending',
      retryCount: 0,
      platform: detectPlatform(url) || 'TikTok',
    }));
    
    setLinks(prev => [...prev, ...newLinks]);
    setManualInput('');
  }, [links]);

  useEffect(() => {
    if (!prefillRequest || handledPrefillRequestRef.current === prefillRequest.id) return;

    handledPrefillRequestRef.current = prefillRequest.id;
    if (prefillRequest.forceRefresh) setForceRefresh(true);
    addLinks(prefillRequest.urls);
  }, [addLinks, prefillRequest]);

  const updateFilters = (patch: Partial<ExtractorFilters>) => {
    setFilters(current => ({ ...current, ...patch }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_EXTRACTOR_FILTERS);
  };

  const saveCurrentView = () => {
    const now = new Date();
    const fallbackName = `${PRIORITY_VIEW_COPY[filters.priorityView].label} ${now.toLocaleDateString('vi-VN')}`;
    const name = savedViewName.trim() || fallbackName;
    const view: SavedExtractorView = {
      id: `${Date.now()}`,
      name,
      filters: { ...filters },
      createdAt: now.toISOString(),
    };

    setSavedViews(prev => [
      view,
      ...prev.filter(item => item.name.toLowerCase() !== name.toLowerCase() && item.id !== view.id),
    ].slice(0, 8));
    setSavedViewName('');
  };

  const applySavedView = (view: SavedExtractorView) => {
    setFilters({ ...DEFAULT_EXTRACTOR_FILTERS, ...view.filters });
  };

  const removeSavedView = (id: string) => {
    setSavedViews(prev => prev.filter(view => view.id !== id));
  };

  const handleManualAdd = () => {
    if (!manualInput.trim()) return;
    const urls = manualInput.split('\n').filter(u => u.trim());
    addLinks(urls);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const urls: string[] = [];
        rows.forEach(row => {
          row.forEach(cell => {
            if (typeof cell === 'string' && detectPlatform(cell)) urls.push(cell);
          });
        });
        addLinks(urls);
      } catch (error) {
        alert('Lỗi đọc file.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      const file = files[0];
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  const updateBatchMonitor = (runId: string, updater: (current: BatchMonitor) => BatchMonitor) => {
    setBatchMonitor(current => {
      if (!current || current.runId !== runId) return current;
      return updater(current);
    });
  };

  const scrapeByPlatform = async (link: ProfileData) => {
    if (link.platform === 'TikTok') {
      return scrapeTikTok(link.url, fastMode, forceRefresh);
    }

    return scrapeFacebook(link.url, forceRefresh);
  };

  const scrapeWithAutoRetry = async (link: ProfileData, runId: string) => {
    let retryCount = link.retryCount || 0;

    while (true) {
      try {
        return await scrapeByPlatform(link);
      } catch (error: any) {
        const category = classifyExtractorError(error);
        const canRetry = shouldAutoRetry(category) && retryCount < MAX_AUTO_RETRIES;

        if (!canRetry) {
          error.category = category;
          error.retryCount = retryCount;
          throw error;
        }

        retryCount += 1;
        updateBatchMonitor(runId, current => ({ ...current, autoRetried: current.autoRetried + 1 }));
        setLinks(prev => prev.map(row => row.id === link.id ? {
          ...row,
          retryCount,
          errorCategory: category,
          errorCode: error.code,
          errorMsg: `Đang thử lại lần ${retryCount}/${MAX_AUTO_RETRIES}: ${error.message}`,
          lastAttemptAt: new Date().toISOString(),
        } : row));
        await wait(AUTO_RETRY_DELAY_MS * retryCount);
      }
    }
  };

  // Process links in parallel batches
  const processLinks = async (mode: ProcessMode = 'pending') => {
    if (links.length === 0 || isProcessing) return;

    const queue = links.filter(link => mode === 'errors' ? link.status === 'error' : link.status === 'pending');
    if (queue.length === 0) return;

    const runId = `${Date.now()}`;
    const totalBatches = Math.ceil(queue.length / PARALLEL_COUNT);
    setIsProcessing(true);
    setBatchMonitor({
      runId,
      mode,
      status: 'running',
      startedAt: new Date().toISOString(),
      total: queue.length,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      cached: 0,
      partial: 0,
      autoRetried: 0,
      currentBatch: 0,
      totalBatches,
    });

    let shouldPause = false;
    let pauseReason = '';

    for (let i = 0; i < queue.length; i += PARALLEL_COUNT) {
      if (shouldPause) break;

      const currentBatch = Math.floor(i / PARALLEL_COUNT) + 1;
      const batch = queue.slice(i, i + PARALLEL_COUNT);
      updateBatchMonitor(runId, current => ({ ...current, currentBatch }));
      
      await Promise.all(batch.map(async (link) => {
        setLinks(prev => prev.map(row => row.id === link.id ? {
          ...row,
          status: 'processing',
          errorMsg: undefined,
          errorCode: undefined,
          errorCategory: undefined,
          lastAttemptAt: new Date().toISOString(),
        } : row));
        
        try {
          const result = await scrapeWithAutoRetry(link, runId);

          setLinks(prev => prev.map(row => row.id === link.id ? {
            ...row,
            ...result,
            status: 'success',
            errorMsg: undefined,
            errorCode: undefined,
            errorCategory: undefined,
          } : row));
          updateBatchMonitor(runId, current => ({
            ...current,
            attempted: current.attempted + 1,
            succeeded: current.succeeded + 1,
            cached: current.cached + (result.cacheHit ? 1 : 0),
            partial: current.partial + (result.partialWarnings?.length ? 1 : 0),
          }));
        } catch (error: any) {
          const category = (error.category || classifyExtractorError(error)) as ErrorCategory;
          const retryCount = typeof error.retryCount === 'number' ? error.retryCount : link.retryCount || 0;

          setLinks(prev => prev.map(row => row.id === link.id ? {
            ...row,
            status: 'error',
            errorMsg: error.message,
            errorCode: error.code,
            errorCategory: category,
            retryCount,
            lastAttemptAt: new Date().toISOString(),
          } : row));
          updateBatchMonitor(runId, current => ({
            ...current,
            attempted: current.attempted + 1,
            failed: current.failed + 1,
          }));

          if (category === 'quota') {
            shouldPause = true;
            pauseReason = `${error.message}\n\nMở Cài đặt để thêm hoặc thay key trong pool RapidAPI.`;
          }
        }
      }));
      
      if (i + PARALLEL_COUNT < queue.length && !shouldPause) {
        await wait(1500);
      }
    }

    updateBatchMonitor(runId, current => ({
      ...current,
      status: shouldPause ? 'paused' : 'completed',
      pauseReason: shouldPause ? pauseReason : undefined,
      finishedAt: new Date().toISOString(),
    }));
    setLinks(prev => prev.map(link => link.status === 'processing' ? { ...link, status: 'pending' } : link));
    setIsProcessing(false);

    if (shouldPause && pauseReason) {
      alert(pauseReason);
    }
  };

  const scrapeTikTok = async (url: string, isFastMode: boolean = false, refresh: boolean = false): Promise<Partial<ProfileData>> => {
    const cacheKey = createProfileCacheKey('TikTok', url, isFastMode ? 'fast' : 'full');
    const cachedProfile = !refresh ? getCachedProfile(cacheKey) : null;
    if (cachedProfile) return cachedProfile;

    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-rapidapi-key': rapidApiKeyHeader,
      },
      body: JSON.stringify({ url, fastMode: isFastMode, forceRefresh: refresh }),
    });
    if (!response.ok) {
      const err = await response.json();
      const requestError = new Error(err.error || 'Lỗi scrape TikTok');
      (requestError as Error & { code?: string }).code = err.code;
      throw requestError;
    }
    const data = await response.json();
    
    const partialWarnings = [...(data.partialWarnings || [])];
    const contactWarnings = [...(data.contactWarnings || [])];

    // Extract engagement stats if available from the scrape
    let averageView = data.averageView || 0;
    let averageEngagement = data.averageEngagement || 0;
    let videoTotalLikes = data.totalLikes || 0;
    let videoTotalComments = data.totalComments || 0;
    let videoTotalShares = data.totalShares || 0;
    let totalSaves = data.totalSaves || 0;
    let videoCount = data.videoCount || 0;
    const normalizedContact = normalizeContact({
      phone: data.phone,
      email: data.email,
      bioLink: data.bioLink,
      text: `${data.nickname || ''} ${data.bio || ''}`,
      source: data.contactSource || 'api',
    });

    const result: Partial<ProfileData> = {
      nickname: data.nickname,
      channelId: data.channelId,
      followers: data.followers,
      following: data.following,
      likes: data.likes,
      bio: data.bio,
      profilePic: data.profilePic,
      phone: normalizedContact.phone,
      email: normalizedContact.email,
      bioLink: normalizedContact.bioLink,
      contactSource: normalizedContact.contactSource,
      contactWarnings: [...new Set([...contactWarnings, ...normalizedContact.contactWarnings])],
      platform: 'TikTok',
      averageView,
      averageEngagement,
      totalLikes: videoTotalLikes,
      totalComments: videoTotalComments,
      totalShares: videoTotalShares,
      totalSaves,
      videoCount,
      cacheHit: data.cacheHit || false,
      cacheSource: data.cacheSource,
      cachedAt: data.cachedAt,
      scrapedAt: data.scrapedAt || new Date().toISOString(),
      partialWarnings: [...new Set(partialWarnings)],
    };
    setCachedProfile(cacheKey, result);
    return result;
  };

  const scrapeFacebook = async (url: string, refresh: boolean = false): Promise<Partial<ProfileData>> => {
    const cacheKey = createProfileCacheKey('Facebook', url);
    const cachedProfile = !refresh ? getCachedProfile(cacheKey) : null;
    if (cachedProfile) return cachedProfile;

    const response = await fetch('/api/extract-facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, forceRefresh: refresh }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Lỗi extract Facebook');
    }
    const data = await response.json();

    const partialWarnings = [...(data.partialWarnings || [])];
    const contactWarnings = [...(data.contactWarnings || [])];
    const normalizedContact = normalizeContact({
      phone: data.phone,
      email: data.email,
      bioLink: data.bioLink,
      text: `${data.nickname || data.title || ''} ${data.description || ''}`,
      source: data.contactSource || 'regex',
    });

    const result: Partial<ProfileData> = {
      nickname: data.nickname || data.title,
      channelId: '',
      followers: data.followers,
      bio: data.description,
      profilePic: data.profilePic,
      phone: normalizedContact.phone,
      email: normalizedContact.email,
      bioLink: normalizedContact.bioLink,
      contactSource: normalizedContact.contactSource,
      contactWarnings: [...new Set([...contactWarnings, ...normalizedContact.contactWarnings])],
      platform: 'Facebook',
      profileType: url.toLowerCase().includes('/groups/') ? 'Community' : 'Individual',
      cacheHit: data.cacheHit || false,
      cacheSource: data.cacheSource,
      cachedAt: data.cachedAt,
      scrapedAt: data.scrapedAt || new Date().toISOString(),
      partialWarnings: [...new Set(partialWarnings)],
    };
    setCachedProfile(cacheKey, result);
    return result;
  };

  const handleSaveToCRM = async () => {
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;

    const today = new Date();
    const saveDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const determineTier = (followersStr: string | number): Tier => {
      const followers = typeof followersStr === 'number' ? followersStr : parseInt(String(followersStr).replace(/,/g, ''), 10);
      if (isNaN(followers)) return 'UGC';
      if (followers > 800000) return 'Macro';
      if (followers >= 100000) return 'Micro';
      if (followers >= 10000) return 'Nano';
      return 'UGC';
    };

    const data: RestoredData[] = successLinks.map(l => ({
      ...l,
      tier: [determineTier(l.followers)],
      location: [],
      group: [],
      campaign: [],
      sow: [],
      notes: [],
      rateHistory: [],
      rating: 0,
      saveDate,
    }));

    if (webhookUrl) {
      setWebhookStatus('sending');
      upsertToSheet(webhookUrl, data).then(success => {
        if (success) {
          setWebhookStatus('sent');
          setTimeout(() => setWebhookStatus('idle'), 3000);
        } else {
          setWebhookStatus('error');
          setTimeout(() => setWebhookStatus('idle'), 3000);
        }
      });
    }

    onSaveToRestored(data);
    setLinks(prev => prev.filter(l => l.status !== 'success'));
  };

  const handleSaveToWebhook = async () => {
    if (!webhookUrl) return;
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;

    const today = new Date();
    const saveDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const determineTier = (followersStr: string | number): Tier => {
      const followers = typeof followersStr === 'number' ? followersStr : parseInt(String(followersStr).replace(/,/g, ''), 10);
      if (isNaN(followers)) return 'UGC';
      if (followers > 800000) return 'Macro';
      if (followers >= 100000) return 'Micro';
      if (followers >= 10000) return 'Nano';
      return 'UGC';
    };

    const data: RestoredData[] = successLinks.map(l => ({
      ...l,
      tier: [determineTier(l.followers)],
      location: [],
      group: [],
      campaign: [],
      sow: [],
      notes: [],
      rateHistory: [],
      rating: 0,
      saveDate,
    }));

    setWebhookStatus('sending');
    const success = await upsertToSheet(webhookUrl, data);
    if (success) {
      setWebhookStatus('sent');
      setTimeout(() => setWebhookStatus('idle'), 3000);
    } else {
      setWebhookStatus('error');
      setTimeout(() => setWebhookStatus('idle'), 3000);
    }
  };

  const formatFollowersForDisplay = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '-';
    let num = typeof val === 'number' ? val : parseFloat(val.toString().trim().replace(/,/g, ''));
    if (isNaN(num)) return val.toString(); // Fallback if unable to parse text 
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const exportToExcel = () => {
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;
    const exportData = successLinks.map((l, i) => ({
      'STT': i + 1,
      'Platform': l.platform || 'TikTok',
      'Tên': l.nickname || '',
      'ID': l.channelId || '',
      'Followers': formatFollowersForDisplay(l.followers),
      'Avg View': l.averageView ? roundView(l.averageView) : '',
      'Avg Engagement': l.averageEngagement ? roundEngagement(l.averageEngagement) : '',
      'SĐT': l.phone || '',
      'Email': l.email || '',
      'Link Bio': l.bioLink || '',
      'Link': l.url,
      'Bio': l.bio || '',
      'Contact Source': l.contactSource || '',
      'Contact Warnings': (l.contactWarnings || []).join(' | '),
      'Cache': l.cacheHit ? `Yes (${l.cacheSource || 'unknown'})` : '',
      'Warnings': (l.partialWarnings || []).join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extracted");
    XLSX.writeFile(wb, "scout_hub_extracted.xlsx", { bookType: 'xlsx' });
  };

  const clearAll = () => { setLinks([]); };
  const removeLink = (id: string) => { setLinks(prev => prev.filter(l => l.id !== id)); };
  const successCount = links.filter(l => l.status === 'success').length;
  const pendingCount = links.filter(l => l.status === 'pending').length;
  const processingCount = links.filter(l => l.status === 'processing').length;
  const errorCount = links.filter(l => l.status === 'error').length;
  const quotaErrorCount = links.filter(l => l.status === 'error' && l.errorCategory === 'quota').length;
  const cachedCount = links.filter(l => l.cacheHit).length;
  const partialCount = links.filter(l => l.partialWarnings && l.partialWarnings.length > 0).length;
  const contactWarningCount = links.filter(l => l.contactWarnings && l.contactWarnings.length > 0).length;
  const filteredLinks = links.filter(link => matchesExtractorFilters(link, filters));
  const hiddenByFiltersCount = links.length - filteredLinks.length;
  const hasActiveFilters = filters.priorityView !== 'all' ||
    filters.platform !== 'All' ||
    filters.status !== 'All' ||
    filters.contact !== 'All' ||
    Boolean(filters.minFollowers.trim()) ||
    Boolean(filters.query.trim());
  const priorityCounts: Record<PriorityViewId, number> = {
    all: links.length,
    hot: links.filter(isHotPriority).length,
    need_review: links.filter(needsReview).length,
    missing_contact: links.filter(link => link.status === 'success' && !hasAnyContact(link)).length,
    errors: errorCount,
    pending: links.filter(link => link.status === 'pending' || link.status === 'processing').length,
  };
  const priorityViewOptions = (Object.keys(PRIORITY_VIEW_COPY) as PriorityViewId[]).map(id => ({
    id,
    ...PRIORITY_VIEW_COPY[id],
    count: priorityCounts[id],
  }));
  const monitorProgress = batchMonitor && batchMonitor.total > 0
    ? Math.round((batchMonitor.attempted / batchMonitor.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Manual Input */}
        <div className={`col-span-2 rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Globe className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
            <h3 className={`text-sm font-semibold ${textP}`}>Nhập link thủ công</h3>
          </div>
          <p className={`text-xs ${textM} mb-3`}>Hỗ trợ cả TikTok & Facebook - mỗi link một dòng</p>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={"https://www.tiktok.com/@username1\nhttps://www.facebook.com/page1\nhttps://www.tiktok.com/@username2"}
            className={`w-full h-28 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none ${inputBg}`}
          />
          <button
            onClick={handleManualAdd}
            disabled={!manualInput.trim() || links.length >= MAX_LINKS}
            className={`mt-2 w-full py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ${btnPrimary}`}
          >
            Thêm vào danh sách ({links.length}/{MAX_LINKS})
          </button>
        </div>

        {/* File Upload */}
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Upload className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
            <h3 className={`text-sm font-semibold ${textP}`}>Tải lên file (Excel/CSV)</h3>
          </div>
          <p className={`text-xs ${textM} mb-3`}>Hệ thống tự tìm link TikTok & Facebook trong file</p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dropBg}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`h-6 w-6 mx-auto mb-2 ${textM}`} />
            <p className={`text-xs ${textS}`}>Kéo thả file hoặc click để chọn</p>
          </div>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`mt-2 w-full py-2 text-sm font-medium rounded-lg border transition-colors ${btnOutline}`}
          >
            Chọn file (.xlsx, .csv)
          </button>
        </div>
      </div>

      {/* Processing Table */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className={`px-5 py-4 border-b ${borderC} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div>
            <h3 className={`text-sm font-semibold ${textP}`}>Danh sách xử lý</h3>
            <span className={`text-xs ${textM}`}>
              {links.length}/{MAX_LINKS} link
              {pendingCount > 0 ? ` · ${pendingCount} chờ` : ''}
              {processingCount > 0 ? ` · ${processingCount} đang chạy` : ''}
              {errorCount > 0 ? ` · ${errorCount} lỗi` : ''}
              {cachedCount > 0 ? ` · ${cachedCount} cache` : ''}
              {partialCount > 0 ? ` · ${partialCount} một phần` : ''}
              {contactWarningCount > 0 ? ` · ${contactWarningCount} cần check contact` : ''}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className={`flex items-center gap-2 text-xs font-medium cursor-pointer ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
              <input 
                type="checkbox" 
                checked={fastMode} 
                onChange={(e) => setFastMode(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-600"
              />
              Tiết kiệm API
            </label>
            <label className={`flex items-center gap-2 text-xs font-medium cursor-pointer ${forceRefresh ? (isDark ? 'text-amber-300' : 'text-amber-700') : textS}`}>
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-600"
              />
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới dữ liệu
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={clearAll} disabled={links.length === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa hết
            </button>
            <button onClick={handleSaveToCRM} disabled={successCount === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-emerald-400 hover:bg-emerald-500/10' : 'border-slate-200 text-emerald-600 hover:bg-emerald-50'}`}>
              <Save className="h-3.5 w-3.5 mr-1" /> Lưu vào CRM
            </button>
            {webhookUrl && (
              <button 
                onClick={handleSaveToWebhook} 
                disabled={successCount === 0 || webhookStatus === 'sending'} 
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                  webhookStatus === 'sent' 
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                    : webhookStatus === 'error'
                    ? 'border-red-500/30 text-red-400 bg-red-500/10'
                    : isDark ? 'border-white/10 text-blue-400 hover:bg-blue-500/10' : 'border-slate-200 text-blue-600 hover:bg-blue-50'
                }`}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                {webhookStatus === 'sending' ? 'Đang gửi...' : webhookStatus === 'sent' ? '✓ Đã gửi Sheet' : webhookStatus === 'error' ? '✕ Lỗi' : 'Gửi → Sheet'}
              </button>
            )}
            <button onClick={exportToExcel} disabled={successCount === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-violet-400 hover:bg-violet-500/10' : 'border-slate-200 text-violet-600 hover:bg-violet-50'}`}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Xuất Excel
            </button>
            <button 
              onClick={() => processLinks('pending')} 
              disabled={pendingCount === 0 || isProcessing}
              className={`inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${btnPrimary}`}
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              {isProcessing ? 'Đang xử lý...' : pendingCount > 0 && successCount + errorCount > 0 ? `Tiếp tục (${pendingCount})` : 'Bắt đầu trích xuất'}
            </button>
            {errorCount > 0 && !isProcessing && (
              <button 
                onClick={() => processLinks('errors')}
                className={`inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Chạy lại lỗi ({errorCount})
              </button>
            )}
          </div>
        </div>

        <div className={`px-5 py-4 border-b ${borderC} ${tableBg}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                  <h4 className={`text-xs font-semibold uppercase tracking-wide ${textP}`}>Priority views</h4>
                </div>
                <p className={`mt-1 text-xs ${textM}`}>
                  Đang hiển thị {filteredLinks.length}/{links.length} link
                  {hiddenByFiltersCount > 0 ? ` · ẩn ${hiddenByFiltersCount} theo bộ lọc` : ''}
                </p>
              </div>
              <button
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${btnOutline}`}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reset filter
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              {priorityViewOptions.map(view => {
                const isActive = filters.priorityView === view.id;
                return (
                  <button
                    key={view.id}
                    onClick={() => updateFilters({ priorityView: view.id })}
                    className={`text-left rounded-xl border px-3 py-2 transition-all ${
                      isActive
                        ? isDark ? 'border-violet-400/40 bg-violet-500/15' : 'border-violet-300 bg-violet-50'
                        : isDark ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${isActive ? (isDark ? 'text-violet-200' : 'text-violet-700') : textP}`}>
                        {view.id === 'hot' && <Star className="inline h-3 w-3 mr-1" />}
                        {view.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? tagBg : isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {view.count}
                      </span>
                    </div>
                    <p className={`mt-1 text-[11px] leading-snug ${textM}`}>{view.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
              <input
                value={filters.query}
                onChange={(e) => updateFilters({ query: e.target.value })}
                placeholder="Tìm tên, URL, bio, contact..."
                className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
              />
              <select
                value={filters.platform}
                onChange={(e) => updateFilters({ platform: e.target.value as PlatformFilter })}
                className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
              >
                <option value="All">Tất cả platform</option>
                <option value="TikTok">TikTok</option>
                <option value="Facebook">Facebook</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value as StatusFilter })}
                className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
              >
                <option value="All">Tất cả status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
              <select
                value={filters.contact}
                onChange={(e) => updateFilters({ contact: e.target.value as ContactFilter })}
                className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
              >
                <option value="All">Tất cả contact</option>
                <option value="has_contact">Có contact</option>
                <option value="missing_contact">Thiếu contact</option>
                <option value="phone">Có SĐT</option>
                <option value="email">Có Email</option>
                <option value="bio_link">Có Bio link</option>
              </select>
              <input
                value={filters.minFollowers}
                onChange={(e) => updateFilters({ minFollowers: e.target.value })}
                placeholder="Min followers, ví dụ 100K"
                className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
              />
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center text-xs font-medium ${textS}`}>
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  Saved views
                </span>
                {savedViews.length === 0 ? (
                  <span className={`text-xs ${textM}`}>Chưa có preset. Lưu filter đang dùng để mở lại nhanh.</span>
                ) : savedViews.map(view => (
                  <span
                    key={view.id}
                    className={`inline-flex items-center rounded-full border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}
                  >
                    <button
                      onClick={() => applySavedView(view)}
                      className={`px-2.5 py-1 text-xs transition-colors ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                      title={`Tạo lúc ${new Date(view.createdAt).toLocaleString('vi-VN')}`}
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={() => removeSavedView(view.id)}
                      className={`px-1.5 py-1 border-l ${isDark ? 'border-white/10 text-slate-500 hover:text-red-300 hover:bg-red-500/10' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      aria-label={`Xóa view ${view.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={savedViewName}
                  onChange={(e) => setSavedViewName(e.target.value)}
                  placeholder="Tên preset, ví dụ Hot TikTok 100K"
                  className={`px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${inputBg}`}
                />
                <button
                  onClick={saveCurrentView}
                  className={`inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${btnPrimary}`}
                >
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  Lưu view
                </button>
              </div>
            </div>
          </div>
        </div>

        {batchMonitor && (
          <div className={`px-5 py-3 border-b ${borderC} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className={`text-xs ${textS}`}>
                  Batch {batchMonitor.status === 'running' ? 'đang chạy' : batchMonitor.status === 'paused' ? 'đã tạm dừng' : 'đã xong'}
                  {' '}· {batchMonitor.attempted}/{batchMonitor.total} xử lý
                  {' '}· {batchMonitor.succeeded} success
                  {' '}· {batchMonitor.failed} lỗi
                  {batchMonitor.autoRetried > 0 ? ` · ${batchMonitor.autoRetried} auto-retry` : ''}
                </div>
                <div className={`text-xs ${textM}`}>
                  Batch {batchMonitor.currentBatch}/{batchMonitor.totalBatches}
                  {quotaErrorCount > 0 ? ` · ${quotaErrorCount} quota` : ''}
                </div>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                <div
                  className={`h-full transition-all ${batchMonitor.status === 'paused' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${monitorProgress}%` }}
                />
              </div>
              {batchMonitor.pauseReason && (
                <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  {batchMonitor.pauseReason.split('\n')[0]}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={`text-[11px] uppercase border-b ${borderC} ${isDark ? 'text-slate-400 bg-white/[0.02]' : 'text-slate-500 bg-slate-50'}`}>
              <tr>
                <th className="px-3 py-3 font-medium w-10 text-center">#</th>
                <th className="px-3 py-3 font-medium w-20">Platform</th>
                <th className="px-3 py-3 font-medium w-36">Tên</th>
                <th className="px-3 py-3 font-medium w-24">ID</th>
                <th className="px-3 py-3 font-medium w-24 text-right">Followers</th>
                <th className="px-3 py-3 font-medium w-24 text-right">Avg View</th>
                <th className="px-3 py-3 font-medium w-28 text-right">Avg Engage</th>
                <th className="px-3 py-3 font-medium w-24">SĐT</th>
                <th className="px-3 py-3 font-medium w-32">Email</th>
                <th className="px-3 py-3 font-medium w-24">Link Bio</th>
                <th className="px-3 py-3 font-medium w-44">Link</th>
                <th className="px-3 py-3 font-medium w-40">Bio</th>
                <th className="px-3 py-3 font-medium w-12 text-center">Ảnh</th>
                <th className="px-3 py-3 font-medium w-24 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/[0.03]' : 'divide-slate-100'}`}>
              {links.length === 0 ? (
                <tr>
                  <td colSpan={14} className={`px-4 py-12 text-center ${textM}`}>
                    <Globe className={`h-8 w-8 mx-auto mb-2 ${isDark ? 'opacity-20' : 'opacity-30'}`} />
                    <p>Chưa có dữ liệu. Thêm link TikTok hoặc Facebook để bắt đầu.</p>
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={14} className={`px-4 py-12 text-center ${textM}`}>
                    <Filter className={`h-8 w-8 mx-auto mb-2 ${isDark ? 'opacity-20' : 'opacity-30'}`} />
                    <p>Không có dòng nào khớp bộ lọc hiện tại.</p>
                    <button
                      onClick={resetFilters}
                      className={`mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${btnOutline}`}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reset filter
                    </button>
                  </td>
                </tr>
              ) : filteredLinks.map((link, index) => (
                <tr key={link.id} className={`${rowHover} transition-colors`}>
                  <td className={`px-3 py-2.5 text-center text-xs ${textM}`}>{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      link.platform === 'Facebook' 
                        ? (isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700')
                        : (isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600')
                    }`}>
                      {link.platform || 'TikTok'}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${textP} truncate max-w-[9rem]`}>{link.nickname || '-'}</td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[6rem]`}>{link.channelId ? `@${link.channelId}` : '-'}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${textP}`}>{formatFollowers(link.followers) || '-'}</td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {link.platform === 'TikTok' && link.averageView ? formatView(link.averageView) : '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`} title={link.platform === 'TikTok' && link.averageEngagement ? `❤️ Likes + 💬 Comments + 🔄 Shares + 🔖 Saves` : ''}>
                    {link.platform === 'TikTok' && link.averageEngagement ? formatEngagement(link.averageEngagement) : '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{link.phone && link.phone !== 'N/A' ? link.phone : '-'}</td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[8rem]`}>{link.email && link.email !== 'N/A' ? link.email : '-'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {link.bioLink && link.bioLink !== 'N/A' ? (
                      <a href={link.bioLink.startsWith('http') ? link.bioLink : `https://${link.bioLink}`} target="_blank" rel="noreferrer" className={`flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                        <LinkIcon className="h-3 w-3 shrink-0" /> Link
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <a href={link.url} target="_blank" rel="noreferrer" className={`flex items-center gap-1 truncate max-w-[10rem] ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                      <LinkIcon className="h-3 w-3 shrink-0" /> {link.url.replace(/https?:\/\/(www\.)?/, '').substring(0, 35)}...
                    </a>
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[10rem]`} title={link.bio}>{link.bio || '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {link.profilePic ? (
                      <img src={link.profilePic} alt="" className="w-7 h-7 rounded-full object-cover mx-auto border border-white/10" referrerPolicy="no-referrer" />
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {link.status === 'pending' && <span className={`text-xs ${textM}`}>Chờ</span>}
                      {link.status === 'processing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />}
                      {link.status === 'success' && (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          {link.cacheHit && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
                              Cache
                            </span>
                          )}
                          {link.partialWarnings && link.partialWarnings.length > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}
                              title={link.partialWarnings.join('\n')}
                            >
                              Một phần
                            </span>
                          )}
                          {link.contactWarnings && link.contactWarnings.length > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}
                              title={link.contactWarnings.join('\n')}
                            >
                              Check contact
                            </span>
                          )}
                        </>
                      )}
                      {link.status === 'error' && (
                        <span className="text-xs text-red-400 flex items-center gap-1" title={link.errorMsg}>
                          <AlertCircle className="h-3.5 w-3.5" />
                          {link.errorCategory ? `Lỗi ${link.errorCategory}` : 'Lỗi'}
                          {link.retryCount ? ` (${link.retryCount})` : ''}
                        </span>
                      )}
                      <button onClick={() => removeLink(link.id)} className={`ml-1 ${isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-colors`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
