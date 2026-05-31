import React, { useState, useMemo } from 'react';
import {
  X, Phone, Mail, Link as LinkIcon, Briefcase, Star, History, Eye,
  StickyNote, CheckCircle2, ChevronDown, DollarSign, Send, Globe, Award, ShieldAlert, Copy, Check
} from 'lucide-react';
import { RestoredData, Tier, WorkflowStatus, OutreachStatus } from '../types';
import { showToast } from './ui/Toast';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RestoredData | null;
  onUpdateRow: (id: string, field: keyof RestoredData, value: any) => void;
  theme?: string;
  tiers?: string[];
  locations?: string[];
  groups?: string[];
  campaigns?: string[];
  sows?: string[];
  calculateFitScore: (profile: RestoredData) => { score: number; positives: string[]; negatives: string[] };
  defaultTab?: 'overview' | 'details' | 'notes_rates' | 'history';
  onOpenOutreach?: (profile: RestoredData) => void;
  onOpenQuotation?: (profile: RestoredData) => void;
}

const NOTE_TEMPLATES = [
  "Đủ data để outreach",
  "Cần verify contact",
  "Fit campaign, ưu tiên shortlist",
  "Đã liên hệ",
  "Chờ phản hồi",
  "Chờ báo giá",
  "Đang negotiate",
  "Từ chối / Không phù hợp",
];

const WORKFLOW_STATUSES: WorkflowStatus[] = ['New', 'Reviewed', 'Shortlisted', 'Contacted', 'Negotiating', 'Closed'];
const OUTREACH_STATUSES: OutreachStatus[] = ['Not Started', 'Drafted', 'Sent', 'Replied', 'Negotiating', 'Confirmed', 'Declined'];

