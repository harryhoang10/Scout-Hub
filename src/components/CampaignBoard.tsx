import React, { useState } from 'react';
import { RestoredData } from '../types';
import { Users, Phone, Mail, Link as LinkIcon, Star, Filter } from 'lucide-react';

interface CampaignBoardProps {
  data: RestoredData[];
  campaigns: string[];
  theme: string;
  onUpdateRow: (id: string, field: keyof RestoredData, value: any) => void;
}

export const CampaignBoard: React.FC<CampaignBoardProps> = ({ data, campaigns, theme, onUpdateRow }) => {
  const [draggedProfileId, setDraggedProfileId] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const boardBg = isDark ? 'bg-transparent' : 'bg-transparent';
  const colBg = isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-100 border-slate-200';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10 hover:border-violet-500/50' : 'bg-white border-slate-200 hover:border-violet-300 shadow-sm';
  const textP = isDark ? 'text-slate-100' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';

  // Include an "Unassigned" column
  const allColumns = ['Chưa phân bổ', ...campaigns];

  const handleDragStart = (e: React.DragEvent, profileId: string) => {
    setDraggedProfileId(profileId);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image or generic UI can be set here
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCampaign: string) => {
    e.preventDefault();
    if (!draggedProfileId) return;

    const profile = data.find(p => p.id === draggedProfileId);
    if (!profile) return;

    let newCampaigns = [...profile.campaign];

    // If moving to 'Chưa phân bổ', we clear campaigns
    if (targetCampaign === 'Chưa phân bổ') {
      newCampaigns = [];
    } else {
      // If moving to a specific campaign, ensure it has it, and optionally remove others if we treat this as a strict primary board
      // For this implementation, we will replace the campaigns array with just the new target campaign for simplicity in Kanban view
      newCampaigns = [targetCampaign];
    }

    onUpdateRow(draggedProfileId, 'campaign', newCampaigns);
    setDraggedProfileId(null);
  };

  const tagColors: Record<string, string> = {
    violet: isDark ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-700',
    blue: isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700',
  };

  const formatFollowers = (val: string | number | undefined) => {
    if (!val) return '-';
    let num = typeof val === 'number' ? val : parseFloat(val.toString().replace(/,/g, ''));
    if (isNaN(num)) return val.toString();
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  return (
    <div className={`flex items-start gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] ${boardBg}`}>
      {allColumns.map(col => {
        const colProfiles = data.filter(p => {
          if (col === 'Chưa phân bổ') return p.campaign.length === 0;
          return p.campaign.includes(col);
        });

        return (
          <div 
            key={col}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col)}
            className={`flex-shrink-0 w-72 flex flex-col rounded-xl border p-3 h-full ${colBg}`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className={`font-semibold text-sm ${textP}`}>{col}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                {colProfiles.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {colProfiles.map(profile => (
                <div 
                  key={profile.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, profile.id)}
                  onDragEnd={() => setDraggedProfileId(null)}
                  className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${cardBg} ${draggedProfileId === profile.id ? 'opacity-50 scale-95' : ''}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {profile.profilePic ? (
                      <img src={profile.profilePic} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <Users className={`h-4 w-4 ${textS}`} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${textP}`}>{profile.nickname || '-'}</div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className={`text-[10px] ${textS} truncate max-w-[80px]`}>{profile.channelId ? `@${profile.channelId}` : ''}</span>
                        <span className={`text-[10px] font-semibold ${textP}`}>{formatFollowers(profile.followers)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2 mt-2">
                    {profile.tier.map(t => <span key={t} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.violet}`}>{t}</span>)}
                    {profile.platform === 'Facebook' && <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tagColors.blue}`}>Facebook</span>}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-500/20">
                    <div className="flex gap-2">
                      {profile.phone && profile.phone !== 'N/A' && <Phone className={`h-3 w-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />}
                      {profile.email && profile.email !== 'N/A' && <Mail className={`h-3 w-3 ${textS}`} />}
                    </div>
                    <a href={profile.url} target="_blank" rel="noreferrer" className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                      <LinkIcon className="h-3 w-3" /> Link
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
