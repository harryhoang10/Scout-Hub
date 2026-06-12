import React, { useMemo } from 'react';
import { RestoredData, Platform } from '../types';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, Database, Globe, Link as LinkIcon, Mail, Phone, RefreshCw, Target, Users } from 'lucide-react';
import { parseMetricValue } from '../lib/utils';

interface DashboardStatsProps {
  data: RestoredData[];
  theme: string;
}

type PlatformStats = {
  platform: Platform;
  count: number;
  usable: number;
  contactable: number;
  avgFollowers: number;
  avgView: number;
  avgEngagement: number;
};

const FIELD_LABELS: Record<string, string> = {
  phone: 'Phone',
  email: 'Email',
  bioLink: 'Bio link',
  followers: 'Followers',
  averageView: 'Avg view',
  averageEngagement: 'Avg engage',
};

function isUsableValue(value: string | number | undefined) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return Boolean(normalized) && !['n/a', 'na', '-', 'none', 'null', 'undefined'].includes(normalized);
}

function parseMetric(value: string | number | undefined) {
  return parseMetricValue(value);
}

function parseProfileDate(value: string | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const datePart = trimmed.split(/[ T]/)[0];
  const parts = datePart.split(/[/-]/).map(part => Number(part));
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [a, b, c] = parts;
    if (a > 1900) return new Date(a, b - 1, c);
    return new Date(c, b - 1, a);
  }

  return null;
}

