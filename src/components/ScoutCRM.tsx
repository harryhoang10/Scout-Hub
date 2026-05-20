import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Trash2, CopyX, Star, Users, Briefcase, FileDown,
  LayoutGrid, List, Search, ArrowUpDown, Loader2, Link as LinkIcon, Phone, Mail, Filter, Upload, RefreshCw, X, CheckCircle2, StickyNote, History, ChevronDown, Globe, Bell, BellOff, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RestoredData, Tier, WorkflowStatus } from '../types';
import { TagSelector } from './TagSelector';
import { upsertToSheet, deleteFromSheet } from '../lib/api';
import { CompareModal } from './CompareModal';
import { RateHistoryModal } from './RateHistoryModal';
import { CampaignBoard } from './CampaignBoard';
import { mergeProfileBatch } from '../lib/profileChangeDetection';
import { classifyProfile, findDuplicateGroups, mergeDuplicateGroup } from '../lib/profileIntelligence';

const MAX_STARS = 5;
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
const LOCATION_OPTIONS = ['Bắc', 'Trung', 'Nam'];
const GROUP_OPTIONS = ['Beauty', 'Fashion', 'Food', 'Tech', 'Education', 'Entertainment', 'Lifestyle', 'Travel', 'Health', 'Sports'];
const CAMPAIGN_OPTIONS = ['Tết 2026', 'Summer Promo', 'Black Friday', 'Launch Event', 'Brand Ambassador'];
const SOW_OPTIONS = ['Photo Post', 'Video Post', 'SDHA (KĐQ)', 'SDHA (ĐQ)'];

const TIER_OPTIONS: Tier[] = ['Macro', 'Micro', 'Nano', 'UGC'];
const WORKFLOW_STATUSES: WorkflowStatus[] = ['New', 'Reviewed', 'Shortlisted', 'Contacted', 'Negotiating', 'Closed'];
type SortField = 'saveDate' | 'nickname' | 'followers' | 'rating';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'card' | 'board';
type LifecycleFilter = 'all' | 'watchlist' | 'changed_recently' | 'duplicates';

interface ScoutCRMProps {
  data: RestoredData[];
  onUpdateData: (data: RestoredData[]) => void;
  webhookUrl?: string;
  theme?: string;
  onRefreshProfiles?: (urls: string[]) => void;
}

