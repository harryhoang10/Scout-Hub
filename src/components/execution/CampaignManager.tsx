import React, { useState } from 'react';
import { Campaign, ExecutionProfile, RestoredData } from '../../types';
import { 
  Rocket, Plus, Briefcase, Calendar, DollarSign, Edit3, Trash2, 
  Search, Users, FolderKanban, Check, X, AlertTriangle, ArrowRight, Coins
} from 'lucide-react';

interface CampaignManagerProps {
  campaigns: Campaign[];
  executionProfiles: ExecutionProfile[];
  crmProfiles: RestoredData[];
  onSelectCampaign: (campaignId: string) => void;
  onAddCampaign: (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onUpdateCampaignProfiles: (campaignId: string, profileIds: string[]) => void;
  theme: 'light' | 'dark';
}

export default function CampaignManager({
  campaigns,
  executionProfiles,
  crmProfiles,
  onSelectCampaign,
  onAddCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onUpdateCampaignProfiles,
  theme
}: CampaignManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState<string | null>(null); // campaignId
  const [sortBy, setSortBy] = useState<'date-desc' | 'budget-desc' | 'budget-asc' | 'kol-count' | 'burn-rate'>('date-desc');
  
  // Form states for new campaign
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newChargeCode, setNewChargeCode] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newStatus, setNewStatus] = useState<Campaign['status']>('active');

  // Search state for profile selector modal
  const [profileSearch, setProfileSearch] = useState('');
  const [filterCRMByTagOnly, setFilterCRMByTagOnly] = useState(true);

  // Get unique brands from crmProfiles
  const crmBrands = React.useMemo(() => {
    return Array.from(new Set(crmProfiles.map(p => p.projectName).filter(Boolean))) as string[];
  }, [crmProfiles]);

  const [brandSelectMode, setBrandSelectMode] = useState<'select' | 'text'>(crmBrands.length > 0 ? 'select' : 'text');

  // Get unique campaign names from crmProfiles
  const crmCampaignNames = React.useMemo(() => {
    return Array.from(new Set(crmProfiles.flatMap(p => p.campaign || []).filter(Boolean))) as string[];
  }, [crmProfiles]);

  const [campaignNameMode, setCampaignNameMode] = useState<'select' | 'text'>(crmCampaignNames.length > 0 ? 'select' : 'text');

  // Editable Charge Code states
  const [editingChargeCodeId, setEditingChargeCodeId] = useState<string | null>(null);
  const [tempChargeCode, setTempChargeCode] = useState('');

  const isDark = theme === 'dark';

  // Styling tokens
  const cardBg = isDark 
    ? 'bg-white/[0.02] border-white/[0.06] hover:border-violet-500/30 hover:bg-white/[0.04]' 
    : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-lg';
  const modalBg = isDark ? 'bg-[#0f0f15] border-white/[0.08]' : 'bg-white border-slate-200';
  const inputBg = isDark 
    ? 'bg-white/[0.04] border-white/[0.08] text-white focus:bg-white/[0.06] focus:border-violet-500/80' 
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-violet-500/80';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';

  // Handlers
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim() || !newBrand.trim()) return;

    onAddCampaign({
      name: newCampaignName.trim(),
      chargeCode: newChargeCode.trim() || 'N/A',
      brand: newBrand.trim(),
      description: newDescription.trim(),
      startDate: newStartDate || new Date().toISOString().split('T')[0],
      endDate: newEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      budget: newBudget ? parseFloat(newBudget) : undefined,
      status: newStatus
    });

    // Reset
    setNewCampaignName('');
    setNewChargeCode('');
    setNewBrand('');
    setNewDescription('');
    setNewStartDate('');
    setNewEndDate('');
    setNewBudget('');
    setNewStatus('active');
    setShowCreateModal(false);
  };

  const handleChargeCodeSave = (campaign: Campaign) => {
    if (tempChargeCode.trim() !== campaign.chargeCode) {
      onUpdateCampaign({
        ...campaign,
        chargeCode: tempChargeCode.trim() || 'N/A',
        updatedAt: new Date().toISOString()
      });
    }
    setEditingChargeCodeId(null);
  };

  // Filter & Sort campaigns
  const filteredCampaigns = React.useMemo(() => {
    const filtered = campaigns.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.chargeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aProfiles = executionProfiles.filter(ep => ep.campaignId === a.id);
      const bProfiles = executionProfiles.filter(ep => ep.campaignId === b.id);
      
      const aSpent = aProfiles.reduce((sum, ep) => sum + (ep.totalCost || 0), 0);
      const bSpent = bProfiles.reduce((sum, ep) => sum + (ep.totalCost || 0), 0);

      switch (sortBy) {
        case 'budget-desc':
          return (b.budget || 0) - (a.budget || 0);
        case 'budget-asc':
          return (a.budget || 0) - (b.budget || 0);
        case 'kol-count':
          return bProfiles.length - aProfiles.length;
        case 'burn-rate': {
          const aRate = a.budget ? aSpent / a.budget : 0;
          const bRate = b.budget ? bSpent / b.budget : 0;
          return bRate - aRate;
        }
        case 'date-desc':
        default:
          return new Date(b.startDate || b.createdAt || 0).getTime() - new Date(a.startDate || a.createdAt || 0).getTime();
      }
    });
  }, [campaigns, executionProfiles, searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search Input & Sort */}
        <div className="flex flex-1 flex-col sm:flex-row gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm chiến dịch, nhãn hàng, charge code..."
              className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all ${inputBg}`}
            />
          </div>
          
          {/* Sorting Option */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer ${inputBg}`}
          >
            <option value="date-desc">📅 Mới nhất</option>
            <option value="budget-desc">💰 Ngân sách: Cao ➔ Thấp</option>
            <option value="budget-asc">💰 Ngân sách: Thấp ➔ Cao</option>
            <option value="kol-count">👥 Số lượng KOLs</option>
            <option value="burn-rate">🔥 Tốc độ chi tiêu (Burn rate)</option>
          </select>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Tạo Campaign</span>
        </button>
      </div>

      {/* Campaigns Listing */}
      {filteredCampaigns.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border ${isDark ? 'bg-white/[0.01] border-white/[0.04]' : 'bg-slate-50/50 border-slate-200'}`}>
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 mb-4 animate-bounce-slow">
            <FolderKanban className="h-8 w-8" />
          </div>
          <h3 className={`text-lg font-bold ${textPrimary} mb-2`}>
            {searchTerm ? 'Không tìm thấy chiến dịch nào' : 'Chưa có chiến dịch quản lý triển khai'}
          </h3>
          <p className={`text-sm ${textSecondary} max-w-sm mb-6`}>
            {searchTerm 
              ? 'Thử thay đổi từ khoá tìm kiếm khác để tìm thấy chiến dịch mong muốn.' 
              : 'Hãy bắt đầu tạo chiến dịch triển khai đầu tiên của bạn để quản lý các KOL profile theo bảng Kanban.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Khởi tạo ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCampaigns.map(campaign => {
            // Get profiles in this campaign
            const campaignProfiles = executionProfiles.filter(ep => ep.campaignId === campaign.id);
            const totalCount = campaignProfiles.length;
            const connectingCount = campaignProfiles.filter(ep => ep.phase === 'connecting').length;
            const launchingCount = campaignProfiles.filter(ep => ep.phase === 'launching').length;
            const wrappingCount = campaignProfiles.filter(ep => ep.phase === 'wrapping').length;
            
            // Calculate total spent
            const totalSpent = campaignProfiles.reduce((acc, ep) => acc + (ep.totalCost || 0), 0);
            
            // Calculate progress bar segments
            const totalCountNonNull = totalCount || 1;
            const connectingPct = (connectingCount / totalCountNonNull) * 100;
            const launchingPct = (launchingCount / totalCountNonNull) * 100;
            const wrappingPct = (wrappingCount / totalCountNonNull) * 100;

            const isBudgetOver = campaign.budget && totalSpent > campaign.budget;

            return (
              <div 
                key={campaign.id}
                className={`group relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-sm ${cardBg}`}
                onClick={() => onSelectCampaign(campaign.id)}
              >
                <div>
                  {/* Card Header: Brand, Status, Actions */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                      isDark ? 'bg-violet-500/10 text-violet-400 border border-violet-500/15' : 'bg-violet-50 text-violet-700 border border-violet-200'
                    }`}>
                      {campaign.brand}
                    </span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        campaign.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : campaign.status === 'completed'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : campaign.status === 'paused'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {campaign.status === 'active' ? 'Đang chạy' : campaign.status === 'completed' ? 'Hoàn thành' : campaign.status === 'paused' ? 'Tạm dừng' : 'Bản nháp'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm('Bạn chắc chắn muốn xoá chiến dịch này và toàn bộ dữ liệu triển khai của nó?')) {
                            onDeleteCampaign(campaign.id);
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                          isDark ? 'hover:bg-rose-500/10 hover:border-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                        }`}
                        title="Xoá chiến dịch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h4 className={`text-base font-bold ${textPrimary} group-hover:text-violet-400 transition-colors mb-1 line-clamp-1`}>
                    {campaign.name}
                  </h4>
                  {campaign.description && (
                    <p className={`text-xs ${textSecondary} mb-4 line-clamp-2 min-h-[2rem]`}>
                      {campaign.description}
                    </p>
                  )}

                  {/* Charge Code & Dates */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                    <div 
                      className={`flex flex-col p-2 rounded-xl border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <span className={`text-[10px] uppercase font-semibold ${textMuted} mb-0.5`}>Charge Code</span>
                      {editingChargeCodeId === campaign.id ? (
                        <input
                          type="text"
                          value={tempChargeCode}
                          onChange={e => setTempChargeCode(e.target.value)}
                          onBlur={() => handleChargeCodeSave(campaign)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleChargeCodeSave(campaign);
                            if (e.key === 'Escape') setEditingChargeCodeId(null);
                          }}
                          autoFocus
                          className={`w-full px-1.5 py-0.5 text-xs font-semibold rounded-md border focus:outline-none ${inputBg}`}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1 group/cc">
                          <span className={`font-semibold ${textPrimary}`}>{campaign.chargeCode}</span>
                          <button
                            onClick={() => {
                              setEditingChargeCodeId(campaign.id);
                              setTempChargeCode(campaign.chargeCode);
                            }}
                            className={`p-0.5 opacity-0 group-hover/cc:opacity-100 transition-opacity rounded hover:bg-slate-500/10 ${textSecondary}`}
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={`flex flex-col p-2 rounded-xl border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'}`}>
                      <span className={`text-[10px] uppercase font-semibold ${textMuted} mb-0.5`}>Thời gian</span>
                      <span className={`font-semibold ${textPrimary} truncate flex items-center gap-1`}>
                        <Calendar className="h-3 w-3 text-slate-500 flex-shrink-0" />
                        {new Date(campaign.startDate).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} - {new Date(campaign.endDate).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})}
                      </span>
                    </div>
                  </div>

                  {/* Budget & Spend Progress */}
                  <div className={`mb-4 p-3 rounded-xl border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/30'}`}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`flex items-center gap-1 font-semibold ${textSecondary}`}>
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        <span>Ngân sách</span>
                      </span>
                      <span className="font-semibold text-slate-400">
                        {campaign.budget ? `${campaign.budget.toLocaleString('vi-VN')} đ` : 'Chưa set'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={textMuted}>Đã commit:</span>
                      <span className={`font-bold ${isBudgetOver ? 'text-rose-500' : textPrimary}`}>
                        {totalSpent.toLocaleString('vi-VN')} đ
                        {campaign.budget ? ` (${Math.round((totalSpent / campaign.budget) * 100)}%)` : ''}
                      </span>
                    </div>

                    {campaign.budget && (
                      <div className="w-full h-1.5 bg-slate-500/15 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isBudgetOver ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600'
                          }`}
                          style={{ width: `${Math.min((totalSpent / campaign.budget) * 100, 100)}%` }}
                        />
                      </div>
                    )}

                    {isBudgetOver && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-500 font-bold">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Vượt ngân sách chiến dịch!</span>
                      </div>
                    )}
                  </div>

                  {/* 3-Phase Profiles Counters & Multi-Segment Progress Bar */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-semibold ${textSecondary}`}>Phân bổ KOL ({totalCount})</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setShowProfileSelector(campaign.id);
                        }}
                        className="text-xs font-bold text-violet-500 hover:text-violet-400 flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Users className="h-3 w-3" />
                        Quản lý KOLs
                      </button>
                    </div>

                    {totalCount > 0 ? (
                      <>
                        {/* Segmented Progress Bar */}
                        <div className="w-full h-2 bg-slate-500/15 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${connectingPct}%` }}
                            className="bg-sky-500 h-full transition-all duration-300"
                            title={`Connecting: ${connectingCount}`}
                          />
                          <div 
                            style={{ width: `${launchingPct}%` }}
                            className="bg-amber-500 h-full transition-all duration-300"
                            title={`Launching: ${launchingCount}`}
                          />
                          <div 
                            style={{ width: `${wrappingPct}%` }}
                            className="bg-emerald-500 h-full transition-all duration-300"
                            title={`Wrapping: ${wrappingCount}`}
                          />
                        </div>

                        {/* Labels & Counts */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center">
                          <div className="text-sky-500 bg-sky-500/5 py-1 rounded-md border border-sky-500/10">
                            🔗 {connectingCount} Deal
                          </div>
                          <div className="text-amber-500 bg-amber-500/5 py-1 rounded-md border border-amber-500/10">
                            🚀 {launchingCount} Run
                          </div>
                          <div className="text-emerald-500 bg-emerald-500/5 py-1 rounded-md border border-emerald-500/10">
                            ✅ {wrappingCount} Wrap
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={`text-center py-2 px-3 border border-dashed rounded-xl ${borderColor} ${textMuted} text-xs`}>
                        Chưa có KOL nào được thêm vào chiến dịch
                      </div>
                    )}
                  </div>
                </div>

                {/* Drill Down Hint */}
                <div className={`mt-2 pt-3 border-t ${borderColor} flex items-center justify-between text-xs font-semibold text-violet-500 group-hover:text-violet-400 transition-colors`}>
                  <span>Chi tiết bảng Kanban</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-scale-up ${modalBg}`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-500/10">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-violet-500" />
                <h3 className={`text-base font-bold ${textPrimary}`}>Khởi tạo chiến dịch mới</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className={`p-1.5 rounded-lg hover:bg-slate-500/10 ${textSecondary}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              {/* Campaign Name */}
              <div className="space-y-1">
                <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Tên chiến dịch *</label>
                {campaignNameMode === 'select' ? (
                  <select
                    value={newCampaignName}
                    onChange={e => {
                      if (e.target.value === '__new__') {
                        setCampaignNameMode('text');
                        setNewCampaignName('');
                      } else {
                        const val = e.target.value;
                        setNewCampaignName(val);
                        // Auto-fill brand if we find a CRM profile with this campaign
                        const matchedProfile = crmProfiles.find(p => p.campaign && p.campaign.includes(val) && p.projectName);
                        if (matchedProfile && matchedProfile.projectName) {
                          setNewBrand(matchedProfile.projectName);
                          setBrandSelectMode('select');
                        }
                      }
                    }}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                    required
                  >
                    <option value="">-- Chọn chiến dịch từ CRM --</option>
                    {crmCampaignNames.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__new__">➕ Nhập tên chiến dịch mới...</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={newCampaignName}
                      onChange={e => setNewCampaignName(e.target.value)}
                      placeholder="Ví dụ: Chiến dịch Tết Nguyên Đán 2026"
                      className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                    />
                    {crmCampaignNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignNameMode('select');
                          setNewCampaignName(crmCampaignNames[0] || '');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-violet-500 hover:text-violet-400 cursor-pointer"
                      >
                        Chọn từ CRM
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Brand & Charge Code Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Nhãn hàng (Brand) *</label>
                  {brandSelectMode === 'select' ? (
                    <select
                      value={newBrand}
                      onChange={e => {
                        if (e.target.value === '__new__') {
                          setBrandSelectMode('text');
                          setNewBrand('');
                        } else {
                          setNewBrand(e.target.value);
                        }
                      }}
                      className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                      required
                    >
                      <option value="">-- Chọn thương hiệu --</option>
                      {crmBrands.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="__new__">➕ Nhập thương hiệu mới...</option>
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={newBrand}
                        onChange={e => setNewBrand(e.target.value)}
                        placeholder="Nhập thương hiệu mới..."
                        className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                      />
                      {crmBrands.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBrandSelectMode('select');
                            setNewBrand(crmBrands[0] || '');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-violet-500 hover:text-violet-400 cursor-pointer"
                        >
                          Chọn từ CRM
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Charge Code</label>
                  <input
                    type="text"
                    value={newChargeCode}
                    onChange={e => setNewChargeCode(e.target.value)}
                    placeholder="MKT-2026Q1"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Mô tả chiến dịch</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Nhập ghi chú ngắn gọn về mục tiêu chiến dịch..."
                  rows={2}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none ${inputBg}`}
                />
              </div>

              {/* Date Timeline Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Ngày kết thúc</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                  />
                </div>
              </div>

              {/* Budget & Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Ngân sách (VND)</label>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={e => setNewBudget(e.target.value)}
                    placeholder="Ví dụ: 50000000"
                    className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>Trạng thái</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as Campaign['status'])}
                    className={`w-full px-3 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                  >
                    <option value="draft">Bản nháp (Draft)</option>
                    <option value="active">Đang chạy (Active)</option>
                    <option value="paused">Tạm dừng (Paused)</option>
                    <option value="completed">Đã xong (Completed)</option>
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-500/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  Huỷ bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-600/20 active:scale-95 transition-all"
                >
                  Tạo chiến dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRM PROFILE SELECTOR DIALOG */}
      {showProfileSelector && (() => {
        const campaign = campaigns.find(c => c.id === showProfileSelector);
        if (!campaign) return null;

        const campaignProfileIds = executionProfiles
          .filter(ep => ep.campaignId === campaign.id)
          .map(ep => ep.profileId);

        // Filter CRM profiles by profileSearch
        const searchedCRMProfiles = crmProfiles.filter(p => 
          (p.nickname || '').toLowerCase().includes(profileSearch.toLowerCase()) ||
          (p.channelId || '').toLowerCase().includes(profileSearch.toLowerCase())
        );

        const finalProfiles = filterCRMByTagOnly 
          ? searchedCRMProfiles.filter(p => p.campaign && p.campaign.includes(campaign.name))
          : searchedCRMProfiles;

        const handleToggleProfile = (profileId: string) => {
          const isAssigned = campaignProfileIds.includes(profileId);
          let newProfileIds = [...campaignProfileIds];
          if (isAssigned) {
            newProfileIds = newProfileIds.filter(id => id !== profileId);
          } else {
            newProfileIds.push(profileId);
          }
          onUpdateCampaignProfiles(campaign.id, newProfileIds);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl animate-scale-up ${modalBg} flex flex-col max-h-[85vh]`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-500/10 flex-shrink-0">
                <div>
                  <h3 className={`text-base font-bold ${textPrimary} flex items-center gap-1.5`}>
                    <Users className="h-5 w-5 text-violet-500" />
                    <span>Quản lý KOLs chiến dịch</span>
                  </h3>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>
                    Thêm hoặc bớt các KOL profiles từ kho CRM vào chiến dịch <b>{campaign.name}</b>.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowProfileSelector(null);
                    setProfileSearch('');
                  }}
                  className={`p-1.5 rounded-lg hover:bg-slate-500/10 ${textSecondary}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="mb-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    placeholder="Tìm KOL theo tên hoặc ID..."
                    className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all ${inputBg}`}
                  />
                </div>
              </div>

              {/* Tag Filter Toggle */}
              <div className="mb-4 flex items-center justify-between px-1 flex-shrink-0">
                <label className="flex items-center gap-2 text-xs text-slate-400 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterCRMByTagOnly}
                    onChange={e => setFilterCRMByTagOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-500/30 accent-violet-600 focus:ring-0 focus:outline-none"
                  />
                  <span>Chỉ hiện profiles đã gán Tag Campaign <b>"{campaign.name}"</b> ở CRM</span>
                </label>
                
                <span className="text-[10px] text-slate-500 bg-slate-500/5 px-2 py-0.5 rounded-md border border-slate-500/10">
                  Tìm thấy: {finalProfiles.length}
                </span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                {finalProfiles.length === 0 ? (
                  <div className={`text-center py-10 ${textSecondary} text-xs border border-dashed rounded-xl ${borderColor}`}>
                    {filterCRMByTagOnly 
                      ? 'Không có profile nào được gán Tag này ở CRM. Tắt bộ lọc trên để hiển thị tất cả!' 
                      : 'Không tìm thấy profile nào. Hãy cào thêm profile từ tab Extractor trước!'}
                  </div>
                ) : (
                  finalProfiles.map(p => {
                    const isSelected = campaignProfileIds.includes(p.id);
                    const hasCRMTag = p.campaign && p.campaign.includes(campaign.name);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleProfile(p.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-violet-600/10 border-violet-500/40 hover:bg-violet-600/15' 
                            : `${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'} border-transparent hover:border-slate-500/20`
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {p.profilePic ? (
                            <img 
                              src={p.profilePic} 
                              alt={p.nickname} 
                              className="w-10 h-10 rounded-full object-cover border border-violet-500/20"
                              onError={e => {
                                (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                              {(p.nickname || p.channelId || 'K').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-bold ${textPrimary} truncate`}>{p.nickname || 'Không tên'}</h5>
                              {hasCRMTag && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-600/15 text-violet-400 border border-violet-500/20 text-[9px] font-extrabold uppercase">
                                  🏷️ Tag: {campaign.name}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${textSecondary} truncate`}>@{p.channelId || 'no-id'} ({p.platform})</p>
                          </div>
                        </div>

                        {/* Checkbox badge */}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected 
                            ? 'bg-violet-600 border-violet-500 text-white shadow-sm shadow-violet-600/20' 
                            : `${isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-slate-50'} text-transparent`
                        }`}>
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-500/10 pt-4 mt-4 flex-shrink-0">
                <span className={`text-xs font-medium ${textSecondary}`}>
                  Đã chọn: <span className="font-bold text-violet-500">{campaignProfileIds.length}</span> KOLs
                </span>
                <button
                  onClick={() => {
                    setShowProfileSelector(null);
                    setProfileSearch('');
                  }}
                  className="px-5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
