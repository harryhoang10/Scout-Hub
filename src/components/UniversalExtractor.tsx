import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileDown, Trash2, Link as LinkIcon, Globe, Play, Save, CheckCircle, AlertCircle, Loader2, Send } from 'lucide-react';
import { ProfileData, RestoredData, Tier } from '../types';
import * as XLSX from 'xlsx';
import { upsertToSheet } from '../lib/api';

import { GoogleGenAI } from "@google/genai";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

interface UniversalExtractorProps {
  onSaveToRestored: (data: RestoredData[]) => void;
  webhookUrl?: string;
  theme?: string;
}

// Detect platform from URL
function detectPlatform(url: string): 'TikTok' | 'Facebook' | null {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'Facebook';
  return null;
}

// Format followers
function formatFollowers(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '' || val === 'N/A') return '';
  if (typeof val === 'number') {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return val.toString();
  }
  const num = parseFloat(val.toString().replace(/,/g, ''));
  if (!isNaN(num)) {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  }
  let strVal = val.toString().toLowerCase().trim();
  let multiplier = 1;
  if (strVal.includes('triệu') || strVal.endsWith('m')) multiplier = 1_000_000;
  else if (strVal.includes('nghìn') || strVal.includes('ngàn') || strVal.endsWith('k')) multiplier = 1_000;
  const numStr = strVal.replace(/[^0-9.,]/g, '').replace(',', '.');
  const parsed = parseFloat(numStr) * multiplier;
  if (isNaN(parsed)) return val.toString();
  if (parsed >= 1_000_000) return (parsed / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (parsed >= 1_000) return (parsed / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return parsed.toString();
}

function formatNumber(val: number | undefined): string {
  if (!val) return '-';
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return val.toString();
}

export function UniversalExtractor({ onSaveToRestored, webhookUrl, theme }: UniversalExtractorProps) {
  const [links, setLinks] = useState<ProfileData[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_LINKS = 20;
  const PARALLEL_COUNT = 3; // Restored to 3, AI prompt optimized for resilience
  
  // We use process.env to avoid vite TS errors if env types aren't fully configured
  const GEMINI_API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY;

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';
  const inputBg = isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const tableBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const rowHover = isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50';
  const borderC = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const dropBg = isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200';
  const tagBg = isDark ? 'bg-violet-900/40 text-violet-300' : 'bg-violet-100 text-violet-700';
  const btnPrimary = 'bg-violet-600 text-white hover:bg-violet-700';
  const btnOutline = isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50';

  const addLinks = useCallback((urls: string[]) => {
    const validUrls = urls
      .map(u => u.trim())
      .filter(u => u && detectPlatform(u))
      .filter(u => !links.some(l => l.url === u));
    
    const remaining = MAX_LINKS - links.length;
    const toAdd = validUrls.slice(0, remaining);
    
    const newLinks: ProfileData[] = toAdd.map(url => ({
      id: Math.random().toString(36).substring(7),
      url,
      status: 'pending',
      platform: detectPlatform(url) || 'TikTok',
    }));
    
    setLinks(prev => [...prev, ...newLinks]);
    setManualInput('');
  }, [links]);

  const handleManualAdd = () => {
    if (!manualInput.trim()) return;
    const urls = manualInput.split('\n').filter(u => u.trim());
    addLinks(urls);
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
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const urls: string[] = [];
        rows.forEach(row => {
          row.forEach(cell => {
            if (typeof cell === 'string' && detectPlatform(cell)) urls.push(cell);
          });
        });
        addLinks(urls);
      } catch (error) {
        alert('Lỗi đọc file.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      const file = files[0];
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  // Process links in parallel batches
  const processLinks = async () => {
    if (links.length === 0) return;
    setIsProcessing(true);

    const pending = links.filter(l => l.status === 'pending' || l.status === 'error');
    
    for (let i = 0; i < pending.length; i += PARALLEL_COUNT) {
      const batch = pending.slice(i, i + PARALLEL_COUNT);
      
      await Promise.all(batch.map(async (link) => {
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'processing' } : l));
        
        try {
          let result: Partial<ProfileData>;
          
          if (link.platform === 'TikTok') {
            result = await scrapeTikTok(link.url);
          } else {
            result = await scrapeFacebook(link.url);
          }

          setLinks(prev => prev.map(l => l.id === link.id ? { ...l, ...result, status: 'success' } : l));
        } catch (error: any) {
          setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'error', errorMsg: error.message } : l));
        }
      }));
      
      // Small delay between batches
      if (i + PARALLEL_COUNT < pending.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setIsProcessing(false);
  };

  const scrapeTikTok = async (url: string): Promise<Partial<ProfileData>> => {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Lỗi scrape TikTok');
    }
    const data = await response.json();
    
    let aiPhone = '', aiEmail = '', aiBioLink = '';
    if (GEMINI_API_KEY && data.bio && data.bio.trim().length > 5) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const aiResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Trích xuất thông tin liên hệ từ tiểu sử (bio) mạng xã hội này. Chú ý các chiêu trò lách luật viết chữ thay số, chèn dấu chấm/cách giữa các số, dùng icon, hoặc ghi "Zalo", "Za l0", "zl", "búc kinh".
TRẢ LỜI NGẮN GỌN THEO ĐÚNG ĐỊNH DẠNG. Chỉ trả lời thông tin, không thêm giải thích. Nếu không tìm thấy, MỚI ghi 'N/A'.
Phone: [SĐT nếu có (xoá khoảng trắng/dấu chấm), nếu không có ghi N/A]
Email: [Email nếu có, nếu không ghi N/A]
BioLink: [Các link website/shopee/contact ngoài nếu có, nếu không ghi N/A]

Bio: "${data.bio}"`,
        });
        const text = aiResponse?.text || '';
        const phoneMatch = text.match(/Phone:\s*([^\n]+)/i);
        const emailMatch = text.match(/Email:\s*([^\n]+)/i);
        const bioLinkMatch = text.match(/BioLink:\s*([^\n]+)/i);
        
        if (phoneMatch && phoneMatch[1].trim() !== 'N/A') aiPhone = phoneMatch[1].trim();
        if (emailMatch && emailMatch[1].trim() !== 'N/A') aiEmail = emailMatch[1].trim();
        if (bioLinkMatch && bioLinkMatch[1].trim() !== 'N/A') aiBioLink = bioLinkMatch[1].trim();
      } catch (e) { /* AI fail is non-blocking */ }
    }

    // Fetch video engagement metrics via RapidAPI (non-blocking)
    let averageView = 0, averageEngagement = 0, totalSaves = 0;
    let videoTotalLikes = data.totalLikes || 0;
    let videoTotalComments = data.totalComments || 0;
    let videoTotalShares = data.totalShares || 0;
    let videoCount = data.videoCount || 0;
    
    if (data.channelId) {
      try {
        const videoRes = await fetch('/api/tiktok-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: data.channelId }),
        });
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          averageView = videoData.averageView || 0;
          averageEngagement = videoData.averageEngagement || 0;
          videoCount = videoData.videoCount || videoCount;
          if (videoData.totals) {
            videoTotalLikes = videoData.totals.likes || videoTotalLikes;
            videoTotalComments = videoData.totals.comments || videoTotalComments;
            videoTotalShares = videoData.totals.shares || videoTotalShares;
            totalSaves = videoData.totals.saves || 0;
          }
        }
      } catch (e) {
        console.warn('Video engagement fetch failed (non-blocking):', e);
      }
    }

    return {
      nickname: data.nickname,
      channelId: data.channelId,
      followers: data.followers,
      following: data.following,
      likes: data.likes,
      bio: data.bio,
      profilePic: data.profilePic,
      phone: aiPhone || data.phone || 'N/A',
      email: aiEmail || data.email || 'N/A',
      bioLink: aiBioLink || data.bioLink || 'N/A',
      platform: 'TikTok',
      averageView,
      averageEngagement,
      totalLikes: videoTotalLikes,
      totalComments: videoTotalComments,
      totalShares: videoTotalShares,
      totalSaves,
      videoCount,
    };
  };

  const scrapeFacebook = async (url: string): Promise<Partial<ProfileData>> => {
    const response = await fetch('/api/extract-facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Lỗi extract Facebook');
    }
    const data = await response.json();

    // AI extraction for phone, email, bio link
    let aiPhone = '', aiEmail = '', aiBioLink = '';
    if (GEMINI_API_KEY && data.description && data.description.trim().length > 5) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const isGroup = url.toLowerCase().includes('/groups/');
        const aiResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Trích xuất thông tin liên hệ từ mô tả Facebook này. Chú ý các chiêu trò lách luật viết chữ thay số, chèn dấu chấm/cách giữa các số, hoặc ghi "lh", "liên hệ", "booking".
TRẢ LỜI NGẮN GỌN THEO ĐÚNG ĐỊNH DẠNG. Chỉ trả lời thông tin, không thêm giải thích. Nếu không tìm thấy, MỚI ghi 'N/A'.
Phone: [SĐT nếu có (xoá khoảng trắng/dấu chấm), nếu không có ghi N/A]
Email: [Email nếu có, nếu không ghi N/A]
BioLink: [Các link website ngoài (không phải FB) nếu có, nếu không ghi N/A]
ProfileType: [${isGroup ? 'Community' : 'Individual hoặc Community'}]

Tên: "${data.nickname}"
Mô tả: "${data.description}"`,
        });
        const text = aiResponse?.text || '';
        const phoneMatch = text.match(/Phone:\s*([^\n]+)/i);
        const emailMatch = text.match(/Email:\s*([^\n]+)/i);
        const bioLinkMatch = text.match(/BioLink:\s*([^\n]+)/i);
        
        if (phoneMatch && phoneMatch[1].trim() !== 'N/A') aiPhone = phoneMatch[1].trim();
        if (emailMatch && emailMatch[1].trim() !== 'N/A') aiEmail = emailMatch[1].trim();
        if (bioLinkMatch && bioLinkMatch[1].trim() !== 'N/A') aiBioLink = bioLinkMatch[1].trim();
      } catch (e) { /* AI fail is non-blocking */ }
    }

    return {
      nickname: data.nickname || data.title,
      channelId: '',
      followers: data.followers,
      bio: data.description,
      profilePic: data.profilePic,
      phone: aiPhone || data.phone || 'N/A',
      email: aiEmail || data.email || 'N/A',
      bioLink: aiBioLink || 'N/A',
      platform: 'Facebook',
      profileType: url.toLowerCase().includes('/groups/') ? 'Community' : 'Individual',
    };
  };

  const handleSaveToCRM = async () => {
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;

    const today = new Date();
    const saveDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const determineTier = (followersStr: string | number): Tier => {
      const followers = typeof followersStr === 'number' ? followersStr : parseInt(String(followersStr).replace(/,/g, ''), 10);
      if (isNaN(followers)) return 'UGC';
      if (followers > 800000) return 'Macro';
      if (followers >= 100000) return 'Micro';
      if (followers >= 10000) return 'Nano';
      return 'UGC';
    };

    const data: RestoredData[] = successLinks.map(l => ({
      ...l,
      tier: [determineTier(l.followers)],
      location: [],
      group: [],
      campaign: [],
      sow: [],
      notes: [],
      rateHistory: [],
      rating: 0,
      saveDate,
    }));

    if (webhookUrl) {
      setWebhookStatus('sending');
      upsertToSheet(webhookUrl, data).then(success => {
        if (success) {
          setWebhookStatus('sent');
          setTimeout(() => setWebhookStatus('idle'), 3000);
        } else {
          setWebhookStatus('error');
          setTimeout(() => setWebhookStatus('idle'), 3000);
        }
      });
    }

    onSaveToRestored(data);
    setLinks(prev => prev.filter(l => l.status !== 'success'));
  };

  const handleSaveToWebhook = async () => {
    if (!webhookUrl) return;
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;

    const today = new Date();
    const saveDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const determineTier = (followersStr: string | number): Tier => {
      const followers = typeof followersStr === 'number' ? followersStr : parseInt(String(followersStr).replace(/,/g, ''), 10);
      if (isNaN(followers)) return 'UGC';
      if (followers > 800000) return 'Macro';
      if (followers >= 100000) return 'Micro';
      if (followers >= 10000) return 'Nano';
      return 'UGC';
    };

    const data: RestoredData[] = successLinks.map(l => ({
      ...l,
      tier: [determineTier(l.followers)],
      location: [],
      group: [],
      campaign: [],
      sow: [],
      notes: [],
      rateHistory: [],
      rating: 0,
      saveDate,
    }));

    setWebhookStatus('sending');
    const success = await upsertToSheet(webhookUrl, data);
    if (success) {
      setWebhookStatus('sent');
      setTimeout(() => setWebhookStatus('idle'), 3000);
    } else {
      setWebhookStatus('error');
      setTimeout(() => setWebhookStatus('idle'), 3000);
    }
  };

  const formatFollowersForDisplay = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '-';
    let num = typeof val === 'number' ? val : parseFloat(val.toString().trim().replace(/,/g, ''));
    if (isNaN(num)) return val.toString(); // Fallback if unable to parse text 
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
  };

  const exportToExcel = () => {
    const successLinks = links.filter(l => l.status === 'success');
    if (successLinks.length === 0) return;
    const exportData = successLinks.map((l, i) => ({
      'STT': i + 1,
      'Platform': l.platform || 'TikTok',
      'Tên': l.nickname || '',
      'ID': l.channelId || '',
      'Followers': formatFollowersForDisplay(l.followers),
      'Avg View': l.averageView || '',
      'Avg Engagement': l.averageEngagement || '',
      'SĐT': l.phone || '',
      'Email': l.email || '',
      'Link Bio': l.bioLink || '',
      'Link': l.url,
      'Bio': l.bio || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extracted");
    XLSX.writeFile(wb, "scout_hub_extracted.xlsx", { bookType: 'xlsx' });
  };

  const clearAll = () => { setLinks([]); };
  const removeLink = (id: string) => { setLinks(prev => prev.filter(l => l.id !== id)); };
  const successCount = links.filter(l => l.status === 'success').length;

  return (
    <div className="space-y-5">
      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Manual Input */}
        <div className={`col-span-2 rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Globe className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
            <h3 className={`text-sm font-semibold ${textP}`}>Nhập link thủ công</h3>
          </div>
          <p className={`text-xs ${textM} mb-3`}>Hỗ trợ cả TikTok & Facebook - mỗi link một dòng</p>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={"https://www.tiktok.com/@username1\nhttps://www.facebook.com/page1\nhttps://www.tiktok.com/@username2"}
            className={`w-full h-28 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none ${inputBg}`}
          />
          <button
            onClick={handleManualAdd}
            disabled={!manualInput.trim() || links.length >= MAX_LINKS}
            className={`mt-2 w-full py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ${btnPrimary}`}
          >
            Thêm vào danh sách ({links.length}/{MAX_LINKS})
          </button>
        </div>

        {/* File Upload */}
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Upload className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
            <h3 className={`text-sm font-semibold ${textP}`}>Tải lên file (Excel/CSV)</h3>
          </div>
          <p className={`text-xs ${textM} mb-3`}>Hệ thống tự tìm link TikTok & Facebook trong file</p>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dropBg}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`h-6 w-6 mx-auto mb-2 ${textM}`} />
            <p className={`text-xs ${textS}`}>Kéo thả file hoặc click để chọn</p>
          </div>
          <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`mt-2 w-full py-2 text-sm font-medium rounded-lg border transition-colors ${btnOutline}`}
          >
            Chọn file (.xlsx, .csv)
          </button>
        </div>
      </div>

      {/* Processing Table */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className={`px-5 py-4 border-b ${borderC} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div>
            <h3 className={`text-sm font-semibold ${textP}`}>Danh sách xử lý</h3>
            <span className={`text-xs ${textM}`}>{links.length}/{MAX_LINKS} link</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={clearAll} disabled={links.length === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa hết
            </button>
            <button onClick={handleSaveToCRM} disabled={successCount === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-emerald-400 hover:bg-emerald-500/10' : 'border-slate-200 text-emerald-600 hover:bg-emerald-50'}`}>
              <Save className="h-3.5 w-3.5 mr-1" /> Lưu vào CRM
            </button>
            {webhookUrl && (
              <button 
                onClick={handleSaveToWebhook} 
                disabled={successCount === 0 || webhookStatus === 'sending'} 
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                  webhookStatus === 'sent' 
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' 
                    : webhookStatus === 'error'
                    ? 'border-red-500/30 text-red-400 bg-red-500/10'
                    : isDark ? 'border-white/10 text-blue-400 hover:bg-blue-500/10' : 'border-slate-200 text-blue-600 hover:bg-blue-50'
                }`}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                {webhookStatus === 'sending' ? 'Đang gửi...' : webhookStatus === 'sent' ? '✓ Đã gửi Sheet' : webhookStatus === 'error' ? '✕ Lỗi' : 'Gửi → Sheet'}
              </button>
            )}
            <button onClick={exportToExcel} disabled={successCount === 0} className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${isDark ? 'border-white/10 text-violet-400 hover:bg-violet-500/10' : 'border-slate-200 text-violet-600 hover:bg-violet-50'}`}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Xuất Excel
            </button>
            <button 
              onClick={processLinks} 
              disabled={links.filter(l => l.status === 'pending' || l.status === 'error').length === 0 || isProcessing}
              className={`inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${btnPrimary}`}
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              {isProcessing ? 'Đang xử lý...' : 'Bắt đầu trích xuất'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={`text-[11px] uppercase border-b ${borderC} ${isDark ? 'text-slate-400 bg-white/[0.02]' : 'text-slate-500 bg-slate-50'}`}>
              <tr>
                <th className="px-3 py-3 font-medium w-10 text-center">#</th>
                <th className="px-3 py-3 font-medium w-20">Platform</th>
                <th className="px-3 py-3 font-medium w-36">Tên</th>
                <th className="px-3 py-3 font-medium w-24">ID</th>
                <th className="px-3 py-3 font-medium w-24 text-right">Followers</th>
                <th className="px-3 py-3 font-medium w-24 text-right">Avg View</th>
                <th className="px-3 py-3 font-medium w-28 text-right">Avg Engage</th>
                <th className="px-3 py-3 font-medium w-24">SĐT</th>
                <th className="px-3 py-3 font-medium w-32">Email</th>
                <th className="px-3 py-3 font-medium w-24">Link Bio</th>
                <th className="px-3 py-3 font-medium w-44">Link</th>
                <th className="px-3 py-3 font-medium w-48">Bio</th>
                <th className="px-3 py-3 font-medium w-12 text-center">Ảnh</th>
                <th className="px-3 py-3 font-medium w-24 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/[0.03]' : 'divide-slate-100'}`}>
              {links.length === 0 ? (
                <tr>
                  <td colSpan={14} className={`px-4 py-12 text-center ${textM}`}>
                    <Globe className={`h-8 w-8 mx-auto mb-2 ${isDark ? 'opacity-20' : 'opacity-30'}`} />
                    <p>Chưa có dữ liệu. Thêm link TikTok hoặc Facebook để bắt đầu.</p>
                  </td>
                </tr>
              ) : links.map((link, index) => (
                <tr key={link.id} className={`${rowHover} transition-colors`}>
                  <td className={`px-3 py-2.5 text-center text-xs ${textM}`}>{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      link.platform === 'Facebook' 
                        ? (isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700')
                        : (isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600')
                    }`}>
                      {link.platform || 'TikTok'}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${textP} truncate max-w-[9rem]`}>{link.nickname || '-'}</td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[6rem]`}>{link.channelId ? `@${link.channelId}` : '-'}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${textP}`}>{formatFollowers(link.followers) || '-'}</td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {link.platform === 'TikTok' && link.averageView ? formatNumber(link.averageView) : '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`} title={link.platform === 'TikTok' && link.averageEngagement ? `❤️ Likes + 💬 Comments + 🔄 Shares + 🔖 Saves` : ''}>
                    {link.platform === 'TikTok' && link.averageEngagement ? formatNumber(link.averageEngagement) : '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{link.phone && link.phone !== 'N/A' ? link.phone : '-'}</td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[8rem]`}>{link.email && link.email !== 'N/A' ? link.email : '-'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {link.bioLink && link.bioLink !== 'N/A' ? (
                      <a href={link.bioLink.startsWith('http') ? link.bioLink : `https://${link.bioLink}`} target="_blank" rel="noreferrer" className={`flex items-center gap-1 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                        <LinkIcon className="h-3 w-3 shrink-0" /> Link
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <a href={link.url} target="_blank" rel="noreferrer" className={`flex items-center gap-1 truncate max-w-[10rem] ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}>
                      <LinkIcon className="h-3 w-3 shrink-0" /> {link.url.replace(/https?:\/\/(www\.)?/, '').substring(0, 35)}...
                    </a>
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${textS} truncate max-w-[12rem]`} title={link.bio}>{link.bio || '-'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {link.profilePic ? (
                      <img src={link.profilePic} alt="" className="w-7 h-7 rounded-full object-cover mx-auto border border-white/10" referrerPolicy="no-referrer" />
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {link.status === 'pending' && <span className={`text-xs ${textM}`}>Chờ</span>}
                      {link.status === 'processing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />}
                      {link.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                      {link.status === 'error' && (
                        <span className="text-xs text-red-400 flex items-center gap-1" title={link.errorMsg}>
                          <AlertCircle className="h-3.5 w-3.5" /> Lỗi
                        </span>
                      )}
                      <button onClick={() => removeLink(link.id)} className={`ml-1 ${isDark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-colors`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
