import React from 'react';
import { X, Users, Globe } from 'lucide-react';
import { RestoredData } from '../types';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: RestoredData[];
  theme?: string;
}

export function CompareModal({ isOpen, onClose, profiles, theme }: CompareModalProps) {
  if (!isOpen || profiles.length === 0) return null;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const overlayBg = isDark ? 'bg-black/60' : 'bg-slate-900/40';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textM = isDark ? 'text-slate-400' : 'text-slate-500';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const headerBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const btnClose = isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100';

  const formatNumber = (val: string | number | undefined): string => {
    if (!val) return '-';
    let num = typeof val === 'number' ? val : parseFloat(val.toString().replace(/,/g, ''));
    if (isNaN(num)) return val.toString();
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className={`absolute inset-0 ${overlayBg} backdrop-blur-sm`} onClick={onClose} />
      <div className={`relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${modalBg} overflow-hidden`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderC} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-semibold ${textP}`}>So sánh KOLs</h2>
            <p className={`text-xs ${textM}`}>So sánh chi tiết {profiles.length} profiles</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${btnClose}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex gap-4">
            {/* Field Labels Column */}
            <div className="w-40 shrink-0 space-y-4 pt-[116px]">
              <div className={`h-10 flex items-center text-sm font-medium ${textM}`}>Nền tảng</div>
              <div className={`h-10 flex items-center text-sm font-medium ${textM}`}>Followers</div>
              <div className={`h-10 flex items-center text-sm font-medium ${textM}`}>Tier</div>
              <div className={`h-10 flex items-center text-sm font-medium ${textM}`}>Nhóm</div>
              <div className={`h-10 flex items-center text-sm font-medium ${textM}`}>Vị trí</div>
            </div>

            {/* Profile Columns */}
            {profiles.map(profile => (
              <div key={profile.id} className={`flex-1 min-w-[200px] border rounded-xl overflow-hidden ${borderC}`}>
                {/* Profile Header */}
                <div className={`h-[100px] p-4 border-b flex flex-col items-center justify-center text-center ${borderC} ${headerBg}`}>
                  {profile.profilePic ? (
                    <img src={profile.profilePic} alt="" className={`w-12 h-12 rounded-full object-cover border-2 shadow-sm mb-2 ${isDark ? 'border-slate-700' : 'border-white'}`} referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-200 text-slate-400'}`}>
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                  <div className={`font-semibold text-sm truncate w-full px-2 ${textP}`}>{profile.nickname || 'N/A'}</div>
                </div>

                {/* Profile Data */}
                <div className="p-4 space-y-4 text-center">
                  <div className={`h-10 flex items-center justify-center text-sm ${textP}`}>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${profile.platform === 'Facebook' ? (isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>
                      <Globe className="h-3 w-3" />
                      {profile.platform || 'TikTok'}
                    </span>
                  </div>
                  <div className={`h-10 flex items-center justify-center text-sm font-medium ${textP}`}>{formatNumber(profile.followers)}</div>
                  <div className={`h-10 flex items-center justify-center text-xs ${textM}`}>{profile.tier.join(', ') || '-'}</div>
                  <div className={`h-10 flex items-center justify-center text-xs ${textM}`}>{profile.group.join(', ') || '-'}</div>
                  <div className={`h-10 flex items-center justify-center text-xs ${textM}`}>{profile.location.join(', ') || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
