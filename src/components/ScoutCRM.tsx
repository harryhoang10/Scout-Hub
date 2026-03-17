import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Trash2, CopyX, Star, Users, Briefcase, FileDown,
  LayoutGrid, List, Search, ArrowUpDown, Loader2, Link as LinkIcon, Phone, Mail, Filter, Upload, RefreshCw, X, CheckCircle2, StickyNote, History, ChevronDown, Globe
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RestoredData, Tier, ProfileNote } from '../types';
import { TagSelector } from './TagSelector';
import { upsertToSheet, deleteFromSheet } from '../lib/api';
import { CompareModal } from './CompareModal';
import { RateHistoryModal } from './RateHistoryModal';
import { CampaignBoard } from './CampaignBoard';
import { DashboardStats } from './DashboardStats';

const MAX_STARS = 5;
const NOTE_TEMPLATES = ["Đã liên hệ", "Chờ báo giá", "Nắm giá", "Từ chối"];
const LOCATION_OPTIONS = ['Bắc', 'Trung', 'Nam'];
const GROUP_OPTIONS = ['Beauty', 'Fashion', 'Food', 'Tech', 'Education', 'Entertainment', 'Lifestyle', 'Travel', 'Health', 'Sports'];
const CAMPAIGN_OPTIONS = ['Tết 2026', 'Summer Promo', 'Black Friday', 'Launch Event', 'Brand Ambassador'];

const TIER_OPTIONS: Tier[] = ['Macro', 'Micro', 'Nano', 'UGC'];
type SortField = 'saveDate' | 'nickname' | 'followers' | 'rating';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'card' | 'board';

interface ScoutCRMProps {
  data: RestoredData[];
  onUpdateData: (data: RestoredData[]) => void;
  webhookUrl?: string;
  theme?: string;
}