export function ScoutCRM({ data, onUpdateData, webhookUrl, theme, onRefreshProfiles }: ScoutCRMProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('saveDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterHasContact, setFilterHasContact] = useState<string>('all');
  const [filterLifecycle, setFilterLifecycle] = useState<LifecycleFilter>('all');
  const [filterWorkflowStatus, setFilterWorkflowStatus] = useState<string>('all');
  const [filterNiche, setFilterNiche] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeChangeProfileId, setActiveChangeProfileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rate History Modal State
  const [activeRateProfileId, setActiveRateProfileId] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';
  const inputBg = isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const tableBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const rowHover = isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50';
  const divideC = isDark ? 'divide-white/[0.03]' : 'divide-slate-100';
  const tagColors: Record<string, string> = {
    violet: isDark ? 'bg-violet-900/40 text-violet-300 border-violet-500/20' : 'bg-violet-100 text-violet-700 border-violet-200',
    emerald: isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
    blue: isDark ? 'bg-blue-900/40 text-blue-300 border-blue-500/20' : 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const workflowColors: Record<WorkflowStatus, string> = {
    New: isDark ? 'bg-slate-700/50 text-slate-300 border-slate-500/20' : 'bg-slate-100 text-slate-600 border-slate-200',
    Reviewed: isDark ? 'bg-cyan-900/40 text-cyan-300 border-cyan-500/20' : 'bg-cyan-100 text-cyan-700 border-cyan-200',
    Shortlisted: isDark ? 'bg-violet-900/40 text-violet-300 border-violet-500/20' : 'bg-violet-100 text-violet-700 border-violet-200',
    Contacted: isDark ? 'bg-blue-900/40 text-blue-300 border-blue-500/20' : 'bg-blue-100 text-blue-700 border-blue-200',
    Negotiating: isDark ? 'bg-amber-900/40 text-amber-300 border-amber-500/20' : 'bg-amber-100 text-amber-700 border-amber-200',
    Closed: isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/20' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const dropdownBg = isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200 shadow-lg';
  const dropItemHover = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50';
  const btnOutline = isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50';

  // Dashboard stats
  const stats = useMemo(() => {
    const total = data.length;
    const tiktok = data.filter(d => d.platform === 'TikTok').length;
    const facebook = data.filter(d => d.platform === 'Facebook').length;
    const hasPhone = data.filter(d => d.phone && d.phone !== 'N/A' && d.phone !== '-').length;
    const hasEmail = data.filter(d => d.email && d.email !== 'N/A' && d.email !== '-').length;
    const rated = data.filter(d => d.rating && d.rating > 0).length;
    const watchlisted = data.filter(d => d.isWatchlisted).length;
    const changed = data.filter(d => d.changeHistory && d.changeHistory.length > 0).length;
    return { total, tiktok, facebook, hasPhone, hasEmail, rated, watchlisted, changed };
  }, [data]);

  const dynamicTiers = useMemo(() => Array.from(new Set([...TIER_OPTIONS, ...data.flatMap(d => d.tier)])), [data]);
  const dynamicLocations = useMemo(() => Array.from(new Set([...LOCATION_OPTIONS, ...data.flatMap(d => d.location)])), [data]);
  const dynamicGroups = useMemo(() => Array.from(new Set([...GROUP_OPTIONS, ...data.flatMap(d => d.group)])), [data]);
  const dynamicCampaigns = useMemo(() => Array.from(new Set([...CAMPAIGN_OPTIONS, ...data.flatMap(d => d.campaign)])), [data]);
  const dynamicSow = useMemo(() => Array.from(new Set([...SOW_OPTIONS, ...data.flatMap(d => d.sow || [])])), [data]);
  const dynamicNiches = useMemo(() => Array.from(new Set(data.map(d => d.profileNiche).filter(Boolean))) as string[], [data]);
  const duplicateGroups = useMemo(() => findDuplicateGroups(data), [data]);
  const duplicateProfileIds = useMemo(() => new Set(duplicateGroups.flatMap(group => group.profiles.map(profile => profile.id))), [duplicateGroups]);
  const workflowCounts = useMemo(() => {
    return WORKFLOW_STATUSES.reduce<Record<WorkflowStatus, number>>((counts, status) => {
      counts[status] = data.filter(row => (row.workflowStatus || 'New') === status).length;
      return counts;
    }, {
      New: 0,
      Reviewed: 0,
      Shortlisted: 0,
      Contacted: 0,
      Negotiating: 0,
      Closed: 0,
    });
  }, [data]);

  useEffect(() => {
    const needsClassification = data.some(row => !row.profileNiche || !row.audienceHint || row.classificationConfidence === undefined);
    if (!needsClassification) return;

    onUpdateData(data.map(row => {
      if (row.profileNiche && row.audienceHint && row.classificationConfidence !== undefined) return row;
      return { ...row, ...classifyProfile(row) };
    }));
  }, [data, onUpdateData]);

  // Refresh from webhook
  const refreshFromSheet = async () => {
    if (!webhookUrl) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/webhook/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const imported: RestoredData[] = result.data.map((row: any) => ({
          id: Math.random().toString(36).substring(7),
          url: row['Link'] || row.url || '',
          status: 'success' as const,
          nickname: row['Tên'] || row.nickname || '',
          channelId: row['ID'] || row.channelId || '',
          followers: row['Followers'] || row.followers || '',
          averageView: Number(row['Avg View'] || row.averageView) || 0,
          averageEngagement: Number(row['Avg Engagement'] || row.averageEngagement) || 0,
          phone: row['SĐT'] || row.phone || '',
          email: row['Email'] || row.email || '',
          bioLink: row['Link Bio'] || row.bioLink || '',
          bio: row['Bio'] || row.bio || '',
          profilePic: row['Avatar'] || row.profilePic || '',
          platform: row['Platform'] || row.platform || 'TikTok',
          profileType: row['Profile'] || 'Individual',
          tier: row['Tier'] ? String(row['Tier']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          location: row['Vị trí'] ? String(row['Vị trí']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          group: row['Nhóm'] ? String(row['Nhóm']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          campaign: row['Campaign'] ? String(row['Campaign']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          sow: row['SOW'] ? String(row['SOW']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          notes: row.notes || [],
          rateHistory: row.rateHistory || [],
          rating: Number(row['Rating'] || row.rating) || 0,
          workflowStatus: row['Workflow'] || row.workflowStatus || 'New',
          saveDate: row['Ngày'] || row['Ngày lưu trữ'] || row.saveDate || new Date().toLocaleDateString('vi-VN'),
        })).filter((r: any) => r.url);
        
        const merged = mergeProfileBatch(data, imported, 'sheet');
        onUpdateData(merged.data);
        alert(`Sync Sheet xong: ${merged.stats.added} mới, ${merged.stats.updated} cập nhật, ${merged.stats.changed} có thay đổi.`);
      }
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    }
    setIsRefreshing(false);
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
        const rows = XLSX.utils.sheet_to_json(ws) as any[];
        const today = new Date();
        const saveDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
        const newRows: RestoredData[] = rows.map(row => ({
          id: Math.random().toString(36).substring(7),
          url: row['Link'] || row['url'] || row['URL'] || '',
          status: 'success' as const,
          nickname: row['Tên'] || row['nickname'] || row['Name'] || '',
          channelId: row['ID'] || row['channelId'] || '',
          followers: row['Followers'] || row['followers'] || row['Followers / Members'] || '',
          averageView: Number(row['Avg View'] || row['averageView']) || 0,
          averageEngagement: Number(row['Avg Engagement'] || row['averageEngagement']) || 0,
          phone: row['SĐT'] || row['phone'] || '',
          email: row['Email'] || row['email'] || '',
          bioLink: row['Link Bio'] || row['bioLink'] || '',
          bio: row['Tiểu sử (Bio)'] || row['bio'] || row['Bio'] || '',
          profilePic: row['Link ảnh'] || row['profilePic'] || row['Avatar'] || '',
          platform: row['Platform'] || row['platform'] || 'TikTok',
          profileType: row['Profile'] || row['profileType'] || 'Individual',
          tier: (row['Tier'] ? String(row['Tier']).split(',').map((s: string) => s.trim()).filter(Boolean) : []) as Tier[],
          location: row['Vị trí'] ? String(row['Vị trí']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          group: row['Nhóm'] || row['Nhóm Influencer'] ? String(row['Nhóm'] || row['Nhóm Influencer']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          campaign: row['Campaign'] ? String(row['Campaign']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          sow: row['SOW'] ? String(row['SOW']).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          notes: [],
          rating: Number(row['Rating']) || 0,
          workflowStatus: row['Workflow'] || row['workflowStatus'] || 'New',
          saveDate: row['Ngày lưu trữ'] || row['Save Date'] || saveDate,
        })).filter(r => r.url);
        const merged = mergeProfileBatch(data, newRows, 'import');
        onUpdateData(merged.data);
        alert(`Đã import ${newRows.length} dòng: ${merged.stats.added} mới, ${merged.stats.updated} cập nhật, ${merged.stats.changed} có thay đổi.`);
      } catch (error) {
        alert("Lỗi khi đọc file.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const roundMetric = (val: number | undefined): number => {
    if (!val) return 0;
    if (val < 1000) return Math.round(val / 100) * 100;
    return Math.round(val / 1000) * 1000;
  };

  const formatNum = (val: number | undefined): string => {
    if (!val) return '';
    return roundMetric(val).toString();
  };

  const exportToExcel = () => {
    if (data.length === 0) return;
    const exportData = data.map((row, index) => ({
      'STT': index + 1,
      'Ngày lưu trữ': row.saveDate,
      'Platform': row.platform || 'TikTok',
      'Tên': row.nickname || '',
      'ID': row.channelId || '',
      'Followers': formatFollowers(row.followers) || '',
      'Avg View': row.averageView ? roundMetric(row.averageView) : '',
      'Avg Engagement': row.averageEngagement ? roundMetric(row.averageEngagement) : '',
      'SĐT': row.phone || '',
      'Email': row.email || '',
      'Link Bio': row.bioLink || '',
      'Link': row.url,
      'Bio': row.bio || '',
      'Avatar': row.profilePic || '',
      'Profile': row.profileType || 'Individual',
      'Tier': row.tier.join(', '),
      'Vị trí': row.location.join(', '),
      'Nhóm': row.group.join(', '),
      'Campaign': row.campaign.join(', '),
      'SOW': (row.sow || []).join(', '),
      'Ghi chú': (row.notes || []).map(n => n.text).join(' | '),
      'Rate History': (row.rateHistory || []).map(r => `${r.price.toLocaleString('vi-VN')}đ (${r.date}${r.note ? ' - ' + r.note : ''})`).join(' | '),
      'Rating': row.rating || 0,
      'Workflow': row.workflowStatus || 'New',
      'Profile Niche': row.profileNiche || '',
      'Audience Hint': row.audienceHint || '',
      'Classification Confidence': row.classificationConfidence !== undefined ? Math.round(row.classificationConfidence * 100) + '%' : '',
      'Watchlist': row.isWatchlisted ? 'Yes' : '',
      'Last Changed': row.lastChangedAt || '',
      'Change Count': row.changeHistory?.length || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scout CRM");
    XLSX.writeFile(wb, "scout_crm_data.xlsx", { bookType: 'xlsx' });
  };

  const updateRow = (id: string, field: keyof RestoredData, value: any) => {
    const updatedData = data.map(r => r.id === id ? { ...r, [field]: value } : r);
    onUpdateData(updatedData);
    if (webhookUrl) {
      const editedRow = updatedData.find(r => r.id === id);
      if (editedRow) upsertToSheet(webhookUrl, [editedRow]);
    }
  };

  const isChangedRecently = (row: RestoredData) => {
    if (!row.lastChangedAt && !(row.changeHistory && row.changeHistory.length > 0)) return false;
    const changedAt = row.lastChangedAt || row.changeHistory?.[0]?.detectedAt;
    if (!changedAt) return false;
    const changedTime = new Date(changedAt).getTime();
    if (!Number.isFinite(changedTime)) return false;
    return Date.now() - changedTime <= 7 * 24 * 60 * 60 * 1000;
  };

  const toggleWatchlist = (row: RestoredData) => {
    const nextValue = !row.isWatchlisted;
    const updatedRow = {
      ...row,
      isWatchlisted: nextValue,
      watchlistedAt: nextValue ? new Date().toISOString() : undefined,
    };
    const updatedData = data.map(item => item.id === row.id ? updatedRow : item);
    onUpdateData(updatedData);
    if (webhookUrl) upsertToSheet(webhookUrl, [updatedRow]);
  };

  const updateWorkflowStatus = (row: RestoredData, workflowStatus: WorkflowStatus) => {
    const updatedRow = {
      ...row,
      workflowStatus,
      lastReviewedAt: workflowStatus === 'Reviewed' ? new Date().toISOString() : row.lastReviewedAt,
    };
    const updatedData = data.map(item => item.id === row.id ? updatedRow : item);
    onUpdateData(updatedData);
    if (webhookUrl) upsertToSheet(webhookUrl, [updatedRow]);
  };

  const deleteRow = (id: string) => {
    if (confirm('Xóa profile này?')) {
      const rowToDelete = data.find(r => r.id === id);
      onUpdateData(data.filter(r => r.id !== id));
      if (webhookUrl && rowToDelete) deleteFromSheet(webhookUrl, [rowToDelete.url]);
    }
  };

  const clearAll = () => {
    if (confirm('Xóa toàn bộ dữ liệu?')) {
      const allUrls = data.map(r => r.url);
      onUpdateData([]);
      if (webhookUrl && allUrls.length > 0) deleteFromSheet(webhookUrl, allUrls);
    }
  };

  const removeDuplicates = () => {
    const groups = findDuplicateGroups(data);
    if (groups.length === 0) {
      alert("Không có trùng lặp.");
      return;
    }

    if (!confirm(`Tìm thấy ${groups.length} nhóm trùng lặp. Gộp tất cả và giữ profile có nhiều CRM data nhất?`)) return;
    const mergedData = groups.reduce((currentData, group) => mergeDuplicateGroup(currentData, group.profiles.map(profile => profile.id)), data);
    const removed = data.length - mergedData.length;
    onUpdateData(mergedData);
    alert(`Đã gộp ${groups.length} nhóm trùng lặp, loại ${removed} dòng duplicate.`);
  };

  const mergeOneDuplicateGroup = (ids: string[]) => {
    const mergedData = mergeDuplicateGroup(data, ids);
    const removed = data.length - mergedData.length;
    onUpdateData(mergedData);
    if (removed > 0) alert(`Đã gộp duplicate và loại ${removed} dòng.`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const addNote = (id: string, templateText?: string) => {
    const finalText = (templateText || noteText).trim();
    if (!finalText) return;
    const row = data.find(r => r.id === id);
    if (row) {
      updateRow(id, 'notes', [...(row.notes || []), {
        id: Math.random().toString(36).substring(7),
        text: finalText,
        createdAt: new Date().toISOString(),
      }]);
    }
    setNoteText('');
    setEditingNoteId(null);
  };

  const deleteNote = (rowId: string, noteId: string) => {
    const row = data.find(r => r.id === rowId);
    if (row) updateRow(rowId, 'notes', (row.notes || []).filter(n => n.id !== noteId));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const isInteractiveClick = (target: EventTarget | null) => {
    return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, label, [role="button"]'));
  };

  const handleProfileRowClick = (event: React.MouseEvent, id: string) => {
    if (isInteractiveClick(event.target)) return;
    toggleSelect(id);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredAndSortedData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredAndSortedData.map(d => d.id)));
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Xóa ${selectedIds.size} profiles?`)) {
      const urlsToDelete = data.filter(r => selectedIds.has(r.id)).map(r => r.url);
      onUpdateData(data.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      if (webhookUrl && urlsToDelete.length > 0) deleteFromSheet(webhookUrl, urlsToDelete);
    }
  };

  const bulkAssignTier = (tier: Tier) => {
    const updatedData = data.map(r => selectedIds.has(r.id) ? { ...r, tier: r.tier.includes(tier) ? r.tier : [...r.tier, tier] } : r);
    onUpdateData(updatedData);
    if (webhookUrl) {
      const editedRows = updatedData.filter(r => selectedIds.has(r.id));
      if (editedRows.length > 0) upsertToSheet(webhookUrl, editedRows);
    }
  };

  const bulkAssignCampaign = (campaign: string) => {
    const updatedData = data.map(r => selectedIds.has(r.id) ? { ...r, campaign: r.campaign.includes(campaign) ? r.campaign : [...r.campaign, campaign] } : r);
    onUpdateData(updatedData);
    if (webhookUrl) {
      const editedRows = updatedData.filter(r => selectedIds.has(r.id));
      if (editedRows.length > 0) upsertToSheet(webhookUrl, editedRows);
    }
  };

  const bulkSetWatchlist = (isWatchlisted: boolean) => {
    const changedAt = new Date().toISOString();
    const updatedData = data.map(r => selectedIds.has(r.id)
      ? { ...r, isWatchlisted, watchlistedAt: isWatchlisted ? (r.watchlistedAt || changedAt) : undefined }
      : r);
    onUpdateData(updatedData);
    if (webhookUrl) {
      const editedRows = updatedData.filter(r => selectedIds.has(r.id));
      if (editedRows.length > 0) upsertToSheet(webhookUrl, editedRows);
    }
  };

  const bulkSetWorkflowStatus = (workflowStatus: WorkflowStatus) => {
    const reviewedAt = new Date().toISOString();
    const updatedData = data.map(r => selectedIds.has(r.id)
      ? { ...r, workflowStatus, lastReviewedAt: workflowStatus === 'Reviewed' ? reviewedAt : r.lastReviewedAt }
      : r);
    onUpdateData(updatedData);
    if (webhookUrl) {
      const editedRows = updatedData.filter(r => selectedIds.has(r.id));
      if (editedRows.length > 0) upsertToSheet(webhookUrl, editedRows);
    }
  };

  const refreshProfiles = (profiles: RestoredData[]) => {
    const urls = profiles.map(profile => profile.url).filter(Boolean);
    if (urls.length === 0 || !onRefreshProfiles) return;
    onRefreshProfiles(urls);
  };

  const refreshSelected = () => {
    refreshProfiles(data.filter(profile => selectedIds.has(profile.id)));
  };

  const refreshWatchlist = () => {
    refreshProfiles(data.filter(profile => profile.isWatchlisted));
  };

  const parseNumberForSort = (val: string | number | undefined) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let s = val.toString().toLowerCase().trim();
    let mul = 1;
    if (s.includes('m') || s.includes('triệu')) mul = 1e6;
    else if (s.includes('k') || s.includes('nghìn') || s.includes('ngàn')) mul = 1e3;
    return parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.')) * mul || 0;
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    if (filterPlatform !== 'all') result = result.filter(r => r.platform === filterPlatform);
    if (filterTier !== 'all') result = result.filter(r => r.tier.includes(filterTier as Tier));
    if (filterCampaign !== 'all') result = result.filter(r => r.campaign.includes(filterCampaign));
    if (filterWorkflowStatus !== 'all') result = result.filter(r => (r.workflowStatus || 'New') === filterWorkflowStatus);
    if (filterNiche !== 'all') result = result.filter(r => (r.profileNiche || 'Unclassified') === filterNiche);
    if (filterHasContact === 'phone') result = result.filter(r => r.phone && r.phone !== 'N/A' && r.phone !== '-');
    else if (filterHasContact === 'email') result = result.filter(r => r.email && r.email !== 'N/A' && r.email !== '-');
    else if (filterHasContact === 'both') result = result.filter(r => (r.phone && r.phone !== 'N/A' && r.phone !== '-') && (r.email && r.email !== 'N/A' && r.email !== '-'));
    if (filterLifecycle === 'watchlist') result = result.filter(r => r.isWatchlisted);
    else if (filterLifecycle === 'changed_recently') result = result.filter(isChangedRecently);
    else if (filterLifecycle === 'duplicates') result = result.filter(r => duplicateProfileIds.has(r.id));
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.nickname?.toLowerCase().includes(lower)) || (r.channelId?.toLowerCase().includes(lower)) ||
        (r.bio?.toLowerCase().includes(lower)) || (r.tier.some(t => t.toLowerCase().includes(lower))) ||
        (r.location.some(l => l.toLowerCase().includes(lower))) || (r.group.some(g => g.toLowerCase().includes(lower))) ||
        (r.campaign.some(c => c.toLowerCase().includes(lower))) ||
        ((r.workflowStatus || 'New').toLowerCase().includes(lower)) ||
        ((r.profileNiche || '').toLowerCase().includes(lower)) ||
        ((r.audienceHint || '').toLowerCase().includes(lower)) ||
        ((r.notes || []).some(n => n.text.toLowerCase().includes(lower)))
      );
    }
    
    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'followers') { valA = parseNumberForSort(a.followers); valB = parseNumberForSort(b.followers); }
      else if (sortField === 'rating') { valA = a.rating || 0; valB = b.rating || 0; }
      else if (sortField === 'saveDate') {
        const [d1, m1, y1] = (a.saveDate || '').split('-'); const [d2, m2, y2] = (b.saveDate || '').split('-');
        valA = new Date(`${y1}-${m1}-${d1}`).getTime() || 0; valB = new Date(`${y2}-${m2}-${d2}`).getTime() || 0;
      } else { valA = (a[sortField] || '').toString().toLowerCase(); valB = (b[sortField] || '').toString().toLowerCase(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, searchTerm, sortField, sortOrder, filterPlatform, filterTier, filterCampaign, filterWorkflowStatus, filterNiche, filterHasContact, filterLifecycle, duplicateProfileIds]);

  const formatFollowers = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '' || val === 'N/A') return '';
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

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 ${sortField === field ? (isDark ? 'text-violet-400' : 'text-violet-600') : 'opacity-20'} ${sortField === field && sortOrder === 'asc' ? 'rotate-180' : ''}`} />
  );

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange(value === i ? 0 : i)}>
          <Star className={`h-3.5 w-3.5 ${i <= value ? 'fill-amber-400 text-amber-400' : (isDark ? 'text-slate-600' : 'text-slate-300')}`} />
        </button>
      ))}
    </div>
  );

  const ProfileSignals = ({ row }: { row: RestoredData }) => (
    <div className="flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium ${workflowColors[row.workflowStatus || 'New']}`}>
        <Briefcase className="h-2.5 w-2.5" /> {row.workflowStatus || 'New'}
      </span>
      {row.profileNiche && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}
          title={`${row.audienceHint || 'Needs manual review'} · ${Math.round((row.classificationConfidence || 0) * 100)}% confidence`}
        >
          <Filter className="h-2.5 w-2.5" /> {row.profileNiche}
        </span>
      )}
      {row.isWatchlisted && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'}`}>
          <Bell className="h-2.5 w-2.5" /> Watchlist
        </span>
      )}
      {isChangedRecently(row) && (
        <button
          onClick={() => setActiveChangeProfileId(row.id)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
        >
          <History className="h-2.5 w-2.5" /> Changed
        </button>
      )}
    </div>
  );

  const TagSelector = ({ options, value, onChange, color = 'violet' }: { options: string[]; value: string[]; onChange: (val: string[]) => void; color?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        const newTag = inputValue.trim();
        if (!value.includes(newTag)) onChange([...value, newTag]);
        setInputValue('');
      }
    };

    return (
      <div className="relative">
        <button onClick={() => setIsOpen(!isOpen)} className="flex flex-wrap gap-1 items-center min-h-[28px] w-full border rounded-md px-2 py-1 transition-colors hover:border-violet-500/30">
          {value.length > 0 ? value.map(v => (
            <span key={v} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tagColors[color]}`}>
              {v}
              <X className="h-2.5 w-2.5 ml-1 cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); onChange(value.filter(x => x !== v)); }} />
            </span>
          )) : <span className={`text-[10px] ${textM}`}>Thêm thẻ...</span>}
          <ChevronDown className={`h-3 w-3 ${textM} ml-auto shrink-0`} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className={`absolute z-20 mt-1 left-0 min-w-[140px] border rounded-lg py-1 max-h-48 overflow-y-auto shadow-xl ${dropdownBg}`}>
              <div className="px-2 mb-1">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Thêm mới (Enter)"
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full px-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                />
              </div>
              {options.map(opt => (
                <button key={opt} onClick={(e) => { e.stopPropagation(); if (value.includes(opt)) onChange(value.filter(v => v !== opt)); else onChange([...value, opt]); }}
                  className={`w-full text-left px-3 py-1.5 text-xs ${dropItemHover} ${value.includes(opt) ? (isDark ? 'text-violet-400' : 'text-violet-600') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>
                  {value.includes(opt) ? '✓ ' : ''}{opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const clearQuickFilters = () => {
    setSearchTerm('');
    setFilterPlatform('all');
    setFilterTier('all');
    setFilterCampaign('all');
    setFilterHasContact('all');
    setFilterLifecycle('all');
    setFilterWorkflowStatus('all');
    setFilterNiche('all');
  };

  const applyStatFilter = (filter: 'all' | 'tiktok' | 'facebook' | 'phone' | 'email' | 'watchlist' | 'duplicates') => {
    clearQuickFilters();
    if (filter === 'tiktok') setFilterPlatform('TikTok');
    if (filter === 'facebook') setFilterPlatform('Facebook');
    if (filter === 'phone') setFilterHasContact('phone');
    if (filter === 'email') setFilterHasContact('email');
    if (filter === 'watchlist') setFilterLifecycle('watchlist');
    if (filter === 'duplicates') setFilterLifecycle('duplicates');
  };

  const statItems = [
    { label: 'Tổng profiles', value: stats.total, icon: Users, color: textP, bg: isDark ? 'bg-white/5' : 'bg-white', filter: 'all' as const, active: filterPlatform === 'all' && filterHasContact === 'all' && filterLifecycle === 'all' && filterTier === 'all' && filterCampaign === 'all' && filterWorkflowStatus === 'all' && filterNiche === 'all' && !searchTerm },
    { label: 'TikTok', value: stats.tiktok, icon: Globe, color: isDark ? 'text-slate-300' : 'text-slate-600', bg: isDark ? 'bg-slate-700/30' : 'bg-slate-50', filter: 'tiktok' as const, active: filterPlatform === 'TikTok' },
    { label: 'Facebook', value: stats.facebook, icon: Globe, color: isDark ? 'text-blue-300' : 'text-blue-600', bg: isDark ? 'bg-blue-900/20' : 'bg-blue-50', filter: 'facebook' as const, active: filterPlatform === 'Facebook' },
    { label: 'Có SĐT', value: stats.hasPhone, icon: Phone, color: isDark ? 'text-emerald-300' : 'text-emerald-600', bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50', filter: 'phone' as const, active: filterHasContact === 'phone' },
    { label: 'Có Email', value: stats.hasEmail, icon: Mail, color: isDark ? 'text-amber-300' : 'text-amber-600', bg: isDark ? 'bg-amber-900/20' : 'bg-amber-50', filter: 'email' as const, active: filterHasContact === 'email' },
    { label: 'Watchlist', value: stats.watchlisted, icon: Bell, color: isDark ? 'text-violet-300' : 'text-violet-600', bg: isDark ? 'bg-violet-900/20' : 'bg-violet-50', filter: 'watchlist' as const, active: filterLifecycle === 'watchlist' },
    { label: 'Duplicate groups', value: duplicateGroups.length, icon: CopyX, color: isDark ? 'text-rose-300' : 'text-rose-600', bg: isDark ? 'bg-rose-900/20' : 'bg-rose-50', filter: 'duplicates' as const, active: filterLifecycle === 'duplicates' },
  ];

  const activeChangeProfile = activeChangeProfileId ? data.find(row => row.id === activeChangeProfileId) : null;

  return (
    <div className="space-y-5">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statItems.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => applyStatFilter(stat.filter)}
            className={`stat-card rounded-xl p-4 border text-left transition-all ${stat.bg} ${borderC} hover:-translate-y-0.5 hover:shadow-sm ${stat.active ? 'ring-2 ring-violet-500/40' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className={`text-[11px] ${textS}`}>{stat.label}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </button>
        ))}
      </div>

      {/* Workflow Pipeline */}
      <div className={`rounded-xl border p-4 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className={`text-sm font-semibold ${textP}`}>Workflow pipeline</h3>
            <p className={`text-xs ${textM}`}>Theo dõi profile từ New đến Closed để team biết bước tiếp theo.</p>
          </div>
          {filterWorkflowStatus !== 'all' && (
            <button onClick={() => setFilterWorkflowStatus('all')} className={`text-xs ${isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-600 hover:text-violet-500'}`}>
              Xem tất cả
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {WORKFLOW_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => setFilterWorkflowStatus(status)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${workflowColors[status]} ${filterWorkflowStatus === status ? 'ring-2 ring-violet-500/40' : ''}`}
            >
              <div className="text-xs font-semibold">{status}</div>
              <div className="mt-1 text-xl font-bold">{workflowCounts[status]}</div>
            </button>
          ))}
        </div>
      </div>

      {duplicateGroups.length > 0 && (
        <div className={`rounded-xl border p-4 ${cardBg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h3 className={`text-sm font-semibold ${textP}`}>Duplicate identity resolver</h3>
              <p className={`text-xs ${textM}`}>Phát hiện trùng theo URL/handle/contact/bio link/tên. Gộp sẽ giữ profile nhiều CRM data nhất.</p>
            </div>
            <button
              onClick={removeDuplicates}
              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${isDark ? 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
            >
              <CopyX className="h-3.5 w-3.5 mr-1" />
              Merge all ({duplicateGroups.length})
            </button>
          </div>
          <div className="space-y-2">
            {duplicateGroups.slice(0, 3).map(group => (
              <div key={group.id} className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className={`text-xs font-semibold ${textP}`}>{group.reason}</div>
                    <div className={`text-[11px] ${textM}`}>
                      {group.profiles.map(profile => profile.nickname || profile.url).join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => mergeOneDuplicateGroup(group.profiles.map(profile => profile.id))}
                    className={`text-xs font-medium ${isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-600 hover:text-violet-500'}`}
                  >
                    Merge group
                  </button>
                </div>
              </div>
            ))}
            {duplicateGroups.length > 3 && (
              <p className={`text-[11px] ${textM}`}>Còn {duplicateGroups.length - 3} nhóm khác. Dùng Merge all để gộp toàn bộ.</p>
            )}
          </div>
        </div>
      )}

      {/* Main CRM Card */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className={`px-5 py-4 border-b ${borderC} space-y-3`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-base font-semibold ${textP}`}>Scout CRM</h3>
              <span className={`text-xs ${textS}`}>{filteredAndSortedData.length} kết quả</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-900/10 dark:bg-slate-100/10 p-1 rounded-lg">
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? (isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-800 shadow') : 'text-slate-500 hover:text-slate-700'}`}>
                  <List className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? (isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-800 shadow') : 'text-slate-500 hover:text-slate-700'}`}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode('board')} className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? (isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-800 shadow') : 'text-slate-500 hover:text-slate-700'}`}>
                  <Briefcase className="h-4 w-4" />
                </button>
              </div>

              {webhookUrl && (
                <button onClick={refreshFromSheet} disabled={isRefreshing} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-blue-400 hover:bg-blue-500/10' : 'border-slate-200 text-blue-600 hover:bg-blue-50'}`}>
                  {isRefreshing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  {isRefreshing ? 'Đang tải...' : 'Sync Sheet'}
                </button>
              )}

              {onRefreshProfiles && (
                <button onClick={refreshWatchlist} disabled={!data.some(row => row.isWatchlisted)} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-violet-400 hover:bg-violet-500/10' : 'border-slate-200 text-violet-600 hover:bg-violet-50'}`}>
                  <Bell className="h-3.5 w-3.5 mr-1" /> Refresh Watchlist
                </button>
              )}

              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${btnOutline}`}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Import
              </button>
              <button onClick={exportToExcel} disabled={data.length === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-emerald-400 hover:bg-emerald-500/10' : 'border-slate-200 text-emerald-600 hover:bg-emerald-50'}`}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> Xuất Excel
              </button>
              <button onClick={removeDuplicates} disabled={data.length === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-amber-400 hover:bg-amber-500/10' : 'border-slate-200 text-amber-600 hover:bg-amber-50'}`}>
                <CopyX className="h-3.5 w-3.5 mr-1" /> Lọc trùng
              </button>
              <button onClick={clearAll} disabled={data.length === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa hết
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textM}`} />
              <input type="text" placeholder="Tìm kiếm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 w-48 ${inputBg}`} />
            </div>
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Platform</option>
              <option value="TikTok">TikTok</option>
              <option value="Facebook">Facebook</option>
            </select>
            <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Tier</option>
              {dynamicTiers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Campaign</option>
              {dynamicCampaigns.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterWorkflowStatus} onChange={(e) => setFilterWorkflowStatus(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Workflow</option>
              {WORKFLOW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={filterNiche} onChange={(e) => setFilterNiche(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Niche</option>
              {dynamicNiches.map(niche => <option key={niche} value={niche}>{niche}</option>)}
            </select>
            <select value={filterHasContact} onChange={(e) => setFilterHasContact(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Liên hệ</option>
              <option value="phone">Có SĐT</option>
              <option value="email">Có Email</option>
              <option value="both">Có cả SĐT & Email</option>
            </select>
            <select value={filterLifecycle} onChange={(e) => setFilterLifecycle(e.target.value as LifecycleFilter)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả trạng thái CRM</option>
              <option value="watchlist">Watchlist</option>
              <option value="changed_recently">Changed recently</option>
              <option value="duplicates">Duplicate profiles</option>
            </select>

            {selectedIds.size > 0 && (
              <div className={`flex items-center gap-2 ml-2 pl-2 border-l ${borderC}`}>
                <span className={`text-xs ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{selectedIds.size} đã chọn</span>
                <button onClick={bulkDelete} className="text-xs text-red-400 hover:text-red-300">Xóa</button>
                <button onClick={() => bulkSetWatchlist(true)} className={`text-xs ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>Watchlist</button>
                <button onClick={() => bulkSetWatchlist(false)} className={`text-xs ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}>Bỏ watch</button>
                {onRefreshProfiles && (
                  <button onClick={refreshSelected} className={`text-xs ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}>Refresh selected</button>
                )}
                {selectedIds.size >= 2 && selectedIds.size <= 5 && (
                  <button onClick={() => setShowCompareModal(true)} className={`text-xs ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>So sánh</button>
                )}
                <div className="relative">
                  <button onClick={() => setShowBulkActions(!showBulkActions)} className={`text-xs ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>Thao tác ▾</button>
                  {showBulkActions && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowBulkActions(false)} />
                      <div className={`absolute z-20 mt-1 left-0 border rounded-lg py-1 min-w-[200px] flex gap-2 p-2 ${dropdownBg}`}>
                        <div>
                          <div className={`text-[10px] font-medium px-3 py-1 ${textS}`}>Gán Tier</div>
                          {dynamicTiers.map(tier => (
                            <button key={tier} onClick={() => { bulkAssignTier(tier as Tier); setShowBulkActions(false); }}
                              className={`w-full text-left px-3 py-1 text-xs ${dropItemHover} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tier}</button>
                          ))}
                        </div>
                        <div className={`border-l ${borderC} pl-2`}>
                          <div className={`text-[10px] font-medium px-3 py-1 ${textS}`}>Gán Campaign</div>
                          {dynamicCampaigns.map(cam => (
                            <button key={cam} onClick={() => { bulkAssignCampaign(cam); setShowBulkActions(false); }}
                            className={`w-full text-left px-3 py-1 text-xs ${dropItemHover} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{cam}</button>
                          ))}
                        </div>
                        <div className={`border-l ${borderC} pl-2`}>
                          <div className={`text-[10px] font-medium px-3 py-1 ${textS}`}>Workflow</div>
                          {WORKFLOW_STATUSES.map(status => (
                            <button key={status} onClick={() => { bulkSetWorkflowStatus(status); setShowBulkActions(false); }}
                              className={`w-full text-left px-3 py-1 text-xs ${dropItemHover} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{status}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Switching */}
        {viewMode === 'board' ? (
          <div className="p-5">
            <CampaignBoard 
              data={filteredAndSortedData} 
              campaigns={dynamicCampaigns} 
              theme={theme || 'light'} 
              onUpdateRow={updateRow} 
            />
          </div>
        ) : viewMode === 'card' ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAndSortedData.length === 0 ? (
              <div className={`col-span-full py-12 text-center ${textM}`}>
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Chưa có dữ liệu lưu trữ.</p>
              </div>
            ) : filteredAndSortedData.map(row => (
              <div key={row.id} className={`rounded-xl border p-4 transition-all group ${cardBg} ${isDark ? 'hover:border-violet-500/20' : 'hover:border-violet-300'}`}>
                <div className="flex items-start gap-3 mb-3">
                  {row.profilePic ? (
                    <img src={row.profilePic} alt="" className={`w-10 h-10 rounded-full object-cover border ${borderC}`} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${textP}`}>{row.nickname || 'N/A'}</div>
                    <div className={`text-[11px] ${textS} truncate`}>{row.channelId ? `@${row.channelId}` : '-'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${row.platform === 'Facebook' ? tagColors.blue : (isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                        {row.platform || 'TikTok'}
                      </span>
                      {row.followers && <span className={`text-[11px] ${textP} font-medium`}>{formatFollowers(row.followers)}</span>}
                    </div>
                    <div className="mt-1">
                      <ProfileSignals row={row} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => toggleWatchlist(row)} className={`${row.isWatchlisted ? (isDark ? 'text-violet-300' : 'text-violet-600') : (isDark ? 'text-slate-500 hover:text-violet-300' : 'text-slate-300 hover:text-violet-600')}`}>
                      {row.isWatchlisted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => deleteRow(row.id)} className={`${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-all`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <StarRating value={row.rating || 0} onChange={(v) => updateRow(row.id, 'rating', v)} />
                <div className="mt-3">
                  <select
                    value={row.workflowStatus || 'New'}
                    onChange={(e) => updateWorkflowStatus(row, e.target.value as WorkflowStatus)}
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                  >
                    {WORKFLOW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div className="mt-2 space-y-1">
                  {row.phone && row.phone !== 'N/A' && <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><Phone className="h-3 w-3" /> {row.phone}</div>}
                  {row.email && row.email !== 'N/A' && <div className={`text-xs ${textS} flex items-center gap-1 truncate`}><Mail className="h-3 w-3 shrink-0" /> {row.email}</div>}
                  {row.audienceHint && <div className={`text-[11px] ${textM} line-clamp-2`} title={row.audienceHint}>{row.audienceHint}</div>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.tier.map(t => <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.violet}`}>{t}</span>)}
                  {row.location.map(l => <span key={l} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.emerald}`}>{l}</span>)}
                  {row.group.map(g => <span key={g} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.blue}`}>{g}</span>)}
                  {(row.sow || []).map(s => <span key={s} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-pink-900/40 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>{s}</span>)}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <a href={row.url} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                    <LinkIcon className="h-3 w-3" /> Profile
                  </a>
                  <button onClick={() => setActiveRateProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-500'}`}>
                    <History className="h-3 w-3" /> Báo giá {row.rateHistory?.length ? `(${row.rateHistory.length})` : ''}
                  </button>
                  {row.changeHistory && row.changeHistory.length > 0 && (
                    <button onClick={() => setActiveChangeProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-500'}`}>
                      <Eye className="h-3 w-3" /> Changes
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className={`text-[11px] uppercase border-b ${borderC} ${isDark ? 'text-slate-400 bg-white/[0.02]' : 'text-slate-500 bg-slate-50'}`}>
                <tr>
                  <th className="px-3 py-3 w-8 text-center">
                    <input type="checkbox" checked={selectedIds.size === filteredAndSortedData.length && filteredAndSortedData.length > 0} onChange={selectAll} className="rounded" />
                  </th>
                  <th className="px-3 py-3 font-medium w-10 text-center">#</th>
                  <th className="px-3 py-3 font-medium w-20 cursor-pointer" onClick={() => handleSort('saveDate')}>
                    <div className="flex items-center">Ngày <SortIcon field="saveDate" /></div>
                  </th>
                  <th className="px-3 py-3 font-medium w-20">Platform</th>
                  <th className="px-3 py-3 font-medium w-44 cursor-pointer" onClick={() => handleSort('nickname')}>
                    <div className="flex items-center">Tên / ID <SortIcon field="nickname" /></div>
                  </th>
                  <th className="px-3 py-3 font-medium w-24 text-right cursor-pointer" onClick={() => handleSort('followers')}>
                    <div className="flex items-center justify-end">Followers <SortIcon field="followers" /></div>
                  </th>
                  <th className="px-3 py-3 font-medium w-24 text-right">Avg View</th>
                  <th className="px-3 py-3 font-medium w-28 text-right">Avg Engage</th>
                  <th className="px-3 py-3 font-medium w-28">SĐT</th>
                  <th className="px-3 py-3 font-medium w-40">Email</th>
                  <th className="px-3 py-3 font-medium w-28">Link Bio</th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">Workflow</th>
                  <th className="px-3 py-3 font-medium min-w-[150px]">Classification</th>
                  <th className="px-3 py-3 font-medium w-20 text-center cursor-pointer" onClick={() => handleSort('rating')}>
                    <div className="flex items-center justify-center">Rating <SortIcon field="rating" /></div>
                  </th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">Tier</th>
                  <th className="px-3 py-3 font-medium min-w-[100px]">Vị trí</th>
                  <th className="px-3 py-3 font-medium min-w-[120px]">Nhóm</th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">Campaign</th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">SOW</th>
                  <th className="px-3 py-3 font-medium min-w-[200px]">Ghi chú</th>
                  <th className="px-3 py-3 font-medium w-12 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${divideC}`}>
                {filteredAndSortedData.length === 0 ? (
                  <tr><td colSpan={21} className={`px-4 py-12 text-center ${textM}`}>
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>Chưa có dữ liệu lưu trữ.</p>
                  </td></tr>
                ) : filteredAndSortedData.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={(event) => handleProfileRowClick(event, row.id)}
                    className={`${rowHover} ${selectedIds.has(row.id) ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : ''} cursor-pointer transition-colors`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} onClick={(event) => event.stopPropagation()} className="rounded" />
                    </td>
                    <td className={`px-3 py-3 text-center ${textM} text-xs`}>{index + 1}</td>
                    <td className={`px-3 py-3 ${textS} text-xs whitespace-nowrap`}>{row.saveDate}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${row.platform === 'Facebook' ? tagColors.blue : (isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                        {row.platform || 'TikTok'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className={`font-medium ${textP} truncate max-w-[11rem]`}>{row.nickname || '-'}</div>
                      <div className={`text-[11px] ${textM} truncate max-w-[11rem]`}>{row.channelId ? `@${row.channelId}` : '-'}</div>
                      <div className="mt-1">
                        <ProfileSignals row={row} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <a href={row.url} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                          <LinkIcon className="h-2.5 w-2.5 shrink-0" /> Link
                        </a>
                        <button onClick={() => setActiveRateProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-500'}`}>
                          <History className="h-2.5 w-2.5" /> Thêm giá {row.rateHistory?.length ? `(${row.rateHistory.length})` : ''}
                        </button>
                        {row.changeHistory && row.changeHistory.length > 0 && (
                          <button onClick={() => setActiveChangeProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-500'}`}>
                            <Eye className="h-2.5 w-2.5" /> Changes
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${textP}`}>{formatFollowers(row.followers) || '-'}</td>
                    <td className={`px-3 py-3 text-right text-xs font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                      {row.platform === 'TikTok' && row.averageView ? formatNum(row.averageView) : '-'}
                    </td>
                    <td className={`px-3 py-3 text-right text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`} title={row.platform === 'TikTok' && row.averageEngagement ? '❤️ Likes + 💬 Comments + 🔄 Shares + 🔖 Saves' : ''}>
                      {row.platform === 'TikTok' && row.averageEngagement ? formatNum(row.averageEngagement) : '-'}
                    </td>
                    <td className={`px-3 py-3 font-medium text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{row.phone && row.phone !== 'N/A' ? row.phone : '-'}</td>
                    <td className={`px-3 py-3 ${textS} text-xs truncate max-w-[10rem]`}>{row.email && row.email !== 'N/A' ? row.email : '-'}</td>
                    <td className={`px-3 py-3 ${textS} text-xs`}>
                      {row.bioLink && row.bioLink !== 'N/A' ? (
                        <a href={row.bioLink.startsWith('http') ? row.bioLink : `https://${row.bioLink}`} target="_blank" rel="noreferrer"
                          className={`flex items-center gap-1 ${isDark ? 'hover:text-violet-400' : 'hover:text-violet-600'} transition-colors`}>
                          <LinkIcon className="h-3 w-3 shrink-0" /> Link
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={row.workflowStatus || 'New'}
                        onChange={(e) => updateWorkflowStatus(row, e.target.value as WorkflowStatus)}
                        className={`min-w-[120px] px-2 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                      >
                        {WORKFLOW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textS}`}>
                      <div className={`font-medium ${textP}`}>{row.profileNiche || 'Unclassified'}</div>
                      <div className="truncate max-w-[10rem]" title={row.audienceHint}>{row.audienceHint || 'Needs manual review'}</div>
                      <div className={`text-[10px] ${textM}`}>{Math.round((row.classificationConfidence || 0) * 100)}% confidence</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StarRating value={row.rating || 0} onChange={(v) => updateRow(row.id, 'rating', v)} />
                    </td>
                    <td className={`px-3 py-3 font-medium text-xs ${textP}`}>
                      <div className="w-full min-w-[120px]">
                        <TagSelector options={dynamicTiers} value={row.tier} onChange={(val) => updateRow(row.id, 'tier', val as Tier[])} color="violet" />
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textS}`}>
                      <div className="w-full min-w-[100px]">
                        <TagSelector options={dynamicLocations} value={row.location} onChange={(val) => updateRow(row.id, 'location', val)} color="emerald" />
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textS}`}>
                      <div className="w-full min-w-[120px]">
                        <TagSelector options={dynamicGroups} value={row.group} onChange={(val) => updateRow(row.id, 'group', val)} color="blue" />
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textS}`}>
                      <div className="w-full min-w-[140px]">
                        <TagSelector options={dynamicCampaigns} value={row.campaign} onChange={(val) => updateRow(row.id, 'campaign', val)} color="violet" />
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-xs ${textS}`}>
                      <div className="w-full min-w-[130px]">
                        <TagSelector options={dynamicSow} value={row.sow || []} onChange={(val) => updateRow(row.id, 'sow', val)} color="emerald" />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        {(row.notes || []).map(note => (
                          <div key={note.id} className="flex items-start gap-1 group/note">
                            <span className={`text-[10px] ${textS} flex-1`}>{note.text}</span>
                            <button onClick={() => deleteNote(row.id, note.id)} className={`opacity-0 group-hover/note:opacity-100 ${isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-all shrink-0`}>
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                        {editingNoteId === row.id ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1 flex-wrap mb-1.5">
                              {NOTE_TEMPLATES.map(tmpl => (
                                <button key={tmpl} onClick={() => addNote(row.id, tmpl)} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-white/10 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-500/30' : 'border-slate-200 text-slate-600 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'}`}>
                                  {tmpl}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote(row.id)}
                                placeholder="Ghi chú..." className={`flex-1 px-2 py-0.5 text-[10px] rounded border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`} autoFocus />
                              <button onClick={() => addNote(row.id)} className={`${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                                <CheckCircle2 className="h-3 w-3" />
                              </button>
                              <button onClick={() => { setEditingNoteId(null); setNoteText(''); }} className={`${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setEditingNoteId(row.id)} className={`text-[10px] ${textM} hover:${isDark ? 'text-violet-400' : 'text-violet-600'} flex items-center gap-1 transition-colors`}>
                            <StickyNote className="h-2.5 w-2.5" /> Thêm ghi chú
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => toggleWatchlist(row)} className={`${row.isWatchlisted ? (isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-600 hover:text-violet-500') : (isDark ? 'text-slate-600 hover:text-violet-300' : 'text-slate-300 hover:text-violet-500')} transition-colors`} title={row.isWatchlisted ? 'Bỏ Watchlist' : 'Thêm Watchlist'}>
                          {row.isWatchlisted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => deleteRow(row.id)} className={`${isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-colors`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompareModal 
        isOpen={showCompareModal} 
        onClose={() => setShowCompareModal(false)} 
        profiles={data.filter(p => selectedIds.has(p.id))} 
        theme={theme} 
      />

      {activeChangeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className={`${isDark ? 'bg-black/60' : 'bg-slate-900/40'} absolute inset-0 backdrop-blur-sm`} onClick={() => setActiveChangeProfileId(null)} />
          <div className={`relative w-full max-w-3xl max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`px-5 py-4 border-b ${borderC} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-semibold ${textP}`}>Change history</h3>
                <p className={`text-xs ${textM}`}>{activeChangeProfile.nickname || activeChangeProfile.url}</p>
              </div>
              <button onClick={() => setActiveChangeProfileId(null)} className={`p-2 rounded-xl transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {!activeChangeProfile.changeHistory || activeChangeProfile.changeHistory.length === 0 ? (
                <p className={`text-sm ${textM}`}>Chưa có thay đổi nào được ghi nhận.</p>
              ) : activeChangeProfile.changeHistory.map(record => (
                <div key={record.id} className={`rounded-xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                    <div className={`text-sm font-medium ${textP}`}>
                      {new Date(record.detectedAt).toLocaleString('vi-VN')}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>{record.source}</span>
                  </div>
                  <div className="space-y-2">
                    {record.changes.map(change => (
                      <div key={`${record.id}-${change.field}`} className={`grid grid-cols-1 md:grid-cols-[120px_1fr_1fr] gap-2 text-xs ${textS}`}>
                        <div className={`font-medium ${textP}`}>{change.label}</div>
                        <div className={`rounded-lg px-2 py-1 ${isDark ? 'bg-red-500/10 text-red-200' : 'bg-red-50 text-red-700'}`}>
                          Cũ: {change.oldValue ?? '-'}
                        </div>
                        <div className={`rounded-lg px-2 py-1 ${isDark ? 'bg-emerald-500/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>
                          Mới: {change.newValue ?? '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <RateHistoryModal
        isOpen={!!activeRateProfileId}
        onClose={() => setActiveRateProfileId(null)}
        profile={data.find(p => p.id === activeRateProfileId) || null}
        onUpdateRates={(id, rates) => updateRow(id, 'rateHistory', rates)}
        theme={theme}
      />
    </div>
  );
}
