import React from 'react';
import { X, Users, Phone, Mail, Award, Globe, MessageSquare } from 'lucide-react';
import { RestoredData, Tier } from '../types';

interface KPIDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: RestoredData[];
  theme?: string;
}

export function KPIDashboardModal({ isOpen, onClose, data, theme }: KPIDashboardModalProps) {
  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200';
  const overlayBg = isDark ? 'bg-black/75' : 'bg-slate-900/60';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderC = isDark ? 'border-white/[0.08]' : 'border-slate-200';
  const cardBg = isDark ? 'bg-slate-800/50 border-white/[0.04] backdrop-blur-md shadow-xl' : 'bg-slate-50 border-slate-200/60 shadow-md';
  const btnClose = isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100';

  const totalLeans = data.length;

  // Calculate Metrics
  const calculateFitScore = (profile: RestoredData) => {
    let score = 20; // Base score
    const hasPhone = profile.phone && profile.phone !== 'N/A' && profile.phone !== '-' && profile.phone !== '';
    const hasEmail = profile.email && profile.email !== 'N/A' && profile.email !== '-' && profile.email !== '';
    
    if (hasPhone) score += 15;
    if (hasEmail) score += 15;

    if (profile.averageEngagement && profile.averageEngagement > 0) {
      const engPercent = profile.averageEngagement;
      if (engPercent >= 5) score += 20;
      else if (engPercent >= 2.5) score += 10;
      else score -= 5;
    } else {
      score -= 5;
    }

    const hasBioLink = profile.bioLink && profile.bioLink !== 'N/A' && profile.bioLink !== '' && profile.bioLink !== '-';
    if (hasBioLink) score += 10;
    if (profile.bio && profile.bio.trim().length > 10) score += 10;
    if (profile.profileNiche && profile.profileNiche !== 'N/A' && profile.profileNiche !== 'Unclassified') score += 10;

    return Math.max(0, Math.min(100, score));
  };

  const contactableCount = data.filter(row => {
    const hasPhone = row.phone && row.phone !== 'N/A' && row.phone !== '-' && row.phone !== '';
    const hasEmail = row.email && row.email !== 'N/A' && row.email !== '-' && row.email !== '';
    return hasPhone || hasEmail;
  }).length;

  const phoneCount = data.filter(row => row.phone && row.phone !== 'N/A' && row.phone !== '-' && row.phone !== '').length;
  const emailCount = data.filter(row => row.email && row.email !== 'N/A' && row.email !== '-' && row.email !== '').length;
  const bothCount = data.filter(row => {
    const hasPhone = row.phone && row.phone !== 'N/A' && row.phone !== '-' && row.phone !== '';
    const hasEmail = row.email && row.email !== 'N/A' && row.email !== '-' && row.email !== '';
    return hasPhone && hasEmail;
  }).length;

  // Platform Splits
  const tiktokCount = data.filter(row => (row.platform || 'TikTok') === 'TikTok').length;
  const facebookCount = data.filter(row => row.platform === 'Facebook').length;

  // Follower Tiers Splits (Macro, Micro, Nano, UGC)
  let macroCount = 0;
  let microCount = 0;
  let nanoCount = 0;
  let ugcCount = 0;

  data.forEach(row => {
    const tier = row.tier && row.tier.length > 0 ? row.tier[0] : 'UGC';
    if (tier === 'Macro') macroCount++;
    else if (tier === 'Micro') microCount++;
    else if (tier === 'Nano') nanoCount++;
    else ugcCount++;
  });

  // Calculate Average Fit Score
  const totalFitScore = data.reduce((sum, row) => sum + calculateFitScore(row), 0);
  const avgFitScore = totalLeans > 0 ? Math.round(totalFitScore / totalLeans) : 0;

  // Helper Percentages
  const getPercent = (count: number) => {
    if (totalLeans === 0) return 0;
    return Math.round((count / totalLeans) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className={`absolute inset-0 ${overlayBg} backdrop-blur-sm`} onClick={onClose} />
      <div className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${modalBg} overflow-hidden`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderC} flex items-center justify-between shrink-0`}>
          <div>
            <h2 className={`text-lg font-bold ${textP}`}>Scouting Performance & KPI Dashboard</h2>
            <p className={`text-xs ${textS}`}>Báo cáo phân tích dữ liệu và chất lượng leads trong tệp hiện tại</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${btnClose}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {totalLeans === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-slate-500 opacity-30 mb-3" />
              <p className={`text-sm ${textS}`}>Chưa có dữ liệu nào để phân tích. Hãy lọc hoặc thêm dữ liệu vào CRM.</p>
            </div>
          ) : (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Card 1: Leads Count */}
                <div className={`rounded-xl p-5 border ${cardBg} relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-all duration-300" />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wider ${textM}`}>Tổng Số Leads</span>
                      <h3 className={`text-3xl font-extrabold mt-1 ${textP}`}>{totalLeans}</h3>
                      <p className={`text-[10px] mt-1.5 ${textS}`}>Creator hoạt động</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Card 2: Contactable Rate */}
                <div className={`rounded-xl p-5 border ${cardBg} relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-300" />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wider ${textM}`}>Tỷ lệ Có Liên Hệ</span>
                      <h3 className={`text-3xl font-extrabold mt-1 text-emerald-400`}>{getPercent(contactableCount)}%</h3>
                      <p className={`text-[10px] mt-1.5 ${textS}`}>{contactableCount} trên {totalLeans} leads</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Phone className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Card 3: Avg Fit Score */}
                <div className={`rounded-xl p-5 border ${cardBg} relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all duration-300" />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wider ${textM}`}>Điểm Phù Hợp TB</span>
                      <h3 className={`text-3xl font-extrabold mt-1 text-amber-400`}>{avgFitScore}%</h3>
                      <p className={`text-[10px] mt-1.5 ${textS}`}>Dựa trên thuật toán chấm điểm</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                      <Award className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info Coverage & Channels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Card: Contact coverage bars */}
                <div className={`rounded-xl p-5 border ${cardBg} space-y-4`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textP}`}>Độ phủ thông tin liên hệ</h4>
                  
                  <div className="space-y-3.5">
                    {/* Phone Coverage */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`flex items-center gap-1.5 font-medium ${textP}`}>
                          <Phone className="h-3.5 w-3.5 text-blue-400" /> Số điện thoại
                        </span>
                        <span className={`font-semibold ${textP}`}>{phoneCount} ({getPercent(phoneCount)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700/30 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(phoneCount)}%` }} />
                      </div>
                    </div>

                    {/* Email Coverage */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`flex items-center gap-1.5 font-medium ${textP}`}>
                          <Mail className="h-3.5 w-3.5 text-pink-400" /> Địa chỉ Email
                        </span>
                        <span className={`font-semibold ${textP}`}>{emailCount} ({getPercent(emailCount)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700/30 overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(emailCount)}%` }} />
                      </div>
                    </div>

                    {/* Both Coverage */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`flex items-center gap-1.5 font-medium ${textP}`}>
                          <MessageSquare className="h-3.5 w-3.5 text-violet-400" /> Có cả SĐT & Email
                        </span>
                        <span className={`font-semibold ${textP}`}>{bothCount} ({getPercent(bothCount)}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700/30 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${getPercent(bothCount)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Platform Split */}
                <div className={`rounded-xl p-5 border ${cardBg} flex flex-col justify-between`}>
                  <div className="space-y-1">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${textP}`}>Cơ cấu Nền tảng (Platform)</h4>
                    <p className={`text-[10px] ${textS}`}>Tỷ lệ phân phối nguồn trích xuất</p>
                  </div>

                  <div className="py-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`flex items-center gap-1 font-semibold text-sky-400`}>
                        <Globe className="h-3.5 w-3.5" /> TikTok ({getPercent(tiktokCount)}%)
                      </span>
                      <span className={`flex items-center gap-1 font-semibold text-blue-500`}>
                        Facebook ({getPercent(facebookCount)}%) <Globe className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {/* Compound Progress Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-700/30 flex overflow-hidden">
                      <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: `${getPercent(tiktokCount)}%` }} />
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${getPercent(facebookCount)}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className={textS}>TikTok: <strong>{tiktokCount}</strong> profiles</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className={textS}>Facebook: <strong>{facebookCount}</strong> profiles</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Follower Tier Distribution */}
              <div className={`rounded-xl p-5 border ${cardBg} space-y-4`}>
                <div className="space-y-1">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${textP}`}>Phân bổ nhóm Follower Tiers</h4>
                  <p className={`text-[10px] ${textS}`}>Cơ cấu phân tầng tầm ảnh hưởng của KOLs</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Macro Card */}
                  <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/10 border-white/5' : 'bg-white border-slate-100'} text-center`}>
                    <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wide">Macro</div>
                    <div className={`text-xl font-extrabold mt-1 ${textP}`}>{macroCount}</div>
                    <div className={`text-[10px] ${textS} mt-0.5`}>{getPercent(macroCount)}% chiến dịch</div>
                    <div className="w-full h-1 bg-slate-700/30 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${getPercent(macroCount)}%` }} />
                    </div>
                  </div>

                  {/* Micro Card */}
                  <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/10 border-white/5' : 'bg-white border-slate-100'} text-center`}>
                    <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wide">Micro</div>
                    <div className={`text-xl font-extrabold mt-1 ${textP}`}>{microCount}</div>
                    <div className={`text-[10px] ${textS} mt-0.5`}>{getPercent(microCount)}% chiến dịch</div>
                    <div className="w-full h-1 bg-slate-700/30 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-fuchsia-500" style={{ width: `${getPercent(microCount)}%` }} />
                    </div>
                  </div>

                  {/* Nano Card */}
                  <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/10 border-white/5' : 'bg-white border-slate-100'} text-center`}>
                    <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">Nano</div>
                    <div className={`text-xl font-extrabold mt-1 ${textP}`}>{nanoCount}</div>
                    <div className={`text-[10px] ${textS} mt-0.5`}>{getPercent(nanoCount)}% chiến dịch</div>
                    <div className="w-full h-1 bg-slate-700/30 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${getPercent(nanoCount)}%` }} />
                    </div>
                  </div>

                  {/* UGC Card */}
                  <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/10 border-white/5' : 'bg-white border-slate-100'} text-center`}>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">UGC / Khác</div>
                    <div className={`text-xl font-extrabold mt-1 ${textP}`}>{ugcCount}</div>
                    <div className={`text-[10px] ${textS} mt-0.5`}>{getPercent(ugcCount)}% chiến dịch</div>
                    <div className="w-full h-1 bg-slate-700/30 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${getPercent(ugcCount)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className={`px-6 py-3.5 border-t ${borderC} flex justify-end bg-black/5`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/10 transition-colors`}
          >
            Đóng bảng phân tích
          </button>
        </div>
      </div>
    </div>
  );
}