export function ScoutCRM({ data, onUpdateData, webhookUrl, theme }: ScoutCRMProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('saveDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterHasContact, setFilterHasContact] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
    return { total, tiktok, facebook, hasPhone, hasEmail, rated };
  }, [data]);

  const dynamicTiers = useMemo(() => Array.from(new Set([...TIER_OPTIONS, ...data.flatMap(d => d.tier)])), [data]);
  const dynamicLocations = useMemo(() => Array.from(new Set([...LOCATION_OPTIONS, ...data.flatMap(d => d.location)])), [data]);
  const dynamicGroups = useMemo(() => Array.from(new Set([...GROUP_OPTIONS, ...data.flatMap(d => d.group)])), [data]);
  const dynamicCampaigns = useMemo(() => Array.from(new Set([...CAMPAIGN_OPTIONS, ...data.flatMap(d => d.campaign)])), [data]);

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
          phone: row['SĐT'] || row.phone || '',
          email: row['Email'] || row.email || '',
          bioLink: row['Link Bio'] || row.bioLink || '',
          bio: row['Bio'] || row.bio || '',
          profilePic: row['Avatar'] || row.profilePic || '',
          platform: row['Platform'] || row.platform || 'TikTok',
          profileType: row['Profile'] || 'Individual',
          tier: row['Tier'] ? row['Tier'].split(', ') : [],
          location: row['Vị trí'] ? row['Vị trí'].split(', ') : [],
          group: [],
          campaign: [],
          notes: [],
          rating: 0,
          saveDate: row['Ngày'] || row.saveDate || new Date().toLocaleDateString('vi-VN'),
        })).filter((r: any) => r.url);
        
        // Merge: add new items that don't exist by URL
        const existingUrls = new Set(data.map(d => d.url));
        const newItems = imported.filter(i => !existingUrls.has(i.url));
        if (newItems.length > 0) {
          onUpdateData([...data, ...newItems]);
          alert(`Đã import ${newItems.length} profiles mới từ Google Sheet.`);
        } else {
          alert('Không có profiles mới từ Google Sheet.');
        }
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
          phone: row['SĐT'] || row['phone'] || '',
          email: row['Email'] || row['email'] || '',
          bioLink: row['Link Bio'] || row['bioLink'] || '',
          bio: row['Tiểu sử (Bio)'] || row['bio'] || row['Bio'] || '',
          profilePic: row['Link ảnh'] || row['profilePic'] || row['Avatar'] || '',
          platform: row['Platform'] || row['platform'] || 'TikTok',
          profileType: row['Profile'] || row['profileType'] || 'Individual',
          tier: (row['Tier'] ? row['Tier'].split(',').map((s: string) => s.trim()).filter(Boolean) : []) as Tier[],
          location: row['Vị trí'] ? row['Vị trí'].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          group: row['Nhóm Influencer'] ? row['Nhóm Influencer'].split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          campaign: [],
          notes: [],
          rating: row['Rating'] || 0,
          saveDate: row['Ngày lưu trữ'] || row['Save Date'] || saveDate,
        })).filter(r => r.url);
        onUpdateData([...data, ...newRows]);
        alert(`Đã import ${newRows.length} dòng.`);
      } catch (error) {
        alert("Lỗi khi đọc file.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      'SĐT': row.phone || '',
      'Email': row.email || '',
      'Link Bio': row.bioLink || '',
      'Link': row.url,
      'Bio': row.bio || '',
      'Avatar': row.profilePic || '',
      'Tier': row.tier.join(', '),
      'Vị trí': row.location.join(', '),
      'Nhóm Influencer': row.group.join(', '),
      'Campaign': row.campaign.join(', '),
      'Rating': row.rating || 0,
      'Ghi chú': (row.notes || []).map(n => n.text).join(' | '),
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
    const unique: RestoredData[] = [];
    const seen = new Set<string>();
    data.forEach(row => { if (!seen.has(row.url)) { seen.add(row.url); unique.push(row); } });
    const removed = data.length - unique.length;
    if (removed > 0) { onUpdateData(unique); alert(`Đã loại bỏ ${removed} trùng lặp.`); }
    else alert("Không có trùng lặp.");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const addNote = (id: string) => {
    if (!noteText.trim()) return;
    const row = data.find(r => r.id === id);
    if (row) {
      updateRow(id, 'notes', [...(row.notes || []), {
        id: Math.random().toString(36).substring(7),
        text: noteText.trim(),
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
    if (filterHasContact === 'phone') result = result.filter(r => r.phone && r.phone !== 'N/A' && r.phone !== '-');
    else if (filterHasContact === 'email') result = result.filter(r => r.email && r.email !== 'N/A' && r.email !== '-');
    else if (filterHasContact === 'both') result = result.filter(r => (r.phone && r.phone !== 'N/A' && r.phone !== '-') && (r.email && r.email !== 'N/A' && r.email !== '-'));
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.nickname?.toLowerCase().includes(lower)) || (r.channelId?.toLowerCase().includes(lower)) ||
        (r.bio?.toLowerCase().includes(lower)) || (r.tier.some(t => t.toLowerCase().includes(lower))) ||
        (r.location.some(l => l.toLowerCase().includes(lower))) || (r.group.some(g => g.toLowerCase().includes(lower))) ||
        (r.campaign.some(c => c.toLowerCase().includes(lower))) ||
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
  }, [data, searchTerm, sortField, sortOrder, filterPlatform, filterTier, filterCampaign, filterHasContact]);

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

  const statItems = [
    { label: 'Tổng profiles', value: stats.total, icon: Users, color: textP, bg: isDark ? 'bg-white/5' : 'bg-white' },
    { label: 'TikTok', value: stats.tiktok, icon: Globe, color: isDark ? 'text-slate-300' : 'text-slate-600', bg: isDark ? 'bg-slate-700/30' : 'bg-slate-50' },
    { label: 'Facebook', value: stats.facebook, icon: Globe, color: isDark ? 'text-blue-300' : 'text-blue-600', bg: isDark ? 'bg-blue-900/20' : 'bg-blue-50' },
    { label: 'Có SĐT', value: stats.hasPhone, icon: Phone, color: isDark ? 'text-emerald-300' : 'text-emerald-600', bg: isDark ? 'bg-emerald-900/20' : 'bg-emerald-50' },
    { label: 'Có Email', value: stats.hasEmail, icon: Mail, color: isDark ? 'text-amber-300' : 'text-amber-600', bg: isDark ? 'bg-amber-900/20' : 'bg-amber-50' },
    { label: 'Đã đánh giá', value: stats.rated, icon: Star, color: isDark ? 'text-violet-300' : 'text-violet-600', bg: isDark ? 'bg-violet-900/20' : 'bg-violet-50' },
  ];

  return (
    <div className="space-y-5">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statItems.map((stat) => (
          <div key={stat.label} className={`stat-card rounded-xl p-4 border ${stat.bg} ${borderC}`}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className={`text-[11px] ${textS}`}>{stat.label}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Overview Dashboard */}
      <DashboardStats data={data} theme={theme || 'light'} />

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
            <select value={filterHasContact} onChange={(e) => setFilterHasContact(e.target.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer ${inputBg}`}>
              <option value="all">Tất cả Liên hệ</option>
              <option value="phone">Có SĐT</option>
              <option value="email">Có Email</option>
              <option value="both">Có cả SĐT & Email</option>
            </select>

            {selectedIds.size > 0 && (
              <div className={`flex items-center gap-2 ml-2 pl-2 border-l ${borderC}`}>
                <span className={`text-xs ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{selectedIds.size} đã chọn</span>
                <button onClick={bulkDelete} className="text-xs text-red-400 hover:text-red-300">Xóa</button>
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
                  </div>
                  <button onClick={() => deleteRow(row.id)} className={`opacity-0 group-hover:opacity-100 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-all`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <StarRating value={row.rating || 0} onChange={(v) => updateRow(row.id, 'rating', v)} />
                <div className="mt-2 space-y-1">
                  {row.phone && row.phone !== 'N/A' && <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><Phone className="h-3 w-3" /> {row.phone}</div>}
                  {row.email && row.email !== 'N/A' && <div className={`text-xs ${textS} flex items-center gap-1 truncate`}><Mail className="h-3 w-3 shrink-0" /> {row.email}</div>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.tier.map(t => <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.violet}`}>{t}</span>)}
                  {row.location.map(l => <span key={l} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.emerald}`}>{l}</span>)}
                  {row.group.map(g => <span key={g} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.blue}`}>{g}</span>)}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <a href={row.url} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                    <LinkIcon className="h-3 w-3" /> Profile
                  </a>
                  <button onClick={() => setActiveRateProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-500'}`}>
                    <History className="h-3 w-3" /> Báo giá {row.rateHistory?.length ? `(${row.rateHistory.length})` : ''}
                  </button>
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
                  <th className="px-3 py-3 font-medium w-28">SĐT</th>
                  <th className="px-3 py-3 font-medium w-40">Email</th>
                  <th className="px-3 py-3 font-medium w-28">Link Bio</th>
                  <th className="px-3 py-3 font-medium w-20 text-center cursor-pointer" onClick={() => handleSort('rating')}>
                    <div className="flex items-center justify-center">Rating <SortIcon field="rating" /></div>
                  </th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">Tier</th>
                  <th className="px-3 py-3 font-medium min-w-[100px]">Vị trí</th>
                  <th className="px-3 py-3 font-medium min-w-[120px]">Nhóm</th>
                  <th className="px-3 py-3 font-medium min-w-[130px]">Campaign</th>
                  <th className="px-3 py-3 font-medium min-w-[200px]">Ghi chú</th>
                  <th className="px-3 py-3 font-medium w-12 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${divideC}`}>
                {filteredAndSortedData.length === 0 ? (
                  <tr><td colSpan={15} className={`px-4 py-12 text-center ${textM}`}>
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>Chưa có dữ liệu lưu trữ.</p>
                  </td></tr>
                ) : filteredAndSortedData.map((row, index) => (
                  <tr key={row.id} className={`${rowHover} transition-colors`}>
                    <td className="px-3 py-3 text-center">
                      <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <a href={row.url} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                          <LinkIcon className="h-2.5 w-2.5 shrink-0" /> Link
                        </a>
                        <button onClick={() => setActiveRateProfileId(row.id)} className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-500'}`}>
                          <History className="h-2.5 w-2.5" /> Thêm giá {row.rateHistory?.length ? `(${row.rateHistory.length})` : ''}
                        </button>
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${textP}`}>{formatFollowers(row.followers) || '-'}</td>
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
                                <button key={tmpl} onClick={() => { setNoteText(tmpl); addNote(row.id); }} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-white/10 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-500/30' : 'border-slate-200 text-slate-600 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'}`}>
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
                      <button onClick={() => deleteRow(row.id)} className={`${isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-colors`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
