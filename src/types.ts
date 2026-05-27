export interface ProfileData {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  errorCode?: string;
  errorCategory?: 'quota' | 'network' | 'blocked' | 'invalid' | 'unknown';
  retryCount?: number;
  lastAttemptAt?: string;
  nickname?: string;
  channelId?: string;
  followers?: string | number;
  following?: string | number;
  likes?: string | number;
  bio?: string;
  profilePic?: string;
  phone?: string;
  email?: string;
  bioLink?: string;
  profileNiche?: string;
  audienceHint?: string;
  classificationConfidence?: number;
  contactSource?: 'regex' | 'ai' | 'api' | 'fallback';
  contactWarnings?: string[];
  platform?: Platform;
  profileType?: 'Individual' | 'Community' | 'N/A';
  // TikTok engagement metrics
  averageView?: number;
  averageEngagement?: number;
  totalLikes?: number;
  totalComments?: number;
  totalShares?: number;
  totalSaves?: number;
  videoCount?: number;
  aiAnalysis?: string;
  cacheHit?: boolean;
  cacheSource?: 'client' | 'server';
  cachedAt?: string;
  scrapedAt?: string;
  partialWarnings?: string[];
}

export interface ProfileNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface ProfileFieldChange {
  field: string;
  label: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface ProfileChangeRecord {
  id: string;
  detectedAt: string;
  source: 'extractor' | 'sheet' | 'import' | 'manual';
  changes: ProfileFieldChange[];
}

export type Tier = 'Macro' | 'Micro' | 'Nano' | 'UGC';
export type Platform = 'TikTok' | 'Facebook';
export type WorkflowStatus = 'New' | 'Reviewed' | 'Shortlisted' | 'Contacted' | 'Negotiating' | 'Closed';
export type OutreachStatus = 'Not Started' | 'Drafted' | 'Sent' | 'Replied' | 'Negotiating' | 'Confirmed' | 'Declined';

export interface OutreachTemplate {
  id: string;
  name: string;
  section: 'email' | 'dm_tiktok' | 'dm_facebook' | 'dm_instagram' | 'other';
  subject?: string;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedQuotationItem {
  name: string;
  price: number;
  currency?: string;
}

export interface ParsedQuotation {
  profileDetected: { name: string | null; handle: string | null };
  sowItems: ParsedQuotationItem[];
  timeline: string | null;
  usageRights: string | null;
  notes: string | null;
  contact: { phone: string | null; email: string | null };
  confidence: number;
}

export interface RestoredData extends ProfileData {
  id: string;
  tier: Tier[];
  location: string[];
  group: string[];
  campaign: string[];
  sow: string[];
  notes: { id: string, text: string, createdAt: string }[];
  rateHistory?: { id: string, date: string, price: number, note?: string, sow?: string[] }[];
  rating: number;
  saveDate: string;
  workflowStatus?: WorkflowStatus;
  outreachStatus?: OutreachStatus;
  projectName?: string;
  lastQuotedAt?: string;
  lastUpdated?: string;
  isWatchlisted?: boolean;
  watchlistedAt?: string;
  lastReviewedAt?: string;
  lastChangedAt?: string;
  changeHistory?: ProfileChangeRecord[];
}
