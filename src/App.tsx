import React, { useState, useEffect } from 'react';
import { UniversalExtractor } from './components/UniversalExtractor';
import { ScoutCRM } from './components/ScoutCRM';
import { RestoredData } from './types';
import { Radar, Database, Menu, X, Sun, Moon, Settings } from 'lucide-react';
import { fetchFromSheet } from './lib/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'extractor' | 'crm' | 'settings'>('extractor');
  const [restoredData, setRestoredData] = useState<RestoredData[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('scout_hub_theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('scout_hub_webhook_url') || '';
  });

  // Apply theme class
  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'theme-light' : '';
    localStorage.setItem('scout_hub_theme', theme);
  }, [theme]);

  // Load from localStorage on mount & Fetch from Webhook
  useEffect(() => {
    // 1. Load stable cache from LocalStorage immediately
    const saved = localStorage.getItem('scout_hub_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((r: any) => ({
          ...r,
          tier: r.tier || [],
          location: r.location || [],
          group: r.group || [],
          campaign: r.campaign || [],
          sow: r.sow || [],
          notes: r.notes || [],
          rating: r.rating || 0,
          phone: r.phone || '',
          email: r.email || '',
        }));
        setRestoredData(migrated);
      } catch (e) {
        console.error('Failed to parse saved data', e);
      }
    }

    // 2. Fetch fresh data from Google Sheet if configured
    const currentWebhook = localStorage.getItem('scout_hub_webhook_url');
    if (currentWebhook) {
      fetchFromSheet(currentWebhook).then(freshData => {
        if (freshData && freshData.length > 0) {
          setRestoredData(freshData);
          console.log("Synced fresh data from Google Sheet:", freshData.length, "profiles");
        }
      });
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('scout_hub_data', JSON.stringify(restoredData));
  }, [restoredData]);

  const handleSaveToRestored = (newData: RestoredData[]) => {
    setRestoredData(prev => [...prev, ...newData]);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const saveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem('scout_hub_webhook_url', url);
  };

  // Dynamic theme classes
  const isDark = theme === 'dark';
  const bgPrimary = isDark ? 'bg-[#0a0a0f]' : 'bg-[#f8fafc]';
  const bgSidebar = isDark ? 'bg-[#0d0d14]' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const textTiny = isDark ? 'text-slate-600' : 'text-slate-300';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const navActive = isDark 
    ? 'bg-violet-600/15 text-violet-400 border-violet-500/20' 
    : 'bg-violet-50 text-violet-700 border-violet-200';
  const navInactive = isDark 
    ? 'text-slate-400 hover:text-white hover:bg-white/[0.04]' 
    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50';
  const navIconActive = isDark ? 'text-violet-400' : 'text-violet-600';
  const navIconInactive = isDark ? 'text-slate-500 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900';
  const topBarBg = isDark ? 'bg-[#0a0a0f]/80' : 'bg-white/80';
  const gradientBrand = 'bg-gradient-to-br from-violet-600 to-fuchsia-600';
  const mobileBtn = isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-700';
  const themeToggleBg = isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200';
  const themeToggleText = isDark ? 'text-amber-400' : 'text-slate-600';

  const navItems = [
    { id: 'extractor' as const, label: 'Extractor', icon: Radar, desc: 'Trích xuất profile' },
    { id: 'crm' as const, label: 'Scout CRM', icon: Database, desc: `${restoredData.length} profiles` },
    { id: 'settings' as const, label: 'Cài đặt', icon: Settings, desc: 'Webhook & API' },
  ];

  return (
    <div className={`min-h-screen ${bgPrimary} font-sans ${textPrimary} flex`}>
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg border ${mobileBtn}`}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        sidebar fixed lg:sticky top-0 left-0 z-40 h-screen w-64 
        ${bgSidebar} border-r ${borderColor}
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className={`px-6 py-6 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${gradientBrand} flex items-center justify-center`}>
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-bold ${textPrimary} tracking-tight`}>Scout Hub</h1>
              <p className={`text-[10px] ${textMuted} font-medium tracking-wider uppercase`}>Profile Intelligence</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group border ${
                activeTab === item.id ? navActive : `${navInactive} border-transparent`
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${
                activeTab === item.id ? navIconActive : navIconInactive
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-[10px] ${textMuted}`}>{item.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Theme Toggle + Footer */}
        <div className={`px-4 py-4 border-t ${borderColor} space-y-3`}>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl ${themeToggleBg} transition-all`}
          >
            {isDark ? <Sun className={`h-4 w-4 ${themeToggleText}`} /> : <Moon className={`h-4 w-4 ${themeToggleText}`} />}
            <span className={`text-sm ${textSecondary}`}>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>
          <p className={`text-[10px] ${textTiny} text-center`}>
            Scout Hub v2.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <div className={`topbar sticky top-0 z-20 ${topBarBg} backdrop-blur-xl border-b ${borderColor} px-6 lg:px-8 py-4`}>
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <div className="pl-10 lg:pl-0">
              <h2 className={`text-lg font-semibold ${textPrimary}`}>
                {activeTab === 'extractor' ? 'Universal Extractor' : activeTab === 'crm' ? 'Scout CRM' : 'Cài đặt'}
              </h2>
              <p className={`text-xs ${textMuted} mt-0.5`}>
                {activeTab === 'extractor' 
                  ? 'Paste link TikTok / Facebook → Auto-extract profile data' 
                  : activeTab === 'crm'
                  ? `Quản lý ${restoredData.length} profiles đã lưu trữ`
                  : 'Cấu hình Webhook, Google Sheet và các API'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
          {activeTab === 'extractor' && (
            <UniversalExtractor 
              onSaveToRestored={handleSaveToRestored} 
              webhookUrl={webhookUrl}
              theme={theme}
            />
          )}
          {activeTab === 'crm' && (
            <ScoutCRM 
              data={restoredData} 
              onUpdateData={setRestoredData} 
              webhookUrl={webhookUrl}
              theme={theme}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPanel 
              webhookUrl={webhookUrl} 
              onSaveWebhookUrl={saveWebhookUrl}
              theme={theme}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ============ Settings Panel ============
function SettingsPanel({ webhookUrl, onSaveWebhookUrl, theme }: { webhookUrl: string; onSaveWebhookUrl: (url: string) => void; theme: string }) {
  const [url, setUrl] = useState(webhookUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showBookmarkletGuide, setShowBookmarkletGuide] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('scout_hub_gemini_key') || '');
  const [rapidApiKey, setRapidApiKey] = useState(() => localStorage.getItem('scout_hub_rapidapi_key') || '');
  const [keysSaved, setKeysSaved] = useState(false);
  const isDark = theme === 'dark';

  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';
  const inputBg = isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const codeBg = isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50 border-slate-200';
  const codeText = isDark ? 'text-emerald-400' : 'text-emerald-700';

  const handleSave = () => {
    onSaveWebhookUrl(url.trim());
    localStorage.setItem('scout_hub_gemini_key', geminiKey.trim());
    localStorage.setItem('scout_hub_rapidapi_key', rapidApiKey.trim());
    setTestStatus('idle');
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleTest = async () => {
    if (!url.trim()) return;
    setTestStatus('testing');
    setTestMsg('');
    try {
      const res = await fetch('/api/webhook/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestMsg('Kết nối thành công! ✓');
      } else {
        setTestStatus('error');
        setTestMsg(`Lỗi: ${data.error || 'Response không ok'}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMsg(`Lỗi: ${e.message}`);
    }
  };

  const appsScriptCode = `const COLUMNS = [
  "Ngày lưu trữ", "Platform", "Tên", "ID", "Followers", "Avg View", "Avg Engagement",
  "SĐT", "Email", "Link Bio", "Link", "Bio", "Avatar", "Profile",
  "Tier", "Vị trí", "Nhóm", "Campaign", "SOW", "Notes", "Rate History", "Rating"
];

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
  }
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action || 'upsert';
  
  if (action === 'delete') {
    var linksToDelete = data.links || [];
    var sheetData = sheet.getDataRange().getValues();
    for (var i = sheetData.length - 1; i > 0; i--) {
      var rowLink = sheetData[i][10];
      if (linksToDelete.indexOf(rowLink) !== -1) {
        sheet.deleteRow(i + 1);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', deleted: true })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var profiles = data.profiles || [];
  var existingData = sheet.getDataRange().getValues();
  
  profiles.forEach(function(p) {
    var rowToUpsert = [
      p.saveDate || new Date().toLocaleDateString('vi-VN'),
      p.platform || '',
      p.nickname || '',
      p.channelId || '',
      p.followers || '',
      p.averageView || '',
      p.averageEngagement || '',
      p.phone || '',
      p.email || '',
      p.bioLink || '',
      p.url || '',
      p.bio || '',
      p.profilePic || '',
      p.profileType || 'Individual',
      (p.tier || []).join(', '),
      (p.location || []).join(', '),
      (p.group || []).join(', '),
      (p.campaign || []).join(', '),
      (p.sow || []).join(', '),
      JSON.stringify(p.notes || []),
      JSON.stringify(p.rateHistory || []),
      p.rating || 0
    ];
    
    var foundIdx = -1;
    for (var i = 1; i < existingData.length; i++) {
      if (existingData[i][10] === p.url) {
        foundIdx = i;
        break;
      }
    }
    
    if (foundIdx !== -1) {
      sheet.getRange(foundIdx + 1, 1, 1, rowToUpsert.length).setValues([rowToUpsert]);
    } else {
      sheet.appendRow(rowToUpsert);
      existingData.push(rowToUpsert);
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    setupSheet();
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  
  var rows = [];
  var parseJSON = function(val, def) {
    try { return JSON.parse(val); } catch(err) { return def; }
  };
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[10]) continue;
    
    rows.push({
      id: "row_" + i + "_" + new Date().getTime(),
      saveDate: row[0] || '',
      platform: row[1] || 'TikTok',
      nickname: row[2] || '',
      channelId: row[3] || '',
      followers: row[4] || '',
      averageView: Number(row[5]) || 0,
      averageEngagement: Number(row[6]) || 0,
      phone: row[7] || '',
      email: row[8] || '',
      bioLink: row[9] || '',
      url: row[10] || '',
      bio: row[11] || '',
      profilePic: row[12] || '',
      profileType: row[13] || 'Individual',
      tier: row[14] ? String(row[14]).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      location: row[15] ? String(row[15]).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      group: row[16] ? String(row[16]).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      campaign: row[17] ? String(row[17]).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      sow: row[18] ? String(row[18]).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      notes: parseJSON(row[19], []),
      rateHistory: parseJSON(row[20], []),
      rating: Number(row[21]) || 0,
      status: 'success'
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}`;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Webhook URL */}
      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <h3 className={`text-base font-semibold ${textP} mb-1`}>Google Sheets Webhook</h3>
        <p className={`text-xs ${textS} mb-4`}>
          Kết nối với Google Sheet qua Apps Script để tự động lưu trữ profile.
        </p>

        <div className="space-y-3">
          <div>
            <label className={`text-xs font-medium ${textS} mb-1 block`}>Apps Script Web App URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/xxxxx/exec"
                className={`flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${inputBg}`}
              />
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap"
              >
                {keysSaved ? 'Đã lưu ✓' : 'Lưu tất cả'}
              </button>
              <button
                onClick={handleTest}
                disabled={!url.trim() || testStatus === 'testing'}
                className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {testStatus === 'testing' ? 'Đang test...' : 'Test'}
              </button>
            </div>
            {testMsg && (
              <p className={`text-xs mt-2 ${testStatus === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {testMsg}
              </p>
            )}
          </div>
          
          <div className="pt-3 border-t border-white/10 space-y-3">
             <div>
                <label className={`text-xs font-medium ${textS} mb-1 block`}>Gemini API Key (Xử lý AI Demographics & Insights)</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${inputBg}`}
                />
             </div>
             <div>
                <label className={`text-xs font-medium ${textS} mb-1 block`}>RapidAPI Key (Tính TikTok Average Views / Engagement)</label>
                <input
                  type="password"
                  value={rapidApiKey}
                  onChange={(e) => setRapidApiKey(e.target.value)}
                  placeholder="Để trống nếu đã cài đặt ở Server"
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${inputBg}`}
                />
             </div>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className={`flex items-center gap-2 text-base font-semibold ${textP} w-full text-left`}
        >
          <span>📖 Hướng dẫn cài đặt Google Sheet + Apps Script</span>
          <span className={`text-xs ${textM} ml-auto`}>{showGuide ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
        </button>
        
        {showGuide && (
          <div className={`mt-4 space-y-4 text-sm ${textS}`}>
            <div>
              <h4 className={`font-semibold ${textP} mb-2`}>Bước 1: Tạo Google Sheet</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Mở <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">Google Sheets</a> và tạo 1 sheet mới</li>
                <li>Đặt tên cho sheet và thêm header ở dòng đầu tiên (nếu để trống code sẽ tự động tạo Header):
                  <code className={`text-xs ${codeText} block mt-1`}>Ngày lưu trữ | Platform | Tên | ID | Followers | SĐT | Email | Link Bio | Link | Bio | Avatar | Profile | Tier | Vị trí | Nhóm | Campaign | Notes | Rate History | Rating</code>
                </li>
              </ol>
            </div>
            
            <div>
              <h4 className={`font-semibold ${textP} mb-2`}>Bước 2: Tạo Apps Script</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Trong Google Sheet, vào <strong>Extensions → Apps Script</strong></li>
                <li>Xóa toàn bộ code mặc định, paste đoạn code bên dưới:</li>
              </ol>
            </div>

            <div className={`relative rounded-lg border p-4 overflow-x-auto ${codeBg}`}>
              <button
                onClick={() => navigator.clipboard.writeText(appsScriptCode)}
                className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
              >
                Copy
              </button>
              <pre className={`text-[11px] ${codeText} whitespace-pre`}>{appsScriptCode}</pre>
            </div>

            <div>
              <h4 className={`font-semibold ${textP} mb-2`}>Bước 3: Deploy Web App</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Nhấn <strong>Deploy → New Deployment</strong></li>
                <li>Chọn type: <strong>Web App</strong></li>
                <li>Execute as: <strong>Me</strong></li>
                <li>Who has access: <strong>Anyone</strong></li>
                <li>Nhấn <strong>Deploy</strong>, authorize nếu cần</li>
                <li>Copy <strong>Web App URL</strong> và paste vào ô phía trên</li>
              </ol>
            </div>

            <div className={`p-3 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                ⚠️ <strong>Lưu ý:</strong> Mỗi khi sửa code Apps Script, cần tạo <strong>New Deployment</strong> mới (không phải update). URL deploy sẽ thay đổi.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bookmarklet Guide */}
      <div className={`rounded-xl border p-5 ${cardBg} mt-5`}>
        <button
          onClick={() => setShowBookmarkletGuide(!showBookmarkletGuide)}
          className={`flex items-center gap-2 text-base font-semibold ${textP} w-full text-left`}
        >
          <span>🔖 Tiện ích Bookmarklet (Trích xuất nhanh)</span>
          <span className={`text-xs ${textM} ml-auto`}>{showBookmarkletGuide ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
        </button>
        
        {showBookmarkletGuide && (
          <div className={`mt-4 space-y-4 text-sm ${textS}`}>
            <p className={`text-[13px] ${textM}`}>
              Sử dụng Bookmarklet (Dấu trang) để quét nhanh profile khi đang lướt TikTok hoặc Facebook chỉ với 1 click.
            </p>
            <div>
              <h4 className={`font-semibold ${textP} mb-2`}>Bước 1: Tạo Bookmarklet</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Hiển thị thanh dấu trang trên trình duyệt (Ctrl/Cmd + Shift + B).</li>
                <li>Chuột phải vào thanh dấu trang, chọn <strong>Thêm trang... (Add page...)</strong></li>
                <li>Phần Tên (Name): Nhập <strong>"Scout Hub Extract"</strong> (hoặc tên tùy ý).</li>
                <li>Phần URL, paste đoạn code Javascript dưới đây vào và lưu lại:</li>
              </ol>
            </div>
            
            <div className={`relative rounded-lg border p-4 overflow-x-auto ${codeBg}`}>
              <button
                onClick={() => navigator.clipboard.writeText(`javascript:(function(){var currentUrl=window.location.href;if(currentUrl.includes('tiktok.com')||currentUrl.includes('facebook.com')||currentUrl.includes('fb.com')){var newWindow=window.open('${hostOrigin}/?addUrl='+encodeURIComponent(currentUrl),'_blank');newWindow.focus();}else{alert('Scout Hub chỉ hỗ trợ nền tảng TikTok và Facebook!');}})();`)}
                className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
              >
                Copy
              </button>
              <pre className={`text-[11px] ${codeText} whitespace-pre-wrap`}>
                javascript:(function()&#123;var currentUrl=window.location.href;if(currentUrl.includes('tiktok.com')||currentUrl.includes('facebook.com')||currentUrl.includes('fb.com'))&#123;var newWindow=window.open('{hostOrigin}/?addUrl='+encodeURIComponent(currentUrl),'_blank');newWindow.focus();&#125;else&#123;alert('Scout Hub chỉ hỗ trợ nền tảng TikTok và Facebook!');&#125;&#125;)();
              </pre>
            </div>

            <div>
              <h4 className={`font-semibold ${textP} mb-2`}>Bước 2: Sử dụng</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vào bằng trình duyệt đến 1 trang profile TikTok hoặc Facebook bất kỳ.</li>
                <li>Click vào dấu trang <strong>"Scout Hub Extract"</strong> vừa tạo trên thanh dấu trang.</li>
                <li>Scout Hub sẽ mở ra trong tab mới, tự động lấy link cấu hình sẵn và bạn chỉ việc ấn thêm vào CRM.</li>
              </ul>
            </div>
            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                📌 <strong>Ghi chú:</strong> Mã Bookmarklet ở trên đã tự động lấy đường dẫn hệ thống hiện tại của bạn ({hostOrigin}). 
                Chỉ cần kéo thả lưu lại là có thể kéo mở Hub từ bất kỳ tab TikTok/Facebook nào.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
