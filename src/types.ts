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
  outreachDraftSubject?: string;
  outreachDraftBody?: string;
  outreachHistory?: { id: string; subject: string; body: string; sentAt: string }[];
  lastQuotedAt?: string;
  lastUpdated?: string;
  isWatchlisted?: boolean;
  watchlistedAt?: string;
  lastReviewedAt?: string;
  lastChangedAt?: string;
  changeHistory?: ProfileChangeRecord[];
  
  // Priority 1.4: Execution Sync Fields for Google Sheet
  executionPhase?: string;
  executionStatus?: string;
  confirmedCost?: number;
  confirmedSOW?: string;

  // Priority 3: Contract Info inside CRM Profile
  contractInfo?: KOLContractInfo;
}

export interface KOLContractInfo {
  entityType: 'individual' | 'company' | 'business_household';
  
  // === Cá nhân ===
  fullName?: string;
  idNumber?: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  permanentAddress?: string;
  contactAddress?: string;
  personalTaxId?: string;
  cccdLink?: string;
  
  // === Công ty ===
  companyName?: string;
  companyTaxId?: string;
  companyAddress?: string;
  legalRepresentative?: string;
  authorization?: string;
  position?: string;
  
  // === Hộ kinh doanh ===
  businessRegNo?: string;
  businessOwner?: string;
  businessAddress?: string;
  
  // === Chung ===
  bankAccountName?: string;
  bankAccountNo?: string;
  bankName?: string;
  phone?: string;
  email?: string;
  
  collectedAt?: string;
  rawText?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  entityType: 'individual' | 'company' | 'business_household';
  markdownContent: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionActivity {
  id: string;
  action: string;
  timestamp: string;
  note?: string;
}

export interface SavedView {
  id: string;
  name: string;
  platform: string;
  tier: string;
  campaign: string;
  workflowStatus: string;
  niche: string;
  hasContact: string;
  searchTerm: string;
  projectName?: string;
}

// === EXECUTION HUB TYPES ===

export type ExecutionPhase = 'connecting' | 'launching' | 'wrapping';

// Lean status — mỗi phase chỉ 3-4 options
export type ConnectingStatus = 'pending_quote' | 'dealing' | 'confirmed' | 'cancelled';
export type LaunchingStatus = 'preparing' | 'in_progress' | 'aired' | 'cancelled';
export type WrappingStatus = 'pending_payment' | 'processing' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  name: string;
  chargeCode: string;
  brand: string;
  description: string;
  startDate: string;
  endDate: string;
  budget?: number;
  status: 'draft' | 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionProfile {
  id: string;
  campaignId: string;
  profileId: string;              // Reference → RestoredData.id
  phase: ExecutionPhase;

  // --- CONNECTING ---
  connectingStatus: ConnectingStatus;
  confirmedSOW: SOWItem[];
  totalCost: number;
  currency: string;               // 'VND' | 'USD'
  paymentTerm: string;            // "Net 30", "COD", "50/50"
  confirmMessageRaw: string;      // Tin nhắn gốc confirm

  // --- LAUNCHING ---
  launchingStatus: LaunchingStatus;
  contractType?: 'individual' | 'company' | 'business_household';
  contractNotes: string;          // Ghi chú hợp đồng tự do
  contractGoogleDocUrl?: string;
  confirmEmailDraft?: string;
  contentDeadline?: string;
  publishedLinks: string[];

  // --- WRAPPING ---
  wrappingStatus: WrappingStatus;
  expectedPaymentDate?: string;
  actualPaymentDate?: string;
  invoiceNumber?: string;
  acceptanceNotes: string;        // Ghi chú nghiệm thu
  followUpItems: FollowUpItem[];

  // --- META ===
  notes: string;                  // Ghi chú tự do chung
  assignedAt: string;
  updatedAt: string;
  activityLog?: ExecutionActivity[];
}

export interface SOWItem {
  name: string;
  price: number;
  currency: string;
  quantity: number;
}

export interface FollowUpItem {
  id: string;
  description: string;
  dueDate: string;
  completed: boolean;
}


