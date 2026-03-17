import React, { useMemo } from 'react';
import { RestoredData, Tier } from '../types';
import { PieChart, ListChecks, Users, Globe } from 'lucide-react';

interface DashboardStatsProps {
  data: RestoredData[];
  theme: string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ data, theme }) => {
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white border-slate-200';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  
  const stats = useMemo(() => {
    const total = data.length || 1; // Prevent div by 0 for bars

    // Platform Distribution
    const tiktok = data.filter(d => d.platform === 'TikTok').length;
    const facebook = data.filter(d => d.platform === 'Facebook').length;
    
    // Tier Distribution
    const tiers: Record<string, number> = { 'Macro': 0, 'Micro': 0, 'Nano': 0, 'UGC': 0 };
    data.forEach(d => {
      d.tier.forEach(t => {
        if (tiers[t] !== undefined) tiers[t]++;
        else tiers[t] = 1;
      });
    });

    // Top Campaigns
    const campaigns: Record<string, number> = {};
    data.forEach(d => {
      d.campaign.forEach(c => {
        campaigns[c] = (campaigns[c] || 0) + 1;
      });
    });
    
    const topCampaigns = Object.entries(campaigns)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 4);

    return { total, tiktok, facebook, tiers, topCampaigns };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      {/* Platform Chart */}
      <div className={`p-4 rounded-xl border ${cardBg}`}>
        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${textP}`}>
          <Globe className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /> Platform
        </h3>
        <div className="space-y-4 text-sm font-medium">
          <div>
            <div className="flex justify-between mb-1">
              <span className={textS}>TikTok ({stats.tiktok})</span>
              <span className={textP}>{Math.round((stats.tiktok / stats.total) * 100)}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div className="h-full bg-slate-900 dark:bg-slate-100 transition-all rounded-full" style={{ width: `${(stats.tiktok / stats.total) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className={textS}>Facebook ({stats.facebook})</span>
              <span className={textP}>{Math.round((stats.facebook / stats.total) * 100)}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
              <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all rounded-full" style={{ width: `${(stats.facebook / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className={`p-4 rounded-xl border ${cardBg}`}>
        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${textP}`}>
          <Users className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} /> Phân loại Tier
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.tiers).filter(([_, count]) => count > 0).map(([tier, count]) => {
            const pct = Math.round((count / stats.total) * 100);
            return (
              <div key={tier} className="text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>{tier}</span>
                  <div className="flex items-center gap-2">
                    <span className={textP}>{pct}%</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </div>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <div className="h-full bg-violet-500 transition-all rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Campaigns */}
      <div className={`p-4 rounded-xl border ${cardBg}`}>
        <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${textP}`}>
          <ListChecks className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} /> Chiến dịch nổi bật
        </h3>
        <div className="space-y-2.5">
          {stats.topCampaigns.length === 0 ? (
            <p className={`text-sm ${textS} italic`}>Chưa gán chiến dịch nào...</p>
          ) : (
            stats.topCampaigns.map(([camp, count], idx) => (
              <div key={camp} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center ${isDark ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{idx + 1}</span>
                  <span className={`text-sm font-medium ${textP} truncate max-w-[140px]`}>{camp}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded bg-white dark:bg-black/20 ${textS}`}>
                  {count} <Users className="inline h-3 w-3 -mt-0.5" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
