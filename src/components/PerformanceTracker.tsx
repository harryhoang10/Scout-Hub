import React, { useState, useRef, useCallback, useMemo } from 'react';
import { read, utils, write } from 'xlsx';
import {
  Upload, FileSpreadsheet, RefreshCw, Download, CheckSquare, Square,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2, Clock, BarChart3,
  Eye, Heart, MessageCircle, Share2, Bookmark, X, ExternalLink,
  TrendingUp, Minus, Trash2, Copy, ClipboardCheck,
  Rows, Table2, Search, Filter, Edit3, Save, Link2
} from 'lucide-react';

// ============ Types ============
interface TrackerRow {
  rowIndex: number;       // 0-indexed row in the sheet
  stt: string;
  name: string;
  followers: string;
  link: string;
  platform: string;
  linkAir: string;
  airDate: string;
  kpiView: number | null;
  kpiEng: number | null;
  actualView: number | null;
  actualEng: number | null;
  screenshotLink: string;
  runrateView: string;
  runrateEng: string;
  updateDate: string;
  isSection: boolean;     // header/section row
  hasLink: boolean;
  scrapeStatus: 'idle' | 'pending' | 'scraping' | 'done' | 'error';
  scrapeError?: string;
  scrapeDetails?: any;
  selected: boolean;
}

interface ScrapeResult {
  row: number;
  url: string;
  view: number | null;
  engagement: number | null;
  details: any;
  platform: string;
  status: 'ok' | 'error';
  error?: string;
}

interface Props {
  theme: string;
}

// ============ Helpers ============
function parseNumber(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '').replace(/\s/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function formatNumber(num: number | null): string {
  if (num == null) return '';
  return num.toLocaleString('en-US');
}

function formatPercent(num: string): string {
  if (!num || num === '0%') return '0%';
  return num;
}

function isUrl(val: string): boolean {
  return /^https?:\/\//i.test(val.trim());
}

function detectPlatformFromUrl(url: string): string {
  if (/tiktok\.com|vt\.tiktok/i.test(url)) return 'tiktok';
  if (/facebook\.com|fb\.com|fb\.watch/i.test(url)) return 'facebook';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'unknown';
}

function getPlatformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes('tiktok')) return '🎵';
  if (p.includes('facebook')) return '📘';
  if (p.includes('instagram')) return '📸';
  return '🔗';
}

function getRunrateColor(val: string, isDark: boolean): string {
  const num = parseFloat(val);
  if (isNaN(num)) return '';
  if (num >= 100) return isDark ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold';
  if (num >= 50) return isDark ? 'text-amber-400 font-semibold' : 'text-amber-600 font-semibold';
  return isDark ? 'text-rose-400' : 'text-rose-600';
}

// ============ Column definitions for copy ============
const COLUMN_KEYS = ['stt', 'name', 'platform', 'linkAir', 'airDate', 'kpiView', 'kpiEng', 'actualView', 'actualEng', 'runrateView', 'runrateEng', 'updateDate'] as const;
const COLUMN_HEADERS = ['#', 'Tên', 'Platform', 'Link Air', 'Ngày Air', 'KPI View', 'KPI Eng', 'Actual View', 'Actual Eng', 'RR View', 'RR Eng', 'Ngày Cập Nhật'];

function getRowValues(row: TrackerRow): string[] {
  return [
    row.stt,
    row.name,
    row.platform,
    row.linkAir,
    row.airDate,
    row.kpiView != null ? String(row.kpiView) : '',
    row.kpiEng != null ? String(row.kpiEng) : '',
    row.actualView != null ? String(row.actualView) : '',
    row.actualEng != null ? String(row.actualEng) : '',
    row.runrateView,
    row.runrateEng,
    row.updateDate,
  ];
}