function isSameDay(a: Date | null, b: Date) {
  if (!a) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWithinDays(date: Date | null, days: number, now: Date) {
  if (!date) return false;
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function hasAnyContact(profile: RestoredData) {
  return isUsableValue(profile.phone) || isUsableValue(profile.email) || isUsableValue(profile.bioLink);
}

function isUsableLead(profile: RestoredData) {
  const hasScaleSignal = parseMetric(profile.followers) > 0 || (profile.averageView || 0) > 0;
  return hasScaleSignal && hasAnyContact(profile);
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(value)}`;
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function normalizeUrl(url: string | undefined) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ data, theme }) => {
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';
  const panelBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';

  const stats = useMemo(() => {
    const now = new Date();
    const total = data.length;
    const savedToday = data.filter(profile => isSameDay(parseProfileDate(profile.saveDate), now)).length;
    const saved7d = data.filter(profile => isWithinDays(parseProfileDate(profile.saveDate), 7, now)).length;
    const changed7d = data.filter(profile => isWithinDays(parseProfileDate(profile.lastChangedAt || profile.changeHistory?.[0]?.detectedAt), 7, now)).length;
    const watchlisted = data.filter(profile => profile.isWatchlisted).length;
    const usable = data.filter(isUsableLead).length;
    const contactable = data.filter(hasAnyContact).length;
    const partialWarnings = data.filter(profile => profile.partialWarnings && profile.partialWarnings.length > 0).length;
    const contactWarnings = data.filter(profile => profile.contactWarnings && profile.contactWarnings.length > 0).length;

    const fields = Object.keys(FIELD_LABELS).map(field => {
      const complete = data.filter(profile => {
        if (field === 'averageView' || field === 'averageEngagement') return (profile[field] || 0) > 0;
        return isUsableValue(profile[field as keyof RestoredData] as string | number | undefined);
      }).length;

      return {
        field,
        label: FIELD_LABELS[field],
        complete,
        pct: percent(complete, total),
      };
    });

    const sourcePerformance = (['TikTok', 'Facebook'] as Platform[]).map<PlatformStats>(platform => {
      const rows = data.filter(profile => profile.platform === platform);
      const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return {
        platform,
        count: rows.length,
        usable: rows.filter(isUsableLead).length,
        contactable: rows.filter(hasAnyContact).length,
        avgFollowers: avg(rows.map(profile => parseMetric(profile.followers)).filter(Boolean)),
        avgView: avg(rows.map(profile => profile.averageView || 0).filter(Boolean)),
        avgEngagement: avg(rows.map(profile => profile.averageEngagement || 0).filter(Boolean)),
      };
    });

    const seenUrls = new Map<string, number>();
    data.forEach(profile => {
      const key = normalizeUrl(profile.url);
      if (!key) return;
      seenUrls.set(key, (seenUrls.get(key) || 0) + 1);
    });
    const duplicateRisk = Array.from(seenUrls.values()).filter(count => count > 1).reduce((sum, count) => sum + count, 0);

    return {
      total,
      savedToday,
      saved7d,
      changed7d,
      watchlisted,
      usable,
      contactable,
      partialWarnings,
      contactWarnings,
      missingContact: total - contactable,
      missingFollowers: data.filter(profile => parseMetric(profile.followers) <= 0).length,
      duplicateRisk,
      fields,
      sourcePerformance,
    };
  }, [data]);

  if (data.length === 0) return null;

  const progressTrack = isDark ? 'bg-white/10' : 'bg-slate-200';
  const chipBg = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200';
  const warningChip = isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200';

  const KpiCard = ({ label, value, hint, icon: Icon, tone }: { label: string; value: string | number; hint: string; icon: React.ElementType; tone: string }) => (
    <div className={`rounded-xl border p-4 ${cardBg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] ${textS}`}>{label}</p>
          <div className={`mt-1 text-2xl font-bold ${textP}`}>{value}</div>
          <p className={`mt-1 text-[11px] ${textM}`}>{hint}</p>
        </div>
        <div className={`p-2 rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Saved hôm nay" value={stats.savedToday} hint={`${stats.saved7d} profile trong 7 ngày`} icon={Clock} tone={isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'} />
        <KpiCard label="Usable leads" value={`${percent(stats.usable, stats.total)}%`} hint={`${stats.usable}/${stats.total} có contact + scale`} icon={Target} tone={isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} />
        <KpiCard label="Changed 7 ngày" value={stats.changed7d} hint="Profile có field mới đổi" icon={RefreshCw} tone={isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'} />
        <KpiCard label="Watchlist" value={stats.watchlisted} hint="Profile chiến lược cần refresh" icon={Activity} tone={isDark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-700'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 ${cardBg}`}>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${textP}`}>
            <Globe className={`h-4 w-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /> Source performance
          </h3>
          <div className="space-y-3">
            {stats.sourcePerformance.map(source => {
              const sourcePct = percent(source.count, stats.total);
              const usablePct = percent(source.usable, source.count);
              const contactPct = percent(source.contactable, source.count);
              return (
                <div key={source.platform} className={`rounded-xl border p-3 ${panelBg} ${borderC}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-semibold ${textP}`}>{source.platform}</div>
                    <span className={`text-[11px] ${textS}`}>{source.count} profiles · {sourcePct}% mix</span>
                  </div>
                  <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${progressTrack}`}>
                    <div className={`h-full rounded-full ${source.platform === 'Facebook' ? 'bg-blue-500' : 'bg-slate-500'}`} style={{ width: `${sourcePct}%` }} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <div className={`rounded-lg border px-2 py-1.5 ${chipBg}`}>
                      <p className={`text-[10px] ${textM}`}>Usable</p>
                      <p className={`text-xs font-semibold ${textP}`}>{usablePct}%</p>
                    </div>
                    <div className={`rounded-lg border px-2 py-1.5 ${chipBg}`}>
                      <p className={`text-[10px] ${textM}`}>Contact</p>
                      <p className={`text-xs font-semibold ${textP}`}>{contactPct}%</p>
                    </div>
                    <div className={`rounded-lg border px-2 py-1.5 ${chipBg}`}>
                      <p className={`text-[10px] ${textM}`}>Avg followers</p>
                      <p className={`text-xs font-semibold ${textP}`}>{formatCompact(source.avgFollowers)}</p>
                    </div>
                    <div className={`rounded-lg border px-2 py-1.5 ${chipBg}`}>
                      <p className={`text-[10px] ${textM}`}>Avg view/engage</p>
                      <p className={`text-xs font-semibold ${textP}`}>{formatCompact(source.avgView)} / {formatCompact(source.avgEngagement)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${cardBg}`}>
          <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${textP}`}>
            <BarChart3 className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} /> Field completion report
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stats.fields.map(field => (
              <div key={field.field}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${textS}`}>{field.label}</span>
                  <span className={`text-xs font-semibold ${textP}`}>{field.pct}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${progressTrack}`}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${field.pct}%` }} />
                </div>
                <p className={`mt-1 text-[10px] ${textM}`}>{field.complete}/{stats.total} filled</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${cardBg}`}>
        <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${textP}`}>
          <AlertTriangle className={`h-4 w-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} /> Quality bottlenecks
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stats.missingContact > 0 ? warningChip : chipBg}`}>
            <Phone className="h-3 w-3" /> Missing contact: {stats.missingContact}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stats.missingFollowers > 0 ? warningChip : chipBg}`}>
            <Users className="h-3 w-3" /> Missing followers: {stats.missingFollowers}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stats.contactWarnings > 0 ? warningChip : chipBg}`}>
            <Mail className="h-3 w-3" /> Contact warnings: {stats.contactWarnings}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stats.partialWarnings > 0 ? warningChip : chipBg}`}>
            <Database className="h-3 w-3" /> Partial scrape: {stats.partialWarnings}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${stats.duplicateRisk > 0 ? warningChip : chipBg}`}>
            <LinkIcon className="h-3 w-3" /> Duplicate-risk rows: {stats.duplicateRisk}
          </span>
          {stats.missingContact === 0 && stats.missingFollowers === 0 && stats.contactWarnings === 0 && stats.partialWarnings === 0 && stats.duplicateRisk === 0 && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              <CheckCircle2 className="h-3 w-3" /> No major bottleneck detected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