export function ProfileDrawer({
  isOpen,
  onClose,
  profile,
  onUpdateRow,
  theme = 'dark',
  tiers = ['Macro', 'Micro', 'Nano', 'UGC'],
  locations = ['Bắc', 'Trung', 'Nam'],
  groups = ['Beauty', 'Fashion', 'Food', 'Tech', 'Education', 'Entertainment', 'Lifestyle', 'Travel', 'Health', 'Sports'],
  campaigns = ['Tết 2026', 'Summer Promo', 'Black Friday', 'Launch Event', 'Brand Ambassador'],
  sows = ['Photo Post', 'Video Post', 'SDHA (KĐQ)', 'SDHA (ĐQ)'],
  calculateFitScore,
  defaultTab = 'overview',
  onOpenOutreach,
  onOpenQuotation
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'notes_rates' | 'history'>(defaultTab);

  // Sync tab with defaultTab when drawer profile changes
  React.useEffect(() => {
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, profile?.id, isOpen]);
  
  // Note State
  const [noteText, setNoteText] = useState('');
  
  // Rate Log State
  const [ratePrice, setRatePrice] = useState('');
  const [rateNote, setRateNote] = useState('');
  const [rateSow, setRateSow] = useState<string[]>([]);
  const [rateDate, setRateDate] = useState(() => new Date().toLocaleDateString('vi-VN'));
  const [showAddRateForm, setShowAddRateForm] = useState(false);
  const [rateSowDropdownOpen, setRateSowDropdownOpen] = useState(false);

  // Copy success indicator
  const [copySuccess, setCopySuccess] = useState<Record<string, boolean>>({});

  const isDark = theme === 'dark';

  // Memoized styles
  const isDarkClass = isDark ? 'dark' : '';
  const drawerBg = isDark ? 'bg-[#0d0d14] border-l border-white/[0.06] text-white shadow-2xl' : 'bg-white border-l border-slate-200 text-slate-900 shadow-2xl';
  const headerBg = isDark ? 'bg-[#0a0a0f]/80 border-b border-white/[0.06]' : 'bg-slate-50/80 border-b border-slate-200';
  const cardBg = isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-slate-50 border border-slate-200';
  const inputBg = isDark ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400';
  const btnOutline = isDark ? 'border border-white/10 text-slate-300 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50';
  const dividerC = isDark ? 'border-white/[0.06]' : 'border-slate-100';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  
  const tagColors: Record<string, string> = {
    violet: isDark ? 'bg-violet-900/40 text-violet-300 border border-violet-500/20' : 'bg-violet-100 text-violet-700 border border-violet-200',
    emerald: isDark ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    blue: isDark ? 'bg-blue-900/40 text-blue-300 border border-blue-500/20' : 'bg-blue-100 text-blue-700 border border-blue-200',
  };

  const workflowColors: Record<WorkflowStatus, string> = {
    New: isDark ? 'bg-slate-700/50 text-slate-300 border border-slate-500/20' : 'bg-slate-100 text-slate-600 border border-slate-200',
    Reviewed: isDark ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-500/20' : 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    Shortlisted: isDark ? 'bg-violet-900/40 text-violet-300 border border-violet-500/20' : 'bg-violet-100 text-violet-700 border border-violet-200',
    Contacted: isDark ? 'bg-blue-900/40 text-blue-300 border border-blue-500/20' : 'bg-blue-100 text-blue-700 border border-blue-200',
    Negotiating: isDark ? 'bg-amber-900/40 text-amber-300 border border-amber-500/20' : 'bg-amber-100 text-amber-700 border border-amber-200',
    Closed: isDark ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };

  if (!isOpen || !profile) return null;

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopySuccess(prev => ({ ...prev, [id]: true }));
    showToast(`Đã copy ${id === 'phone' ? 'SĐT' : id === 'email' ? 'Email' : 'Link'}: ${text}`, 'success');
    setTimeout(() => {
      setCopySuccess(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const { score, positives, negatives } = calculateFitScore(profile);
  
  let fitScoreColor = '';
  if (score >= 80) fitScoreColor = isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  else if (score >= 50) fitScoreColor = isDark ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200';
  else fitScoreColor = isDark ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-rose-700 bg-rose-50 border-rose-200';

  const formatFollowers = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '' || val === 'N/A') return 'N/A';
    if (typeof val === 'number') {
      if (val >= 1e6) return (val / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (val >= 1e3) return (val / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return val.toString();
    }
    const num = parseFloat(val.toString().replace(/,/g, ''));
    if (!isNaN(num)) {
      if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return num.toString();
    }
    return val.toString();
  };

  const handleAddNote = (templateText?: string) => {
    const text = (templateText || noteText).trim();
    if (!text) return;

    const newNote = {
      id: Math.random().toString(36).substring(7),
      text,
      createdAt: new Date().toISOString(),
    };

    onUpdateRow(profile.id, 'notes', [...(profile.notes || []), newNote]);
    setNoteText('');
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = (profile.notes || []).filter(n => n.id !== noteId);
    onUpdateRow(profile.id, 'notes', updatedNotes);
  };

  const handleAddRateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(ratePrice.replace(/[^\d]/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast("Vui lòng nhập giá trị hợp lệ!", "error");
      return;
    }

    const newRate = {
      id: Math.random().toString(36).substring(7),
      date: rateDate,
      price: priceNum,
      note: rateNote.trim() || undefined,
      sow: rateSow.length > 0 ? rateSow : undefined
    };

    onUpdateRow(profile.id, 'rateHistory', [...(profile.rateHistory || []), newRate]);
    
    // Reset Form
    setRatePrice('');
    setRateNote('');
    setRateSow([]);
    setRateDate(new Date().toLocaleDateString('vi-VN'));
    setShowAddRateForm(false);
  };

  const handleDeleteRateLog = (rateId: string) => {
    if (!confirm("Xóa dòng báo giá này?")) return;
    const updatedRates = (profile.rateHistory || []).filter(r => r.id !== rateId);
    onUpdateRow(profile.id, 'rateHistory', updatedRates);
  };

  // Tag selector drop-down helper component
  const DrawerTagSelector = ({
    title,
    options,
    value,
    color,
    onChange
  }: {
    title: string;
    options: string[];
    value: string[];
    color: string;
    onChange: (val: string[]) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [customVal, setCustomVal] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && customVal.trim()) {
        e.preventDefault();
        const newVal = customVal.trim();
        if (!value.includes(newVal)) onChange([...value, newVal]);
        setCustomVal('');
      }
    };

    return (
      <div className="space-y-1">
        <label className={`text-xs font-semibold ${textSecondary}`}>{title}</label>
        <div className="relative">
          <div
            onClick={() => setOpen(!open)}
            className={`min-h-[36px] w-full flex flex-wrap gap-1 items-center border rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-violet-500/40 transition-colors ${inputBg}`}
          >
            {value.length > 0 ? (
              value.map(val => (
                <span key={val} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColors[color]}`}>
                  {val}
                  <X className="h-2.5 w-2.5 ml-1 hover:text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); onChange(value.filter(v => v !== val)); }} />
                </span>
              ))
            ) : (
              <span className={`text-xs ${textMuted}`}>Chọn {title.toLowerCase()}...</span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 ${textMuted} ml-auto shrink-0`} />
          </div>
          
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className={`absolute z-50 mt-1 left-0 w-full rounded-xl border p-2 shadow-2xl max-h-52 overflow-y-auto ${
                isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <div className="px-2 py-1 mb-1 border-b border-white/5">
                  <input
                    type="text"
                    value={customVal}
                    onChange={(e) => setCustomVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Thêm thẻ mới (Enter)"
                    className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {options.map(opt => (
                  <button
                    key={opt}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (value.includes(opt)) onChange(value.filter(v => v !== opt));
                      else onChange([...value, opt]);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                      isDark ? 'hover:bg-white/5 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{opt}</span>
                    {value.includes(opt) && <span className="text-violet-500 text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm fade-in-backdrop"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div
        className={`fixed top-0 right-0 z-50 h-screen w-full sm:w-[500px] md:w-[600px] flex flex-col slide-in-right ${drawerBg}`}
      >
        {/* Header Section */}
        <div className={`p-5 flex items-start gap-4 sticky top-0 z-10 backdrop-blur-md ${headerBg}`}>
          {profile.profilePic ? (
            <div className="relative shrink-0">
              <img
                src={profile.profilePic}
                alt=""
                className={`w-14 h-14 rounded-full object-cover border-2 ${
                  profile.platform === 'TikTok' ? 'border-fuchsia-500' : 'border-blue-500'
                }`}
                referrerPolicy="no-referrer"
              />
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                profile.platform === 'TikTok' ? 'bg-fuchsia-600' : 'bg-blue-600'
              }`}>
                {profile.platform === 'TikTok' ? 'TT' : 'FB'}
              </span>
            </div>
          ) : (
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2 ${
              isDark ? 'bg-white/5 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}>
              <Globe className="h-6 w-6 text-slate-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold truncate leading-tight">{profile.nickname || 'N/A'}</h2>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border ${workflowColors[profile.workflowStatus || 'New']}`}>
                {profile.workflowStatus || 'New'}
              </span>
            </div>
            <p className={`text-xs ${textSecondary} truncate mt-0.5`}>
              {profile.channelId ? `@${profile.channelId}` : 'No username/ID'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <a
                href={profile.url}
                target="_blank"
                rel="noreferrer"
                className={`text-[10px] flex items-center gap-0.5 ${
                  isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'
                }`}
              >
                <LinkIcon className="h-3 w-3" /> Xem Profile
              </a>
              {profile.projectName && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400 border ${dividerC}`}>
                  <Briefcase className="h-2.5 w-2.5" /> {profile.projectName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors hover:bg-white/10 shrink-0 ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`px-4 flex border-b ${dividerC} bg-slate-500/5`}>
          {(['overview', 'details', 'notes_rates', 'history'] as const).map(tab => {
            const isActive = activeTab === tab;
            const tabLabel = 
              tab === 'overview' ? 'Tổng quan' :
              tab === 'details' ? 'Dữ liệu CRM' :
              tab === 'notes_rates' ? 'Báo giá & Note' : 'Thay đổi';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                  isActive 
                    ? 'border-violet-500 text-violet-500'
                    : `border-transparent ${textSecondary} hover:text-violet-400`
                }`}
              >
                {tab === 'notes_rates' && profile.notes?.length ? `Note (${profile.notes.length})` : tabLabel}
              </button>
            );
          })}
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 fade-in">
              
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl p-3 text-center ${cardBg}`}>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Followers</div>
                  <div className="text-lg font-extrabold mt-1 text-violet-400">{formatFollowers(profile.followers)}</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${cardBg}`}>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Avg Views</div>
                  <div className="text-lg font-extrabold mt-1 text-cyan-400">
                    {profile.platform === 'TikTok' && profile.averageView ? formatFollowers(profile.averageView) : '-'}
                  </div>
                </div>
                <div className={`rounded-xl p-3 text-center ${cardBg}`}>
                  <div className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Engagement</div>
                  <div className="text-lg font-extrabold mt-1 text-amber-400">
                    {profile.platform === 'TikTok' && profile.averageEngagement ? formatFollowers(profile.averageEngagement) : '-'}
                  </div>
                </div>
              </div>

              {/* Niche & Audience classification */}
              <div className={`rounded-xl p-4 space-y-3 ${cardBg}`}>
                <div className="flex items-center justify-between border-b pb-2 border-white/5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <span>Phân loại Kênh (AI)</span>
                  </div>
                  {profile.classificationConfidence !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>
                      Tin cậy: {Math.round(profile.classificationConfidence * 100)}%
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1.5 text-xs">
                  <div className={textSecondary}>Chủ đề:</div>
                  <div className="font-bold text-violet-400">{profile.profileNiche || 'Unclassified'}</div>
                  
                  <div className={textSecondary}>Đặc điểm:</div>
                  <div className={isDark ? 'text-slate-200' : 'text-slate-700'}>{profile.audienceHint || 'Chưa có phân tích.'}</div>
                </div>
              </div>

              {/* Fit Score Progress Widget */}
              <div className={`rounded-xl p-4 space-y-3 ${cardBg}`}>
                <div className="flex items-center justify-between border-b pb-2 border-white/5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-violet-400" />
                    <span>Độ phù hợp chiến dịch</span>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${fitScoreColor}`}>
                    {score}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  {positives.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-500">Điểm cộng ({positives.length})</div>
                      <ul className="space-y-0.5">
                        {positives.map((p, i) => (
                          <li key={i} className="text-[10px] leading-tight text-emerald-400 flex items-start gap-1">
                            <span className="font-bold">✓</span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{p.split(' (+')[0]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {negatives.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-rose-500">Điểm trừ ({negatives.length})</div>
                      <ul className="space-y-0.5">
                        {negatives.map((n, i) => (
                          <li key={i} className="text-[10px] leading-tight text-rose-400 flex items-start gap-1">
                            <span className="font-bold">✗</span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{n.split(' (-')[0]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio summary */}
              {profile.bio && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold">Tiểu sử (Bio)</div>
                  <div className={`p-3 rounded-xl border text-xs leading-relaxed italic ${cardBg} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    "{profile.bio}"
                  </div>
                </div>
              )}

              {/* Quick AI Actions */}
              {(onOpenOutreach || onOpenQuotation) && (
                <div className="space-y-2 pt-1">
                  <div className={`text-xs font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>⚡ Hành động nhanh (AI)</div>
                  <div className="flex gap-2">
                    {onOpenOutreach && (
                      <button
                        onClick={() => onOpenOutreach(profile)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-md shadow-violet-600/20 active:scale-[0.98]"
                      >
                        📤 Soạn Outreach
                      </button>
                    )}
                    {onOpenQuotation && (
                      <button
                        onClick={() => onOpenQuotation(profile)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-md shadow-amber-600/20 active:scale-[0.98]"
                      >
                        📋 Parse Báo Giá
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CRM DETAILS & EDITING */}
          {activeTab === 'details' && (
            <div className="space-y-5 fade-in">
              
              {/* Star Rating & Workflow */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${textSecondary}`}>Workflow Status</label>
                  <select
                    value={profile.workflowStatus || 'New'}
                    onChange={(e) => onUpdateRow(profile.id, 'workflowStatus', e.target.value as WorkflowStatus)}
                    className={`w-full px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}
                  >
                    {WORKFLOW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${textSecondary}`}>Outreach Status</label>
                  <select
                    value={profile.outreachStatus || 'Not Started'}
                    onChange={(e) => onUpdateRow(profile.id, 'outreachStatus', e.target.value as OutreachStatus)}
                    className={`w-full px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}
                  >
                    {OUTREACH_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${textSecondary}`}>Đánh giá (Rating)</label>
                <div className="flex gap-1 items-center h-8">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      onClick={() => onUpdateRow(profile.id, 'rating', profile.rating === i ? 0 : i)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star className={`h-5 w-5 ${
                        i <= profile.rating 
                          ? 'fill-amber-400 text-amber-400' 
                          : isDark ? 'text-slate-700' : 'text-slate-300'
                      }`} />
                    </button>
                  ))}
                  <span className={`text-xs font-semibold ml-2 ${textSecondary}`}>
                    {profile.rating > 0 ? `${profile.rating} / 5 sao` : 'Chưa xếp hạng'}
                  </span>
                </div>
              </div>

              {/* Editable Contacts */}
              <div className="space-y-3.5 pt-3 border-t border-white/5">
                <div className="text-xs font-bold flex items-center gap-1 text-violet-400">
                  <Send className="h-3.5 w-3.5" />
                  <span>Thông tin liên hệ</span>
                </div>
                
                <div className="space-y-3">
                  {/* Phone */}
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${textSecondary}`}>Số điện thoại</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textMuted}`} />
                        <input
                          type="text"
                          value={profile.phone || ''}
                          onChange={(e) => onUpdateRow(profile.id, 'phone', e.target.value)}
                          placeholder="Nhập số điện thoại..."
                          className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                        />
                      </div>
                      {profile.phone && profile.phone !== 'N/A' && profile.phone !== '-' && (
                        <button
                          type="button"
                          onClick={() => {
                            let digits = (profile.phone || '').replace(/\D/g, '');
                            if (digits.startsWith('84')) {
                              digits = '0' + digits.substring(2);
                            }
                            window.open(`https://zalo.me/${digits}`, '_blank');
                          }}
                          className={`px-3 py-2 rounded-lg flex items-center justify-center text-xs font-semibold border transition-all hover:scale-105 active:scale-[0.98] cursor-pointer ${
                            isDark 
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20' 
                              : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          }`}
                          title="Chat Zalo"
                        >
                          💬 Zalo
                        </button>
                      )}
                      {profile.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopy(profile.phone || '', 'phone')}
                          className={`px-3 rounded-lg flex items-center justify-center transition-colors ${btnOutline}`}
                          title="Copy số điện thoại"
                        >
                          {copySuccess['phone'] ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${textSecondary}`}>Email</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textMuted}`} />
                        <input
                          type="text"
                          value={profile.email || ''}
                          onChange={(e) => onUpdateRow(profile.id, 'email', e.target.value)}
                          placeholder="Nhập email liên hệ..."
                          className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                        />
                      </div>
                      {profile.email && (
                        <button
                          onClick={() => handleCopy(profile.email || '', 'email')}
                          className={`px-3 rounded-lg flex items-center justify-center transition-colors ${btnOutline}`}
                          title="Copy email"
                        >
                          {copySuccess['email'] ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio Link */}
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${textSecondary}`}>Link Bio (Website, Shopee, Linktree...)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textMuted}`} />
                        <input
                          type="text"
                          value={profile.bioLink || ''}
                          onChange={(e) => onUpdateRow(profile.id, 'bioLink', e.target.value)}
                          placeholder="https://..."
                          className={`w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                        />
                      </div>
                      {profile.bioLink && (
                        <>
                          <a
                            href={profile.bioLink.startsWith('http') ? profile.bioLink : `https://${profile.bioLink}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`px-3 rounded-lg flex items-center justify-center transition-colors ${btnOutline}`}
                            title="Truy cập link"
                          >
                            <Globe className="h-3.5 w-3.5" />
                          </a>
                          <button
                            onClick={() => handleCopy(profile.bioLink || '', 'biolink')}
                            className={`px-3 rounded-lg flex items-center justify-center transition-colors ${btnOutline}`}
                            title="Copy link"
                          >
                            {copySuccess['biolink'] ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tag selectors */}
              <div className="space-y-3.5 pt-4 border-t border-white/5">
                <div className="text-xs font-bold flex items-center gap-1 text-violet-400">
                  <Award className="h-3.5 w-3.5" />
                  <span>CRM Phân loại & Chiến dịch</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DrawerTagSelector title="Tier" options={tiers} value={profile.tier} color="violet" onChange={(val) => onUpdateRow(profile.id, 'tier', val as Tier[])} />
                  <DrawerTagSelector title="Vị trí địa lý" options={locations} value={profile.location} color="emerald" onChange={(val) => onUpdateRow(profile.id, 'location', val)} />
                  <DrawerTagSelector title="Nhóm Influencer" options={groups} value={profile.group} color="blue" onChange={(val) => onUpdateRow(profile.id, 'group', val)} />
                  <DrawerTagSelector title="Campaign chiến dịch" options={campaigns} value={profile.campaign} color="violet" onChange={(val) => onUpdateRow(profile.id, 'campaign', val)} />
                </div>
                <div className="pt-1">
                  <DrawerTagSelector title="Scope of Work (SOW)" options={sows} value={profile.sow || []} color="emerald" onChange={(val) => onUpdateRow(profile.id, 'sow', val)} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTES & RATE HISTORY */}
          {activeTab === 'notes_rates' && (
            <div className="space-y-6 fade-in">
              
              {/* Section 1: Notes stream */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-white/5">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-violet-400">
                    <StickyNote className="h-4 w-4" />
                    <span>Dòng thời gian ghi chú ({profile.notes?.length || 0})</span>
                  </h3>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {!profile.notes || profile.notes.length === 0 ? (
                    <div className={`text-xs py-4 text-center ${textMuted}`}>Chưa có ghi chú nào.</div>
                  ) : (
                    profile.notes.map(note => (
                      <div key={note.id} className={`p-2.5 rounded-xl text-xs space-y-1 relative group border ${
                        isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-semibold ${textMuted}`}>
                            {new Date(note.createdAt).toLocaleString('vi-VN')}
                          </span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-0.5 rounded"
                            title="Xóa note"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{note.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick note templates */}
                <div className="space-y-1.5 pt-2">
                  <div className={`text-[10px] font-bold ${textMuted}`}>💡 Gợi ý nhanh:</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {NOTE_TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl}
                        onClick={() => handleAddNote(tmpl)}
                        className={`text-[9px] px-2 py-1 rounded-lg border transition-colors ${
                          isDark 
                            ? 'border-white/5 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-500/20' 
                            : 'border-slate-200 text-slate-600 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'
                        }`}
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add note input */}
                <div className="flex gap-2 pt-1.5">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Viết ghi chú mới..."
                    className={`flex-1 px-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                  />
                  <button
                    onClick={() => handleAddNote()}
                    disabled={!noteText.trim()}
                    className="px-3.5 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Section 2: Rate logs list */}
              <div className="space-y-3.5 pt-5 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                    <DollarSign className="h-4 w-4" />
                    <span>Lịch sử giá ({profile.rateHistory?.length || 0})</span>
                  </h3>
                  <button
                    onClick={() => setShowAddRateForm(!showAddRateForm)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      showAddRateForm
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                    }`}
                  >
                    {showAddRateForm ? 'Hủy' : '+ Thêm giá'}
                  </button>
                </div>

                {/* Add Rate Form */}
                {showAddRateForm && (
                  <form onSubmit={handleAddRateLog} className={`p-3 rounded-xl border space-y-3 ${
                    isDark ? 'bg-white/[0.01] border-white/5' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className={`text-[10px] font-bold ${textSecondary}`}>Số tiền (VNĐ)</label>
                        <input
                          type="text"
                          value={ratePrice}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, '');
                            setRatePrice(val ? Number(val).toLocaleString('vi-VN') : '');
                          }}
                          placeholder="Vd: 5.000.000"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={`text-[10px] font-bold ${textSecondary}`}>Ngày báo</label>
                        <input
                          type="text"
                          value={rateDate}
                          onChange={(e) => setRateDate(e.target.value)}
                          placeholder="dd/mm/yyyy"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                          required
                        />
                      </div>
                    </div>

                    {/* Rate Scope of Work selector */}
                    <div className="space-y-1 relative">
                      <label className={`text-[10px] font-bold ${textSecondary}`}>Thẻ SOW áp dụng (Optional)</label>
                      <div 
                        onClick={() => setRateSowDropdownOpen(!rateSowDropdownOpen)}
                        className={`min-h-[30px] w-full flex flex-wrap gap-1 items-center border rounded-lg px-2 py-1 cursor-pointer ${inputBg}`}
                      >
                        {rateSow.length > 0 ? (
                          rateSow.map(s => (
                            <span key={s} className="px-1 py-0.5 rounded bg-violet-500/25 text-violet-300 text-[9px] font-medium border border-violet-500/30">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className={`text-[10px] ${textMuted}`}>Chọn SOW...</span>
                        )}
                      </div>
                      {rateSowDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setRateSowDropdownOpen(false)} />
                          <div className={`absolute z-40 mt-1 w-full rounded-xl border p-1 shadow-2xl max-h-36 overflow-y-auto ${
                            isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'
                          }`}>
                            {sows.map(opt => (
                              <button
                                type="button"
                                key={opt}
                                onClick={() => {
                                  if (rateSow.includes(opt)) setRateSow(rateSow.filter(s => s !== opt));
                                  else setRateSow([...rateSow, opt]);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-[10px] rounded-md ${
                                  rateSow.includes(opt) ? 'bg-violet-500/10 text-violet-400' : 'hover:bg-white/5 text-slate-300'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold ${textSecondary}`}>Ghi chú báo giá</label>
                      <input
                        type="text"
                        value={rateNote}
                        onChange={(e) => setRateNote(e.target.value)}
                        placeholder="Vd: Quay clip 30s hoặc photo album..."
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Lưu báo giá mới
                    </button>
                  </form>
                )}

                {/* Rate Logs List */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {!profile.rateHistory || profile.rateHistory.length === 0 ? (
                    <div className={`text-xs py-4 text-center ${textMuted}`}>Chưa có lịch sử giá nào được ghi nhận.</div>
                  ) : (
                    [...profile.rateHistory].reverse().map(rate => (
                      <div key={rate.id} className={`p-3 rounded-xl border text-xs space-y-1.5 relative group ${
                        isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold text-amber-400`}>
                            {rate.price.toLocaleString('vi-VN')} VNĐ
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-semibold ${textMuted}`}>{rate.date}</span>
                            <button
                              onClick={() => handleDeleteRateLog(rate.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 p-0.5"
                              title="Xóa báo giá"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {rate.note && <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>{rate.note}</p>}
                        {rate.sow && rate.sow.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rate.sow.map(s => (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-violet-900/20 text-violet-300 text-[8px] font-medium border border-violet-500/10">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHANGE HISTORY LOGS */}
          {activeTab === 'history' && (
            <div className="space-y-4 fade-in">
              <div className="flex items-center gap-1.5 border-b pb-2 border-white/5">
                <History className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-bold text-rose-400">Lịch sử thay đổi nội dung profile</h3>
              </div>

              <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
                {!profile.changeHistory || profile.changeHistory.length === 0 ? (
                  <div className={`text-xs py-8 text-center ${textMuted}`}>
                    Chưa có lịch sử thay đổi nào được ghi nhận cho profile này.
                  </div>
                ) : (
                  profile.changeHistory.map(record => (
                    <div key={record.id} className={`rounded-xl border p-3.5 space-y-2.5 ${
                      isDark ? 'border-white/10 bg-white/[0.01]' : 'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between border-b pb-1.5 border-white/5">
                        <span className={`text-[10px] font-bold ${textSecondary}`}>
                          {new Date(record.detectedAt).toLocaleString('vi-VN')}
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                          record.source === 'extractor' 
                            ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20' 
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/10'
                        }`}>
                          {record.source}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {record.changes.map((change, idx) => (
                          <div key={idx} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center text-[11px]">
                            <div className={`font-semibold ${textSecondary} truncate`} title={change.label}>
                              {change.label}
                            </div>
                            <div className="rounded px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/10 truncate" title={String(change.oldValue ?? '-')}>
                              Cũ: {change.oldValue ?? '-'}
                            </div>
                            <div className="rounded px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 truncate" title={String(change.newValue ?? '-')}>
                              Mới: {change.newValue ?? '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