// ============ Component ============
export function PerformanceTracker({ theme }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [workbookRef, setWorkbookRef] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Scraping states
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ done: 0, total: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ updated: number; skipped: number; failed: number; totalView: number; totalEng: number } | null>(null);
  
  // Import states
  const [importMode, setImportMode] = useState<'excel' | 'gsheet' | 'paste'>('excel');
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [gsheetLoading, setGsheetLoading] = useState(false);
  const [pasteText, setPasteText] = useState('');
  
  // Search, filter, sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Row interaction
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editView, setEditView] = useState('');
  const [editEng, setEditEng] = useState('');

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copyToast, setCopyToast] = useState<{ message: string; key: number } | null>(null);

  // Drag to select cell range states
  const [selectionStart, setSelectionStart] = useState<{ rIdx: number, colIndex: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ rIdx: number, colIndex: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const isDark = theme === 'dark';

  // Theme classes
  const cardBg = isDark
    ? 'bg-white/[0.02] border-white/[0.06] backdrop-blur-xl'
    : 'bg-white border-slate-200/80 shadow-sm';
  const inputBg = isDark
    ? 'bg-white/[0.04] border-white/[0.08] text-white focus:border-violet-500/50'
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-violet-500/50';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const hoverBg = isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50';
  const sectionBg = isDark ? 'bg-violet-950/20' : 'bg-violet-50/50';
  const sectionText = isDark ? 'text-violet-300' : 'text-violet-700';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const dropZoneBg = isDark
    ? dragActive ? 'bg-violet-500/10 border-violet-500/40' : 'bg-white/[0.01] border-white/[0.08] hover:border-violet-500/30'
    : dragActive ? 'bg-violet-50 border-violet-400' : 'bg-slate-50 border-slate-200 hover:border-violet-400';

  // ============ File Parsing ============
  const parseSheet = useCallback((wb: any, sheetName: string) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return;

    const range = utils.decode_range(sheet['!ref']);
    const parsed: TrackerRow[] = [];

    for (let r = 3; r <= range.e.r; r++) {
      const getCellVal = (c: number) => {
        const cell = sheet[utils.encode_cell({ r, c })];
        return cell ? (cell.w || String(cell.v || '')) : '';
      };
      const getCellRaw = (c: number) => {
        const cell = sheet[utils.encode_cell({ r, c })];
        return cell ? cell.v : null;
      };

      const stt = getCellVal(0).trim();
      const name = getCellVal(1).trim();
      const followers = getCellVal(2).trim();
      const link = getCellVal(3).trim();
      const platform = getCellVal(4).trim();
      const linkAir = getCellVal(5).trim();
      const airDate = getCellVal(6).trim();
      const kpiViewRaw = getCellRaw(7);
      const kpiEngRaw = getCellRaw(8);
      const actualViewRaw = getCellRaw(9);
      const actualEngRaw = getCellRaw(10);
      const screenshotLink = getCellVal(11).trim();
      const runrateView = getCellVal(12).trim();
      const runrateEng = getCellVal(13).trim();
      const updateDate = getCellVal(14).trim();

      if (!stt && !name && !platform && !linkAir) continue;

      const isSection = (stt && isNaN(Number(stt)) && !name) || (stt && isNaN(Number(stt)) && name === '' && platform === '');
      const hasLink = isUrl(linkAir);

      parsed.push({
        rowIndex: r,
        stt,
        name: name || stt,
        followers,
        link,
        platform,
        linkAir,
        airDate,
        kpiView: parseNumber(kpiViewRaw),
        kpiEng: parseNumber(kpiEngRaw),
        actualView: parseNumber(actualViewRaw),
        actualEng: parseNumber(actualEngRaw),
        screenshotLink,
        runrateView,
        runrateEng,
        updateDate,
        isSection,
        hasLink,
        scrapeStatus: 'idle',
        selected: hasLink,
      });
    }

    setRows(parsed);
  }, []);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setIsLoading(true);
    setSummary(null);

    try {
      const buffer = await f.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);

      const autoSheet = wb.SheetNames.find((n: string) => n.toLowerCase().includes('performance'))
        || wb.SheetNames[0];
      setSelectedSheet(autoSheet);
      parseSheet(wb, autoSheet);
    } catch (err) {
      console.error('Failed to parse Excel file:', err);
      alert('Không thể đọc file Excel. Định dạng file có thể không được hỗ trợ.');
    } finally {
      setIsLoading(false);
    }
  }, [parseSheet]);

  const handleSheetChange = useCallback((name: string) => {
    setSelectedSheet(name);
    if (workbookRef) {
      parseSheet(workbookRef, name);
      setSummary(null);
    }
  }, [workbookRef, parseSheet]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      processFile(f);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  // ============ Google Sheets Import ============
  const handleGsheetImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gsheetUrl.trim()) return;

    setGsheetLoading(true);
    setSummary(null);
    try {
      const response = await fetch('/api/import-gsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gsheetUrl.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import Google Sheet thất bại');
      }

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      
      const sheetNameMatch = gsheetUrl.match(/gid=(\d+)/);
      const sheetName = sheetNameMatch ? `GSheet_Tab_${sheetNameMatch[1]}` : 'Google_Sheet';
      
      setFile(new File([], `${sheetName}.xlsx`));
      
      const wb = read(buffer, { type: 'array' });
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);

      const autoSheet = wb.SheetNames.find((n: string) => n.toLowerCase().includes('performance'))
        || wb.SheetNames[0];
      setSelectedSheet(autoSheet);
      parseSheet(wb, autoSheet);
      showCopyToast('Import Google Sheet thành công!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Lỗi nhập dữ liệu Google Sheet');
    } finally {
      setGsheetLoading(false);
    }
  };

  const parsePastedTSV = (text: string) => {
    if (!text.trim()) return;

    const lines = text.split('\n');
    const parsed: TrackerRow[] = [];
    let rowIndex = 3; // Start data rows index
    let headersFound = false;

    lines.forEach((line) => {
      const cols = line.split('\t');
      if (cols.length < 5) return;

      const stt = cols[0]?.trim() || '';
      const name = cols[1]?.trim() || '';
      const followers = cols[2]?.trim() || '';
      const link = cols[3]?.trim() || '';
      const platform = cols[4]?.trim() || '';
      const linkAir = cols[5]?.trim() || '';
      const airDate = cols[6]?.trim() || '';
      const kpiViewRaw = cols[7];
      const kpiEngRaw = cols[8];
      const actualViewRaw = cols[9];
      const actualEngRaw = cols[10];
      const screenshotLink = cols[11]?.trim() || '';
      const runrateView = cols[12]?.trim() || '';
      const runrateEng = cols[13]?.trim() || '';
      const updateDate = cols[14]?.trim() || '';

      // Skip header indicators if they paste headers
      if (name.toLowerCase().includes('tên') || platform.toLowerCase().includes('platform') || linkAir.toLowerCase().includes('link air')) {
        headersFound = true;
        return;
      }

      if (!stt && !name && !platform && !linkAir) return;

      const isSection = (stt && isNaN(Number(stt)) && !name) || (stt && isNaN(Number(stt)) && name === '' && platform === '');
      const hasLink = isUrl(linkAir);

      parsed.push({
        rowIndex: rowIndex++,
        stt,
        name: name || stt,
        followers,
        link,
        platform,
        linkAir,
        airDate,
        kpiView: parseNumber(kpiViewRaw),
        kpiEng: parseNumber(kpiEngRaw),
        actualView: parseNumber(actualViewRaw),
        actualEng: parseNumber(actualEngRaw),
        screenshotLink,
        runrateView,
        runrateEng,
        updateDate,
        isSection,
        hasLink,
        scrapeStatus: 'idle',
        selected: hasLink,
      });
    });

    if (parsed.length > 0) {
      // Create virtual workbook so we can download it later
      const wb = utils.book_new();
      const ws_data = [
        ['Performance Tracking Table'],
        [],
        COLUMN_HEADERS,
        ...parsed.map(r => getRowValues(r))
      ];
      const ws = utils.aoa_to_sheet(ws_data);
      utils.book_append_sheet(wb, ws, 'Performance');
      setWorkbookRef(wb);
      setSheetNames(['Performance']);
      setSelectedSheet('Performance');
      setFile(new File([], 'Pasted_Data.xlsx'));
      setRows(parsed);
      showCopyToast('Đã nhận diện và tải dữ liệu copy-paste!');
    } else {
      alert('Không thể nhận diện dữ liệu. Hãy chắc chắn bạn copy đúng các cột của bảng Excel (STT, Tên, Followers, Platform, Link Air...)');
    }
  };

  // ============ Dynamic KPI Statistics (calculated dynamically on-the-fly) ============
  const stats = useMemo(() => {
    const dataRows = rows.filter(r => !r.isSection);
    const withLink = dataRows.filter(r => r.hasLink);
    const scraped = dataRows.filter(r => r.scrapeStatus === 'done');
    
    let totalKpiView = 0;
    let totalKpiEng = 0;
    let totalActualView = 0;
    let totalActualEng = 0;
    
    dataRows.forEach(r => {
      if (r.kpiView) totalKpiView += r.kpiView;
      if (r.kpiEng) totalKpiEng += r.kpiEng;
      if (r.actualView) totalActualView += r.actualView;
      if (r.actualEng) totalActualEng += r.actualEng;
    });

    const avgRunrateView = totalKpiView > 0 ? Math.round((totalActualView / totalKpiView) * 100) : 0;
    const avgRunrateEng = totalKpiEng > 0 ? Math.round((totalActualEng / totalKpiEng) * 100) : 0;

    return {
      totalPosts: withLink.length,
      scrapedCount: scraped.length,
      totalView: totalActualView,
      totalEng: totalActualEng,
      avgRunrateView,
      avgRunrateEng,
    };
  }, [rows]);

  // ============ Selection ============
  const selectableRows = rows.filter(r => r.hasLink && !r.isSection);
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => r.selected);
  const someSelected = selectableRows.some(r => r.selected);

  const toggleSelectAll = () => {
    const newVal = !allSelected;
    setRows(prev => prev.map(r => r.hasLink && !r.isSection ? { ...r, selected: newVal } : r));
  };

  const toggleRow = (rowIndex: number) => {
    setRows(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r));
  };

  // ============ Real-time NDJSON Stream Scraping ============
  const handleUpdateSelected = async () => {
    const toScrape = rows.filter(r => r.selected && r.hasLink && !r.isSection);
    if (toScrape.length === 0) return;

    setIsScraping(true);
    setScrapeProgress({ done: 0, total: toScrape.length });
    setSummary(null);

    // Mark all target rows as pending
    setRows(prev => prev.map(r => {
      if (r.selected && r.hasLink && !r.isSection) {
        return { ...r, scrapeStatus: 'pending' as const, scrapeError: undefined };
      }
      return r;
    }));

    try {
      const links = toScrape.map(r => ({
        row: r.rowIndex,
        url: r.linkAir,
        platform: detectPlatformFromUrl(r.linkAir),
      }));

      // Set active status on first batch
      setRows(prev => prev.map(r => {
        if (r.selected && r.hasLink && r.scrapeStatus === 'pending') {
          return { ...r, scrapeStatus: 'scraping' as const };
        }
        return r;
      }));

      const response = await fetch('/api/scrape-post-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Scraping failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported on this browser');

      const decoder = new TextDecoder();
      let buffer = '';
      let doneCount = 0;
      let updated = 0;
      let failed = 0;
      let totalView = 0;
      let totalEng = 0;
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const result: ScrapeResult = JSON.parse(line);
            
            // Update individual row state immediately
            setRows(prev => prev.map(r => {
              if (r.rowIndex !== result.row) return r;

              if (result.status === 'ok') {
                updated++;
                const newView = result.view ?? r.actualView;
                const newEng = result.engagement ?? r.actualEng;
                if (newView != null) totalView += newView;
                if (newEng != null) totalEng += newEng;

                const runrateView = (r.kpiView && r.kpiView > 0 && newView != null)
                  ? `${Math.round((newView / r.kpiView) * 100)}%` : r.runrateView;
                const runrateEng = (r.kpiEng && r.kpiEng > 0 && newEng != null)
                  ? `${Math.round((newEng / r.kpiEng) * 100)}%` : r.runrateEng;

                return {
                  ...r,
                  actualView: newView,
                  actualEng: newEng,
                  runrateView,
                  runrateEng,
                  updateDate: dateStr,
                  scrapeStatus: 'done' as const,
                  scrapeDetails: result.details,
                };
              } else {
                failed++;
                return {
                  ...r,
                  scrapeStatus: 'error' as const,
                  scrapeError: result.error || 'Unknown error',
                };
              }
            }));

            doneCount++;
            setScrapeProgress(prev => ({ ...prev, done: doneCount }));
          } catch (e) {
            console.error('Error parsing NDJSON line:', e);
          }
        }
      }

      const skipped = toScrape.length - updated - failed;
      setSummary({ updated, skipped, failed, totalView, totalEng });
      setLastUpdateTime(dateStr);
    } catch (err: any) {
      console.error('Scraping stream error:', err);
      alert('Có lỗi xảy ra trong quá trình quét dữ liệu: ' + err.message);
      setRows(prev => prev.map(r => {
        if (r.scrapeStatus === 'pending' || r.scrapeStatus === 'scraping') {
          return { ...r, scrapeStatus: 'error' as const, scrapeError: err.message };
        }
        return r;
      }));
    } finally {
      setIsScraping(false);
    }
  };

  const handleRetryFailed = async () => {
    const failedRows = rows.filter(r => r.scrapeStatus === 'error' && r.hasLink && !r.isSection);
    if (failedRows.length === 0) return;

    // 1. Mark failed rows as pending and select them, select other rows as false
    setRows(prev => prev.map(r => {
      if (r.hasLink && !r.isSection) {
        if (r.scrapeStatus === 'error') {
          return { ...r, selected: true, scrapeStatus: 'pending' as const, scrapeError: undefined };
        } else {
          return { ...r, selected: false };
        }
      }
      return r;
    }));

    setIsScraping(true);
    setScrapeProgress({ done: 0, total: failedRows.length });
    setSummary(null);

    try {
      const links = failedRows.map(r => ({
        row: r.rowIndex,
        url: r.linkAir,
        platform: detectPlatformFromUrl(r.linkAir),
      }));

      // Set active status on first batch
      setRows(prev => prev.map(r => {
        if (r.scrapeStatus === 'pending' && r.hasLink && !r.isSection) {
          return { ...r, scrapeStatus: 'scraping' as const };
        }
        return r;
      }));

      const response = await fetch('/api/scrape-post-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Scraping failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported on this browser');

      const decoder = new TextDecoder();
      let buffer = '';
      let doneCount = 0;
      let updated = 0;
      let failed = 0;
      let totalView = 0;
      let totalEng = 0;
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const result: ScrapeResult = JSON.parse(line);
            
            setRows(prev => prev.map(r => {
              if (r.rowIndex !== result.row) return r;

              if (result.status === 'ok') {
                updated++;
                const newView = result.view ?? r.actualView;
                const newEng = result.engagement ?? r.actualEng;
                if (newView != null) totalView += newView;
                if (newEng != null) totalEng += newEng;

                const runrateView = (r.kpiView && r.kpiView > 0 && newView != null)
                  ? `${Math.round((newView / r.kpiView) * 100)}%` : r.runrateView;
                const runrateEng = (r.kpiEng && r.kpiEng > 0 && newEng != null)
                  ? `${Math.round((newEng / r.kpiEng) * 100)}%` : r.runrateEng;

                return {
                  ...r,
                  actualView: newView,
                  actualEng: newEng,
                  runrateView,
                  runrateEng,
                  updateDate: dateStr,
                  scrapeStatus: 'done' as const,
                  scrapeDetails: result.details,
                };
              } else {
                failed++;
                return {
                  ...r,
                  scrapeStatus: 'error' as const,
                  scrapeError: result.error || 'Unknown error',
                };
              }
            }));

            doneCount++;
            setScrapeProgress(prev => ({ ...prev, done: doneCount }));
          } catch (e) {
            console.error('Error parsing NDJSON line:', e);
          }
        }
      }

      showCopyToast(`Đã quét lại xong các dòng lỗi!`);
    } catch (err: any) {
      console.error('Scraping stream error:', err);
      alert('Có lỗi xảy ra trong quá trình quét dữ liệu: ' + err.message);
      setRows(prev => prev.map(r => {
        if (r.scrapeStatus === 'pending' || r.scrapeStatus === 'scraping') {
          return { ...r, scrapeStatus: 'error' as const, scrapeError: err.message };
        }
        return r;
      }));
    } finally {
      setIsScraping(false);
    }
  };

  // ============ Manual Inline Editing (Inside Expand Panel) ============
  const handleStartEditing = (row: TrackerRow) => {
    setEditingRowIndex(row.rowIndex);
    setEditView(row.actualView != null ? String(row.actualView) : '');
    setEditEng(row.actualEng != null ? String(row.actualEng) : '');
  };

  const handleSaveInlineEdit = (rowIndex: number) => {
    setRows(prev => prev.map(r => {
      if (r.rowIndex !== rowIndex) return r;
      
      const v = editView === '' ? null : parseInt(editView.replace(/,/g, ''));
      const e = editEng === '' ? null : parseInt(editEng.replace(/,/g, ''));
      
      const runrateView = (r.kpiView && r.kpiView > 0 && v != null)
        ? `${Math.round((v / r.kpiView) * 100)}%` : r.runrateView;
      const runrateEng = (r.kpiEng && r.kpiEng > 0 && e != null)
        ? `${Math.round((e / r.kpiEng) * 100)}%` : r.runrateEng;
      
      return {
        ...r,
        actualView: v,
        actualEng: e,
        runrateView,
        runrateEng,
        scrapeStatus: 'done' as const,
        updateDate: new Date().toLocaleDateString('vi-VN'),
      };
    }));
    setEditingRowIndex(null);
    showCopyToast('Đã lưu dữ liệu chỉnh sửa thủ công!');
  };

  // ============ Download Export Excel ============
  const handleDownload = () => {
    if (!workbookRef || !selectedSheet) return;

    const wb = read(write(workbookRef, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    const sheet = wb.Sheets[selectedSheet];

    rows.forEach(r => {
      if (r.scrapeStatus !== 'done') return;

      // Actual View (col 9)
      if (r.actualView != null) {
        const viewAddr = utils.encode_cell({ r: r.rowIndex, c: 9 });
        sheet[viewAddr] = { v: r.actualView, t: 'n', w: formatNumber(r.actualView) };
      }

      // Actual Engagement (col 10)
      if (r.actualEng != null) {
        const engAddr = utils.encode_cell({ r: r.rowIndex, c: 10 });
        sheet[engAddr] = { v: r.actualEng, t: 'n', w: formatNumber(r.actualEng) };
      }

      // Runrate View (col 12)
      if (r.kpiView && r.kpiView > 0) {
        const rvAddr = utils.encode_cell({ r: r.rowIndex, c: 12 });
        const actualViewCell = utils.encode_cell({ r: r.rowIndex, c: 9 });
        const kpiViewCell = utils.encode_cell({ r: r.rowIndex, c: 7 });
        sheet[rvAddr] = { f: `IFERROR(IF(${kpiViewCell}>0,${actualViewCell}/${kpiViewCell},""),"")`, t: 'n', z: '0%' };
      }

      // Runrate Engagement (col 13)
      if (r.kpiEng && r.kpiEng > 0) {
        const reAddr = utils.encode_cell({ r: r.rowIndex, c: 13 });
        const actualEngCell = utils.encode_cell({ r: r.rowIndex, c: 10 });
        const kpiEngCell = utils.encode_cell({ r: r.rowIndex, c: 8 });
        sheet[reAddr] = { f: `IFERROR(IF(${kpiEngCell}>0,${actualEngCell}/${kpiEngCell},""),"")`, t: 'n', z: '0%' };
      }

      // Update date (col 14)
      if (r.updateDate) {
        const dateAddr = utils.encode_cell({ r: r.rowIndex, c: 14 });
        sheet[dateAddr] = { v: r.updateDate, t: 's', w: r.updateDate };
      }
    });

    const xlsxData = write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = file?.name?.replace(/\.xlsx?$/i, '') || 'performance';
    a.download = `${baseName}_updated.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setSheetNames([]);
    setSelectedSheet('');
    setRows([]);
    setWorkbookRef(null);
    setSummary(null);
    setLastUpdateTime(null);
    setSearchQuery('');
    setPlatformFilter('all');
    setStatusFilter('all');
    setSortConfig(null);
    setExpandedRowIndex(null);
    setEditingRowIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============ Drag to Select Cells Range ============
  const isCellSelected = (rIdx: number, colIndex: number) => {
    if (!selectionStart || !selectionEnd) return false;
    const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
    const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
    const minC = Math.min(selectionStart.colIndex, selectionEnd.colIndex);
    const maxC = Math.max(selectionStart.colIndex, selectionEnd.colIndex);
    return rIdx >= minR && rIdx <= maxR && colIndex >= minC && colIndex <= maxC;
  };

  const handleCellMouseDown = (e: React.MouseEvent, rIdx: number, colIndex: number) => {
    if (e.button !== 0) return; // only left click
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    e.preventDefault();
    setSelectionStart({ rIdx, colIndex });
    setSelectionEnd({ rIdx, colIndex });
    setIsSelecting(true);
  };

  const handleCellMouseEnter = (rIdx: number, colIndex: number) => {
    if (isSelecting) {
      setSelectionEnd({ rIdx, colIndex });
    }
  };

  const getSelectionHandlers = (renderedIdx: number, colIndex: number) => {
    return {
      onMouseDown: (e: React.MouseEvent) => handleCellMouseDown(e, renderedIdx, colIndex),
      onMouseEnter: () => handleCellMouseEnter(renderedIdx, colIndex),
    };
  };

  const getSelectionClass = (renderedIdx: number, colIndex: number) => {
    if (isCellSelected(renderedIdx, colIndex)) {
      return isDark 
        ? 'bg-violet-500/20 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.4)]' 
        : 'bg-violet-100 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.3)]';
    }
    return '';
  };

  React.useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting]);


  // ============ Clipboard Copying ============
  const showCopyToast = (message: string) => {
    setCopyToast({ message, key: Date.now() });
    setTimeout(() => setCopyToast(null), 2000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopyToast(label);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyToast(label);
    }
  };

  const handleCopyRow = (row: TrackerRow) => {
    const vals = getRowValues(row);
    copyToClipboard(vals.join('\t'), `Đã copy dòng "${row.name}"`);
  };

  const handleCopyColumn = (colIndex: number) => {
    const dataRows = rows.filter(r => !r.isSection);
    const header = COLUMN_HEADERS[colIndex];
    const values = dataRows.map(r => getRowValues(r)[colIndex]);
    copyToClipboard([header, ...values].join('\n'), `Đã copy cột "${header}"`);
  };

  const handleCopyAllTable = () => {
    const dataRows = rows.filter(r => !r.isSection);
    const headerLine = COLUMN_HEADERS.join('\t');
    const dataLines = dataRows.map(r => getRowValues(r).join('\t'));
    copyToClipboard([headerLine, ...dataLines].join('\n'), `Đã copy toàn bộ bảng`);
  };

  const handleCopySelectedRows = () => {
    const selected = rows.filter(r => r.selected && !r.isSection);
    if (selected.length === 0) return;
    const headerLine = COLUMN_HEADERS.join('\t');
    const dataLines = selected.map(r => getRowValues(r).join('\t'));
    copyToClipboard([headerLine, ...dataLines].join('\n'), `Đã copy ${selected.length} dòng`);
  };

  // ============ Filtering and Sorting Logic ============
  const matchesFilter = useCallback((row: TrackerRow) => {
    if (row.isSection) return false;
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const nMatch = row.name.toLowerCase().includes(q);
      const lMatch = row.linkAir.toLowerCase().includes(q);
      const sMatch = row.stt.toLowerCase().includes(q);
      if (!nMatch && !lMatch && !sMatch) return false;
    }

    // Platform filter
    if (platformFilter !== 'all') {
      const p = row.platform.toLowerCase();
      if (platformFilter === 'tiktok' && !p.includes('tiktok')) return false;
      if (platformFilter === 'facebook' && !p.includes('facebook')) return false;
      if (platformFilter === 'instagram' && !p.includes('instagram')) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (row.scrapeStatus !== statusFilter) return false;
    }

    return true;
  }, [searchQuery, platformFilter, statusFilter]);

  const sortedAndFilteredRows = useMemo(() => {
    // 1. If sorting is active, flat list layout is standard for spreadsheets
    if (sortConfig) {
      const dataRows = rows.filter(r => !r.isSection && matchesFilter(r));
      
      dataRows.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof TrackerRow];
        let bVal: any = b[sortConfig.key as keyof TrackerRow];

        if (['kpiView', 'kpiEng', 'actualView', 'actualEng'].includes(sortConfig.key)) {
          aVal = aVal ?? -1;
          bVal = bVal ?? -1;
        } else if (['runrateView', 'runrateEng'].includes(sortConfig.key)) {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        } else {
          aVal = String(aVal || '').toLowerCase();
          bVal = String(bVal || '').toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return dataRows;
    }

    // 2. Keep section structure if no sorting is active
    const finalRows: TrackerRow[] = [];
    rows.forEach((row, idx) => {
      if (row.isSection) {
        // Render section header only if it contains visible data rows under it
        let hasVisibleChild = false;
        for (let i = idx + 1; i < rows.length; i++) {
          const nextRow = rows[i];
          if (nextRow.isSection) break;
          if (matchesFilter(nextRow)) {
            hasVisibleChild = true;
            break;
          }
        }
        if (hasVisibleChild) {
          finalRows.push(row);
        }
      } else if (matchesFilter(row)) {
        finalRows.push(row);
      }
    });

    return finalRows;
  }, [rows, matchesFilter, sortConfig]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectionStart && selectionEnd) {
          e.preventDefault();
          const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
          const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
          const minC = Math.min(selectionStart.colIndex, selectionEnd.colIndex);
          const maxC = Math.max(selectionStart.colIndex, selectionEnd.colIndex);
          
          const selectedTextLines: string[] = [];
          for (let r = minR; r <= maxR; r++) {
            const row = sortedAndFilteredRows[r];
            if (!row || row.isSection) continue;
            
            const rowValues = getRowValues(row);
            const lineCells: string[] = [];
            for (let c = minC; c <= maxC; c++) {
              let val = rowValues[c] || '';
              if ([5, 6, 7, 8].includes(c)) {
                const rawVal = c === 5 ? row.kpiView : c === 6 ? row.kpiEng : c === 7 ? row.actualView : row.actualEng;
                if (rawVal != null) val = String(rawVal);
              }
              lineCells.push(val);
            }
            selectedTextLines.push(lineCells.join('\t'));
          }
          
          if (selectedTextLines.length > 0) {
            const textToCopy = selectedTextLines.join('\n');
            copyToClipboard(textToCopy, `Đã copy vùng chọn (${selectedTextLines.length} hàng, ${maxC - minC + 1} cột)`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectionStart, selectionEnd, sortedAndFilteredRows]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      // Clear sorting
      setSortConfig(null);
      return;
    }
    setSortConfig({ key, direction });
  };

  const selectedCount = rows.filter(r => r.selected && r.hasLink && !r.isSection).length;
  const doneCount = rows.filter(r => r.scrapeStatus === 'done').length;
  const failedCount = rows.filter(r => r.scrapeStatus === 'error' && r.hasLink && !r.isSection).length;

  // ============ Render Upload / Import Zone ============
  if (!file || rows.length === 0) {
    return (
      <div className="space-y-6">
        {/* Toggle Mode */}
        <div className="flex justify-center">
          <div className={`flex p-1 rounded-xl border ${isDark ? 'bg-black/20 border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setImportMode('excel')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                importMode === 'excel'
                  ? (isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/20' : 'bg-white text-violet-600 shadow-sm border border-slate-200/50')
                  : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Upload file Excel (.xlsx)
            </button>
            <button
              onClick={() => setImportMode('gsheet')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                importMode === 'gsheet'
                  ? (isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/20' : 'bg-white text-violet-600 shadow-sm border border-slate-200/50')
                  : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              <Link2 className="h-4 w-4" />
              Nhập link Google Sheets
            </button>
            <button
              onClick={() => setImportMode('paste')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                importMode === 'paste'
                  ? (isDark ? 'bg-violet-500/20 text-violet-300 border border-violet-500/20' : 'bg-white text-violet-600 shadow-sm border border-slate-200/50')
                  : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              <Copy className="h-4 w-4" />
              Dán trực tiếp (Ctrl+V)
            </button>
          </div>
        </div>

        {importMode === 'excel' && (
          <div
            className={`relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300 ${dropZoneBg} cursor-pointer`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                isDark ? 'bg-violet-500/15' : 'bg-violet-100'
              }`}>
                {isLoading
                  ? <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
                  : <Upload className={`h-8 w-8 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                }
              </div>
              <div className="text-center">
                <p className={`text-base font-semibold ${textP}`}>
                  {isLoading ? 'Đang đọc file...' : 'Kéo thả file Excel của bạn vào đây'}
                </p>
                <p className={`text-sm mt-1 ${textS}`}>
                  hoặc click để chọn file từ máy tính (.xlsx / .xls)
                </p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs ${
                isDark ? 'bg-white/[0.04] text-slate-400 border border-white/[0.04]' : 'bg-slate-100 text-slate-500 border border-slate-200/50'
              }`}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Hỗ trợ file Performance Tracking có cấu trúc chuẩn PMAX</span>
              </div>
            </div>
          </div>
        )}

        {importMode === 'gsheet' && (
          <div className={`rounded-2xl border p-8 ${cardBg}`}>
            <form onSubmit={handleGsheetImport} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className={`text-xs font-semibold ${textP}`}>Đường dẫn Google Sheets</label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <input
                      type="url"
                      required
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=... hoặc link xuất bản web"
                      value={gsheetUrl}
                      onChange={(e) => setGsheetUrl(e.target.value)}
                      className={`w-full text-xs px-4 py-3 rounded-xl border outline-none transition-all ${inputBg}`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={gsheetLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25 transition-all shrink-0"
                  >
                    {gsheetLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang kết nối...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Nhập dữ liệu
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className={`rounded-xl p-4 border text-xs leading-relaxed space-y-1.5 ${
                isDark ? 'bg-white/[0.02] border-white/[0.06] text-slate-400' : 'bg-slate-50 border-slate-150 text-slate-500'
              }`}>
                <p className="font-semibold text-violet-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Cách vượt qua khóa quyền chia sẻ công ty (@pmax.com.vn)
                </p>
                <p>1. Trong Google Sheets, click <strong>Tệp (File)</strong> &rarr; <strong>Chia sẻ (Share)</strong> &rarr; <strong>Xuất bản lên web (Publish to web)</strong>.</p>
                <p>2. Chọn xuất bản <strong>Toàn bộ tài liệu</strong> (hoặc chỉ chọn tab Performance của bạn) và chuyển định dạng từ Web page sang <strong>Microsoft Excel (.xlsx)</strong>.</p>
                <p>3. Nhấn <strong>Xuất bản (Publish)</strong> và copy đường dẫn dạng <code>https://docs.google.com/spreadsheets/d/e/2PACX-...</code> dán vào ô bên trên.</p>
              </div>
            </form>
          </div>
        )}

        {importMode === 'paste' && (
          <div className={`rounded-2xl border p-8 ${cardBg} space-y-4`}>
            <div className="flex flex-col gap-2">
              <label className={`text-xs font-semibold ${textP}`}>Dán dữ liệu Google Sheets tại đây</label>
              <textarea
                rows={6}
                placeholder="Chọn bảng dữ liệu trong Google Sheet của bạn -> Nhấn Ctrl+C -> Click vào đây -> Nhấn Ctrl+V để dán dữ liệu..."
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  parsePastedTSV(e.target.value);
                }}
                className={`w-full text-xs p-4 rounded-xl border outline-none transition-all resize-none ${inputBg}`}
              />
            </div>
            <div className={`rounded-xl p-4 border text-xs leading-relaxed space-y-1.5 ${
              isDark ? 'bg-white/[0.02] border-white/[0.06] text-slate-400' : 'bg-slate-50 border-slate-150 text-slate-500'
            }`}>
              <p className="font-semibold text-violet-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Hướng dẫn dán dữ liệu nhanh
              </p>
              <p>1. Mở trang Google Sheet chứa bảng Performance.</p>
              <p>2. Bôi đen dải ô chứa dữ liệu (từ cột Số thứ tự STT cho đến cột Ngày cập nhật), nhấn **Ctrl + C**.</p>
              <p>3. Click vào ô nhập bên trên và nhấn **Ctrl + V**. Hệ thống sẽ tự động phân tích và tải bảng lên ngay lập tức.</p>
            </div>
          </div>
        )}

        {/* Guides */}
        <div className={`rounded-2xl border p-6 ${cardBg}`}>
          <h3 className={`text-sm font-semibold ${textP} mb-3`}>📋 Hướng dẫn quy trình sử dụng</h3>
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 text-xs ${textS}`}>
            <div className="space-y-1">
              <p className="font-semibold text-violet-400">Bước 1: Nạp Dữ Liệu</p>
              <p>Upload file Excel hoặc dán link Google Sheets. Tool tự động nhận diện sheet và trích xuất dòng bài viết.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-violet-400">Bước 2: Quét Tự Động</p>
              <p>Chọn các link bài viết (TikTok/FB/IG) muốn cập nhật. Nhấn "Update Selected" để quét dữ liệu thời gian thực.</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-violet-400">Bước 3: Nhận Kết Quả</p>
              <p>Theo dõi số liệu chạy live trên KPI card. Kiểm tra breakdown chi tiết và xuất ngược file Excel cập nhật.</p>
            </div>
          </div>
          <div className={`mt-6 pt-4 border-t ${borderC} flex items-center gap-4 text-[10px] ${textM}`}>
            <span className="flex items-center gap-1">🎵 TikTok: View + Like + Comment + Share + Save</span>
            <span>|</span>
            <span className="flex items-center gap-1">📘 Facebook: React + Comment + Share</span>
            <span>|</span>
            <span className="flex items-center gap-1">📸 Instagram: Like + Comment</span>
          </div>
        </div>
      </div>
    );
  }

  // ============ Main Dashboard Layout ============
  return (
    <div className="space-y-6">
      {/* Top File info bar */}
      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'
            }`}>
              <FileSpreadsheet className={`h-5 w-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${textP} truncate`}>{file.name}</p>
              <p className={`text-xs ${textM}`}>
                {rows.filter(r => !r.isSection).length} dòng • {rows.filter(r => r.hasLink).length} bài viết có link air
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sheetNames.length > 1 && (
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className={`text-xs px-3 py-2 rounded-xl border ${inputBg} outline-none cursor-pointer`}
              >
                {sheetNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleCopyAllTable}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              Copy Bảng
            </button>
            {selectionStart && selectionEnd && (
              <button
                onClick={() => {
                  const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
                  const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
                  const minC = Math.min(selectionStart.colIndex, selectionEnd.colIndex);
                  const maxC = Math.max(selectionStart.colIndex, selectionEnd.colIndex);
                  
                  const selectedTextLines = [];
                  for (let r = minR; r <= maxR; r++) {
                    const row = sortedAndFilteredRows[r];
                    if (!row || row.isSection) continue;
                    
                    const rowValues = getRowValues(row);
                    const lineCells = [];
                    for (let c = minC; c <= maxC; c++) {
                      let val = rowValues[c] || '';
                      if ([5, 6, 7, 8].includes(c)) {
                        const rawVal = c === 5 ? row.kpiView : c === 6 ? row.kpiEng : c === 7 ? row.actualView : row.actualEng;
                        if (rawVal != null) val = String(rawVal);
                      }
                      lineCells.push(val);
                    }
                    selectedTextLines.push(lineCells.join('\t'));
                  }
                  
                  if (selectedTextLines.length > 0) {
                    const textToCopy = selectedTextLines.join('\n');
                    copyToClipboard(textToCopy, `Đã copy vùng chọn (${selectedTextLines.length} hàng, ${maxC - minC + 1} cột)`);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? 'border-violet-500/30 text-violet-300 hover:text-violet-200 bg-violet-500/15 hover:bg-violet-500/25'
                    : 'border-violet-200 text-violet-700 hover:text-violet-800 bg-violet-50 hover:bg-violet-100'
                }`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Copy Vùng Chọn ({Math.abs(selectionEnd.rIdx - selectionStart.rIdx) + 1}x{Math.abs(selectionEnd.colIndex - selectionStart.colIndex) + 1})
              </button>
            )}
            <button
              onClick={handleReset}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'border-white/[0.08] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                  : 'border-slate-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Thay Nguồn
            </button>
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards (live status updating on the fly) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total link status card */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardBg}`}>
          <div className="space-y-1">
            <p className={`text-xs ${textS}`}>Tổng link bài viết</p>
            <p className={`text-2xl font-bold ${textP}`}>{stats.totalPosts}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
            <BarChart3 className={`h-5 w-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
          </div>
        </div>

        {/* Progress indicator card */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardBg}`}>
          <div className="space-y-1">
            <p className={`text-xs ${textS}`}>Đã quét thành công</p>
            <div className="flex items-baseline gap-2">
              <p className={`text-2xl font-bold ${textP}`}>
                {stats.scrapedCount} <span className="text-xs text-slate-500 font-normal">/ {stats.totalPosts}</span>
              </p>
            </div>
          </div>
          {/* Circular Progress bar */}
          <div className="relative w-10 h-10">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className={`${isDark ? 'text-white/[0.04]' : 'text-slate-100'}`}
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-violet-500 transition-all duration-300"
                strokeDasharray={`${stats.totalPosts > 0 ? (stats.scrapedCount / stats.totalPosts) * 100 : 0}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-violet-400">
              {stats.totalPosts > 0 ? Math.round((stats.scrapedCount / stats.totalPosts) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Total view card */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardBg}`}>
          <div className="space-y-1">
            <p className={`text-xs ${textS}`}>Tổng lượt xem (Views)</p>
            <p className={`text-2xl font-bold text-emerald-400`}>{formatNumber(stats.totalView)}</p>
          </div>
          <div className="space-y-1 text-right">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
              RR: {stats.avgRunrateView}%
            </span>
          </div>
        </div>

        {/* Total engagement card */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${cardBg}`}>
          <div className="space-y-1">
            <p className={`text-xs ${textS}`}>Tương tác (Engagement)</p>
            <p className={`text-2xl font-bold text-cyan-400`}>{formatNumber(stats.totalEng)}</p>
          </div>
          <div className="space-y-1 text-right">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-cyan-500/10 text-cyan-300' : 'bg-cyan-50 text-cyan-700'}`}>
              RR: {stats.avgRunrateEng}%
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Filter, Search, Sort controllers */}
      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-grow">
            {/* Search box */}
            <div className="relative max-w-xs w-full">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${textM}`} />
              <input
                type="text"
                placeholder="Tìm KOL, link bài viết..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all ${inputBg}`}
              />
            </div>

            {/* Platform filter dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className={`h-3.5 w-3.5 ${textM}`} />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className={`text-xs px-3 py-2 rounded-xl border ${inputBg} outline-none cursor-pointer`}
              >
                <option value="all">Tất cả Platform</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>

            {/* Status filter dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`text-xs px-3 py-2 rounded-xl border ${inputBg} outline-none cursor-pointer`}
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="idle">Chờ quét</option>
              <option value="pending">Đang đợi</option>
              <option value="scraping">Đang quét</option>
              <option value="done">Thành công</option>
              <option value="error">Thất bại</option>
            </select>
            
            {/* Reset button filters */}
            {(searchQuery || platformFilter !== 'all' || statusFilter !== 'all' || sortConfig) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPlatformFilter('all');
                  setStatusFilter('all');
                  setSortConfig(null);
                }}
                className={`text-xs px-3 py-2 font-medium hover:underline ${isDark ? 'text-violet-400' : 'text-violet-600'}`}
              >
                Xóa lọc
              </button>
            )}
          </div>
          
          <div className={`text-xs ${textS}`}>
            Hiển thị: <strong>{sortedAndFilteredRows.length}</strong> dòng
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'} border-b ${borderC}`}>
                <th className="py-3.5 px-3 text-left w-10">
                  <button onClick={toggleSelectAll} className="flex items-center">
                    {allSelected
                      ? <CheckSquare className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                      : someSelected
                      ? <Minus className={`h-4 w-4 ${isDark ? 'text-violet-400/50' : 'text-violet-400'}`} />
                      : <Square className={`h-4 w-4 ${textM}`} />
                    }
                  </button>
                </th>
                
                {/* Headers */}
                {COLUMN_HEADERS.map((header, i) => {
                  const key = COLUMN_KEYS[i];
                  const isSortable = ['stt', 'name', 'kpiView', 'kpiEng', 'actualView', 'actualEng', 'runrateView', 'runrateEng'].includes(key);
                  const isSorted = sortConfig && sortConfig.key === key;
                  
                  return (
                    <th
                      key={header}
                      onClick={() => {
                        if (isSortable) requestSort(key);
                      }}
                      title={isSortable ? `Click để sắp xếp cột "${header}"` : undefined}
                      className={`py-3.5 px-2 font-semibold transition-colors select-none ${
                        i >= 4 ? 'text-right' : 'text-left'
                      } ${textS} ${
                        i === 0 ? 'w-10' : i === 1 ? 'min-w-[160px]' : i === 2 ? 'w-20' : i === 3 ? 'min-w-[120px]' : 'w-24'
                      } ${isSortable ? 'cursor-pointer hover:bg-white/[0.04] text-slate-300' : ''}`}
                    >
                      <div className={`flex items-center gap-1 group ${i >= 4 ? 'justify-end' : 'justify-start'}`}>
                        <span>{header}</span>
                        {isSortable && (
                          <span className="text-[9px] shrink-0 text-slate-500">
                            {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyColumn(i);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-violet-400 hover:bg-white/10 rounded ml-1"
                          title={`Copy cột "${header}"`}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className={`py-3.5 px-2 text-center font-medium ${textS} w-10`}>Chi tiết</th>
                <th className={`py-3.5 px-2 text-center font-medium ${textS} w-10`}>Copy</th>
                <th className={`py-3.5 px-2 text-center font-medium ${textS} w-16`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredRows.map((row, renderedIdx) => {
                if (row.isSection) {
                  return (
                    <tr key={row.rowIndex} className={sectionBg}>
                      <td colSpan={16} className={`py-2.5 px-4 font-bold text-xs border-b ${borderC} ${sectionText}`}>
                        {row.name || row.stt}
                      </td>
                    </tr>
                  );
                }

                const isExpanded = expandedRowIndex === row.rowIndex;
                const isEditing = editingRowIndex === row.rowIndex;

                return (
                  <React.Fragment key={row.rowIndex}>
                    <tr
                      className={`border-b ${borderC} transition-all duration-150 ${
                        row.hasLink ? hoverBg : (isDark ? 'opacity-40' : 'opacity-50')
                      } ${row.scrapeStatus === 'done'
                        ? (isDark ? 'bg-emerald-500/[0.02]' : 'bg-emerald-50/20')
                        : row.scrapeStatus === 'error'
                        ? (isDark ? 'bg-rose-500/[0.02]' : 'bg-rose-50/20')
                        : ''
                      } ${isExpanded ? (isDark ? 'bg-violet-500/[0.04]' : 'bg-violet-50/30') : ''}`}
                    >
                      <td className="py-3 px-3">
                        {row.hasLink && (
                          <button onClick={() => toggleRow(row.rowIndex)}>
                            {row.selected
                              ? <CheckSquare className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                              : <Square className={`h-4 w-4 ${textM}`} />
                            }
                          </button>
                        )}
                      </td>
                      <td 
                        {...getSelectionHandlers(renderedIdx, 0)}
                        className={`py-3 px-2 ${textM} ${getSelectionClass(renderedIdx, 0)}`}
                      >
                        {row.stt}
                      </td>
                      <td 
                        {...getSelectionHandlers(renderedIdx, 1)}
                        className={`py-3 px-2 font-medium ${textP} ${getSelectionClass(renderedIdx, 1)}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[150px]">{row.name}</span>
                          {row.followers && (
                            <span className={`text-[10px] px-1 py-0.2 rounded border ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'} shrink-0`}>
                              {row.followers}
                            </span>
                          )}
                        </div>
                      </td>
                      <td 
                        {...getSelectionHandlers(renderedIdx, 2)}
                        className={`py-3 px-2 ${getSelectionClass(renderedIdx, 2)}`}
                      >
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                          row.platform.toLowerCase().includes('tiktok')
                            ? (isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-700')
                            : row.platform.toLowerCase().includes('facebook')
                            ? (isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700')
                            : row.platform.toLowerCase().includes('instagram')
                            ? (isDark ? 'bg-pink-500/15 text-pink-300' : 'bg-pink-50 text-pink-700')
                            : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')
                        }`}>
                          {getPlatformIcon(row.platform)} {row.platform}
                        </span>
                      </td>
                      <td 
                        {...getSelectionHandlers(renderedIdx, 3)}
                        className={`py-3 px-2 ${getSelectionClass(renderedIdx, 3)}`}
                      >
                        {row.hasLink ? (
                          <a
                            href={row.linkAir}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-all ${
                              isDark ? 'text-violet-400 hover:text-violet-300 hover:underline' : 'text-violet-600 hover:text-violet-700 hover:underline'
                            }`}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[80px]">Xem bài</span>
                          </a>
                        ) : (
                          <span className={`text-[10px] ${textM}`}>—</span>
                        )}
                      </td>
                      <td 
                        {...getSelectionHandlers(renderedIdx, 4)}
                        className={`py-3 px-2 text-right tabular-nums ${textS} ${getSelectionClass(renderedIdx, 4)}`}
                      >
                        {row.airDate || '—'}
                      </td>
                      
                      {/* KPI View */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 5)}
                        className={`py-3 px-2 text-right tabular-nums ${textS} ${getSelectionClass(renderedIdx, 5)}`}
                      >
                        {formatNumber(row.kpiView)}
                      </td>
                      
                      {/* KPI Eng */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 6)}
                        className={`py-3 px-2 text-right tabular-nums ${textS} ${getSelectionClass(renderedIdx, 6)}`}
                      >
                        {formatNumber(row.kpiEng)}
                      </td>
                      
                      {/* Actual View */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 7)}
                        onClick={() => {
                          if (row.actualView != null) {
                            copyToClipboard(String(row.actualView), `Đã copy Actual View: ${formatNumber(row.actualView)}`);
                          }
                        }}
                        className={`py-3 px-2 text-right tabular-nums font-semibold transition-all select-none group/cell ${
                          row.actualView != null ? 'cursor-pointer hover:bg-violet-500/10 active:scale-95' : ''
                        } ${
                          row.scrapeStatus === 'done' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : textP
                        } ${getSelectionClass(renderedIdx, 7)}`}
                        title={row.actualView != null ? `Nhấp để copy: ${row.actualView}` : undefined}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {row.actualView != null && (
                            <Copy className="h-3 w-3 opacity-0 group-hover/cell:opacity-60 transition-opacity shrink-0" />
                          )}
                          <span>{row.actualView != null ? formatNumber(row.actualView) : '—'}</span>
                        </div>
                      </td>
                      
                      {/* Actual Eng */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 8)}
                        onClick={() => {
                          if (row.actualEng != null) {
                            copyToClipboard(String(row.actualEng), `Đã copy Actual Eng: ${formatNumber(row.actualEng)}`);
                          }
                        }}
                        className={`py-3 px-2 text-right tabular-nums font-semibold transition-all select-none group/cell ${
                          row.actualEng != null ? 'cursor-pointer hover:bg-violet-500/10 active:scale-95' : ''
                        } ${
                          row.scrapeStatus === 'done' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : textP
                        } ${getSelectionClass(renderedIdx, 8)}`}
                        title={row.actualEng != null ? `Nhấp để copy: ${row.actualEng}` : undefined}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {row.actualEng != null && (
                            <Copy className="h-3 w-3 opacity-0 group-hover/cell:opacity-60 transition-opacity shrink-0" />
                          )}
                          <span>{row.actualEng != null ? formatNumber(row.actualEng) : '—'}</span>
                        </div>
                      </td>
                      
                      {/* Runrate View */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 9)}
                        className={`py-3 px-2 text-right tabular-nums ${getRunrateColor(row.runrateView, isDark)} ${getSelectionClass(renderedIdx, 9)}`}
                      >
                        {formatPercent(row.runrateView)}
                      </td>
                      
                      {/* Runrate Eng */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 10)}
                        className={`py-3 px-2 text-right tabular-nums ${getRunrateColor(row.runrateEng, isDark)} ${getSelectionClass(renderedIdx, 10)}`}
                      >
                        {formatPercent(row.runrateEng)}
                      </td>
                      
                      {/* Update Date */}
                      <td 
                        {...getSelectionHandlers(renderedIdx, 11)}
                        onClick={() => {
                          if (row.updateDate) {
                            copyToClipboard(row.updateDate, `Đã copy Ngày cập nhật: ${row.updateDate}`);
                          }
                        }}
                        className={`py-3 px-2 text-right transition-all select-none group/cell ${
                          row.updateDate ? 'cursor-pointer hover:bg-violet-500/10 active:scale-95 font-medium' : ''
                        } ${textS} ${getSelectionClass(renderedIdx, 11)}`}
                        title={row.updateDate ? `Nhấp để copy: ${row.updateDate}` : undefined}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {row.updateDate && (
                            <Copy className="h-3 w-3 opacity-0 group-hover/cell:opacity-60 transition-opacity shrink-0" />
                          )}
                          <span>{row.updateDate || '—'}</span>
                        </div>
                      </td>

                      {/* Expand panel toggle button */}
                      <td className="py-3 px-2 text-center">
                        {!row.isSection && (
                          <button
                            onClick={() => setExpandedRowIndex(isExpanded ? null : row.rowIndex)}
                            className={`p-1 rounded-lg transition-all ${
                              isDark
                                ? 'hover:bg-white/[0.06] text-slate-500 hover:text-violet-400'
                                : 'hover:bg-slate-100 text-slate-400 hover:text-violet-600'
                            }`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </td>

                      {/* Copy row button */}
                      <td className="py-3 px-2 text-center">
                        {!row.isSection && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyRow(row); }}
                            className={`p-1 rounded-lg transition-all ${
                              isDark
                                ? 'hover:bg-white/[0.06] text-slate-500 hover:text-slate-300'
                                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>

                      {/* Status indicator */}
                      <td className="py-3 px-2 text-center">
                        {row.scrapeStatus === 'idle' && row.hasLink && (
                          <span className={`text-[10px] ${textM}`}>—</span>
                        )}
                        {row.scrapeStatus === 'pending' && (
                          <Clock className={`h-4 w-4 mx-auto ${isDark ? 'text-amber-400 animate-pulse' : 'text-amber-500 animate-pulse'}`} />
                        )}
                        {row.scrapeStatus === 'scraping' && (
                          <Loader2 className={`h-4 w-4 mx-auto animate-spin ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
                        )}
                        {row.scrapeStatus === 'done' && (
                          <CheckCircle2 className={`h-4 w-4 mx-auto ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        )}
                        {row.scrapeStatus === 'error' && (
                          <div className="relative group cursor-help">
                            <AlertCircle className={`h-4 w-4 mx-auto ${isDark ? 'text-rose-400' : 'text-rose-500'}`} />
                            {row.scrapeError && (
                              <div className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-1.5 rounded-lg text-[10px] shadow-xl whitespace-nowrap hidden group-hover:block ${
                                isDark ? 'bg-slate-800 text-rose-300 border border-slate-700' : 'bg-white text-rose-700 border border-rose-100 shadow-slate-200/50'
                              }`}>
                                {row.scrapeError}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expand Panel detail row */}
                    {isExpanded && (
                      <tr className={`${isDark ? 'bg-violet-950/[0.08] border-violet-500/10' : 'bg-violet-50/10'}`}>
                        <td colSpan={16} className={`py-4 px-6 border-b ${borderC}`}>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left: Platform metrics breakdown */}
                            <div className="lg:col-span-8 space-y-4">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-xs font-bold ${textP}`}>
                                  📊 Chi tiết Tương tác ({row.platform})
                                </h4>
                                <span className={`text-[10px] ${textS}`}>[Dữ liệu quét thời gian thực]</span>
                              </div>
                              
                              {row.scrapeDetails ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {row.platform.toLowerCase().includes('tiktok') && (
                                    <>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Heart className="h-3 w-3 text-cyan-400" /> Thích (Likes)</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.likes)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><MessageCircle className="h-3 w-3 text-cyan-400" /> Bình luận</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.comments)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Share2 className="h-3 w-3 text-cyan-400" /> Chia sẻ</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.shares)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Bookmark className="h-3 w-3 text-cyan-400" /> Lưu lại (Saves)</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.saves)}</p>
                                      </div>
                                    </>
                                  )}

                                  {row.platform.toLowerCase().includes('facebook') && (
                                    <>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Heart className="h-3 w-3 text-blue-400" /> Cảm xúc (Reactions)</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.reactions)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><MessageCircle className="h-3 w-3 text-blue-400" /> Bình luận</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.comments)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Share2 className="h-3 w-3 text-blue-400" /> Chia sẻ</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.shares)}</p>
                                      </div>
                                      <div className="hidden md:block opacity-0"></div>
                                    </>
                                  )}

                                  {row.platform.toLowerCase().includes('instagram') && (
                                    <>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><Heart className="h-3 w-3 text-pink-400" /> Likes</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.likes)}</p>
                                      </div>
                                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-100'}`}>
                                        <p className={`text-[10px] ${textS} flex items-center gap-1`}><MessageCircle className="h-3 w-3 text-pink-400" /> Bình luận</p>
                                        <p className={`text-sm font-bold ${textP} mt-1`}>{formatNumber(row.scrapeDetails.comments)}</p>
                                      </div>
                                      <div className="hidden md:block opacity-0"></div>
                                      <div className="hidden md:block opacity-0"></div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className={`text-xs ${textM} italic`}>Chưa có dữ liệu chi tiết của platform. Vui lòng bấm update dòng này.</p>
                              )}
                            </div>

                            {/* Right: Manual edit overlay inputs */}
                            <div className={`lg:col-span-4 p-4 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                              <div className="flex items-center justify-between">
                                <h4 className={`text-xs font-bold ${textP} flex items-center gap-1`}>
                                  <Edit3 className="h-3.5 w-3.5" /> Điều chỉnh thủ công
                                </h4>
                                {!isEditing && (
                                  <button
                                    onClick={() => handleStartEditing(row)}
                                    className={`text-[10px] font-semibold transition-all px-2 py-1 rounded border ${
                                      isDark ? 'border-white/10 hover:bg-white/5 text-violet-400' : 'border-slate-200 hover:bg-slate-100 text-violet-600'
                                    }`}
                                  >
                                    Chỉnh sửa
                                  </button>
                                )}
                              </div>

                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className={`text-[10px] ${textS}`}>Actual View</label>
                                      <input
                                        type="text"
                                        value={editView}
                                        onChange={(e) => setEditView(e.target.value)}
                                        className={`w-full text-xs px-2 py-1.5 rounded border outline-none ${inputBg}`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className={`text-[10px] ${textS}`}>Actual Eng</label>
                                      <input
                                        type="text"
                                        value={editEng}
                                        onChange={(e) => setEditEng(e.target.value)}
                                        className={`w-full text-xs px-2 py-1.5 rounded border outline-none ${inputBg}`}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingRowIndex(null)}
                                      className={`text-[10px] px-2 py-1 rounded ${isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                                    >
                                      Hủy
                                    </button>
                                    <button
                                      onClick={() => handleSaveInlineEdit(row.rowIndex)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow"
                                    >
                                      <Save className="h-3 w-3" /> Lưu
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs space-y-1 text-slate-400">
                                  <p>• Actual View: <strong>{row.actualView != null ? formatNumber(row.actualView) : 'Chưa có'}</strong></p>
                                  <p>• Actual Engagement: <strong>{row.actualEng != null ? formatNumber(row.actualEng) : 'Chưa có'}</strong></p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className={`sticky bottom-4 z-10 rounded-2xl border p-4 backdrop-blur-xl ${
        isDark
          ? 'bg-[#0d0d14]/90 border-white/[0.08] shadow-2xl shadow-black/40'
          : 'bg-white/90 border-slate-200/80 shadow-xl shadow-slate-200/50'
      }`}>
        {/* Real-time Scraping Process Line indicator running along the top of sticky bar */}
        {isScraping && (
          <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden rounded-t-2xl">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300"
              style={{ width: `${(scrapeProgress.done / scrapeProgress.total) * 100}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`text-xs ${textS}`}>
              Đã chọn <strong>{selectedCount}</strong> / {selectableRows.length} dòng bài viết
            </span>
            {isScraping && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <span className={`text-xs ${textS}`}>
                  Đang quét dữ liệu... ({scrapeProgress.done}/{scrapeProgress.total})
                </span>
              </div>
            )}
            {selectedCount > 0 && !isScraping && (
              <button
                onClick={handleCopySelectedRows}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  isDark
                    ? 'border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Rows className="h-3.5 w-3.5" />
                Copy {selectedCount} Dòng Đã Chọn
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {doneCount > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
              >
                <Download className="h-4 w-4" />
                Xuất file Excel đã cập nhật
              </button>
            )}
            {failedCount > 0 && !isScraping && (
              <button
                onClick={handleRetryFailed}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                    : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <RefreshCw className="h-4 w-4" />
                Quét lại dòng lỗi ({failedCount})
              </button>
            )}
            <button
              onClick={handleUpdateSelected}
              disabled={isScraping || selectedCount === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isScraping || selectedCount === 0
                  ? (isDark ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700 shadow-lg shadow-violet-500/25'
              }`}
            >
              {isScraping
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang cập nhật live...</>
                : <><RefreshCw className="h-4 w-4" /> Update Selected ({selectedCount})</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Copy feedback Toast */}
      {copyToast && (
        <div
          key={copyToast.key}
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium shadow-2xl transition-all ${
            isDark
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-xl'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-emerald-200/50'
          }`}
          style={{ animation: 'fadeIn 0.2s ease-out, fadeIn 0.2s ease-in 1.8s reverse forwards' }}
        >
          <ClipboardCheck className="h-4 w-4" />
          {copyToast.message}
        </div>
      )}
    </div>
  );
}
