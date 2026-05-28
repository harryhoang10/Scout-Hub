import React, { useState, useMemo } from 'react';
import { RestoredData, ParsedQuotation } from '../types';
import {
  X, Loader2, CheckCircle, MessageSquare, Sparkles, Edit3, Search, DollarSign, Clock, Shield, FileText, AlertCircle
} from 'lucide-react';

function formatFollowers(val: string | number | undefined): string {
  if (!val) return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return String(val);
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function formatPrice(price: number, currency: string = 'VND'): string {
  if (currency === 'USD') {
    return '$' + price.toLocaleString('en-US');
  }
  return price.toLocaleString('vi-VN') + ' đ';
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  
  // Try to extract contents of a markdown code block, handling cut-off blocks without closing backticks
  const blockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (blockMatch && blockMatch[1]) {
    cleaned = blockMatch[1].trim();
  }

  // Remove any individual backticks that might have slipped through
  cleaned = cleaned.replace(/`/g, '').trim();

  // Find first '{' and last '}' to extract raw JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1).trim();
  }
  
  return cleaned;
}

interface QuotationParserProps {
  profile: RestoredData | null;
  allProfiles: RestoredData[];
  onClose: () => void;
  onUpdateProfile: (id: string, updates: Partial<RestoredData>) => void;
  theme?: string;
}

export const QuotationParser: React.FC<QuotationParserProps> = ({
  profile: initialProfile, allProfiles, onClose, onUpdateProfile, theme = 'dark'
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile?.id || '');
  const [rawMessage, setRawMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedQuotation | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [saved, setSaved] = useState(false);

  // Editable parsed fields
  const [editedItems, setEditedItems] = useState<ParsedQuotation['sowItems']>([]);
  const [editedTimeline, setEditedTimeline] = useState('');
  const [editedUsageRights, setEditedUsageRights] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200';
  const overlayBg = isDark ? 'bg-black/80' : 'bg-slate-900/50';
  const textP = isDark ? 'text-slate-100' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderC = isDark ? 'border-white/10' : 'border-slate-200';
  const inputBg = isDark ? 'bg-black/20 border-white/10 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';

  const selectedProfile = allProfiles.find(p => p.id === selectedProfileId) || null;

  const filteredProfiles = useMemo(() => {
    if (!profileSearch.trim()) return allProfiles.slice(0, 20);
    const q = profileSearch.toLowerCase();
    return allProfiles.filter(p =>
      (p.nickname?.toLowerCase().includes(q)) ||
      (p.channelId?.toLowerCase().includes(q)) ||
      (p.url?.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allProfiles, profileSearch]);

  const handleParse = async () => {
    if (!rawMessage.trim()) return;
    setIsParsing(true);
    setParsedResult(null);
    setSaved(false);

    const aiApiKey = localStorage.getItem('scout_hub_gemini_key') || '';
    if (!aiApiKey) {
      alert('Chưa cấu hình AI API Key. Vui lòng vào Cài đặt để thêm key.');
      setIsParsing(false);
      return;
    }

    let aiBaseUrl = localStorage.getItem('scout_hub_ai_base_url') || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    if (!aiBaseUrl.endsWith('/')) aiBaseUrl += '/';
    const aiModel = localStorage.getItem('scout_hub_ai_model') || 'gemini-2.5-flash';

    const contextLine = selectedProfile
      ? `- Profile đang match: ${selectedProfile.nickname} (@${selectedProfile.channelId || ''})\n- Platform: ${selectedProfile.platform || 'TikTok'}`
      : '- Chưa chọn profile cụ thể';

    const prompt = `Bạn là chuyên gia phân tích tin nhắn/email báo giá từ KOLs/Influencers/Managers tại Việt Nam.

Hãy đọc kỹ nội dung tin nhắn sau và trích xuất TẤT CẢ thông tin có liên quan đến báo giá, SOW (scope of work), timeline và thông tin liên hệ.

Tin nhắn raw:
"""
${rawMessage}
"""

Context (nếu có):
${contextLine}

YÊU CẦU: Trả về JSON chính xác theo format sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:
{
  "profileDetected": {
    "name": "Tên phát hiện từ tin nhắn hoặc null",
    "handle": "Handle/ID nếu phát hiện hoặc null"
  },
  "sowItems": [
    { "name": "Tên SOW (VD: Video Post, Photo Post, SDHA KĐQ, Story...)", "price": 5000000, "currency": "VND" }
  ],
  "timeline": "Timeline giao hàng nếu có hoặc null",
  "usageRights": "Quyền sử dụng hình ảnh/nội dung nếu đề cập hoặc null",
  "notes": "Ghi chú bổ sung từ KOL (điều kiện, yêu cầu đặc biệt...) hoặc null",
  "contact": {
    "phone": "Số điện thoại nếu tìm thấy hoặc null",
    "email": "Email nếu tìm thấy hoặc null"
  },
  "confidence": 0.92
}

HƯỚNG DẪN PARSE:
- Giá có thể viết dạng: "5tr", "5 triệu", "5,000,000", "5M", "năm triệu", "5 củ"
- SOW có thể viết tắt: "vid" = Video Post, "ảnh/photo" = Photo Post, "SDHA" = Sử Dụng Hình Ảnh, "story" = Story Post, "livestream/live" = Livestream
- KĐQ = Không Độc Quyền, ĐQ = Độc Quyền
- Nếu chỉ có 1 mức giá chung không chia SOW, tạo 1 sowItem tên "Gói tổng"
- Nếu không chắc chắn, đặt confidence thấp (< 0.6)
- Chỉ trả về JSON, KHÔNG giải thích`;

    try {
      const response = await fetch(`${aiBaseUrl}chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        alert(`Lỗi API (${response.status}). Kiểm tra AI Key trong Cài đặt.`);
        setIsParsing(false);
        return;
      }

      const resData = await response.json();
      let textResponse = resData?.choices?.[0]?.message?.content?.trim() || '';

      const cleanedJson = cleanJsonResponse(textResponse);
      const parsed: ParsedQuotation = JSON.parse(cleanedJson);
      setParsedResult(parsed);

      // Set editable fields
      setEditedItems(parsed.sowItems || []);
      setEditedTimeline(parsed.timeline || '');
      setEditedUsageRights(parsed.usageRights || '');
      setEditedNotes(parsed.notes || '');
      setEditedPhone(parsed.contact?.phone || '');
      setEditedEmail(parsed.contact?.email || '');

      // Auto-match profile if detected and none selected
      if (!selectedProfileId && parsed.profileDetected) {
        const match = allProfiles.find(p =>
          (parsed.profileDetected.name && p.nickname?.toLowerCase().includes(parsed.profileDetected.name.toLowerCase())) ||
          (parsed.profileDetected.handle && p.channelId?.toLowerCase() === parsed.profileDetected.handle.toLowerCase())
        );
        if (match) setSelectedProfileId(match.id);
      }
    } catch (e: any) {
      alert(`Lỗi parse: ${e.message}`);
    }
    setIsParsing(false);
  };

  const handleUpdateItem = (idx: number, field: 'name' | 'price' | 'currency', value: string | number) => {
    setEditedItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: field === 'price' ? Number(value) || 0 : value } : item
    ));
  };

  const handleRemoveItem = (idx: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddItem = () => {
    setEditedItems(prev => [...prev, { name: '', price: 0, currency: 'VND' }]);
  };

  const handleSaveToCRM = () => {
    if (!selectedProfile || editedItems.length === 0) {
      alert('Vui lòng chọn profile và đảm bảo có ít nhất 1 SOW item.');
      return;
    }

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    // Create rate history entries for each SOW item
    const newRateEntries = editedItems
      .filter(item => item.price > 0 && item.name.trim())
      .map(item => ({
        id: Math.random().toString(36).substring(7),
        date: dateStr,
        price: item.price,
        note: [
          item.currency && item.currency !== 'VND' ? `Đơn vị: ${item.currency}` : '',
          editedTimeline ? `Timeline: ${editedTimeline}` : '',
          editedUsageRights ? `Usage: ${editedUsageRights}` : '',
          editedNotes || '',
        ].filter(Boolean).join(' | ') || undefined,
        sow: [item.name],
      }));

    const existingHistory = selectedProfile.rateHistory || [];
    const updates: Partial<RestoredData> = {
      rateHistory: [...existingHistory, ...newRateEntries],
      lastQuotedAt: today.toISOString(),
    };

    // Update workflow status if appropriate
    if (selectedProfile.workflowStatus === 'Contacted' || selectedProfile.workflowStatus === 'Shortlisted') {
      updates.workflowStatus = 'Negotiating';
    }

    // Update contact if new ones detected
    if (editedPhone && (!selectedProfile.phone || selectedProfile.phone === 'N/A')) {
      updates.phone = editedPhone;
    }
    if (editedEmail && (!selectedProfile.email || selectedProfile.email === 'N/A')) {
      updates.email = editedEmail;
    }

    onUpdateProfile(selectedProfile.id, updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const totalPrice = editedItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const confidencePercent = parsedResult ? Math.round(parsedResult.confidence * 100) : 0;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg}`}>
      <div className={`w-full max-w-5xl h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${modalBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderC} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${textP}`}>Smart Quotation Parser</h2>
              <p className={`text-[11px] ${textM}`}>Paste tin nhắn báo giá → AI tự bóc tách SOW & giá → lưu CRM</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Input Panel */}
          <div className={`w-[45%] shrink-0 border-r ${borderC} flex flex-col overflow-hidden`}>
            {/* Profile Selector */}
            <div className={`px-4 py-3 border-b ${borderC} space-y-2`}>
              <label className={`text-[11px] font-medium ${textS} block`}>Profile (tuỳ chọn)</label>
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${textM}`} />
                <input
                  type="text"
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  placeholder="Tìm profile..."
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border ${inputBg}`}
                />
              </div>
              {profileSearch && (
                <div className={`max-h-32 overflow-y-auto rounded-lg border ${isDark ? 'border-white/10 bg-slate-800' : 'border-slate-200 bg-white shadow-lg'}`}>
                  {filteredProfiles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProfileId(p.id); setProfileSearch(''); }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                        isDark ? 'hover:bg-white/5 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                      } ${selectedProfileId === p.id ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : ''}`}
                    >
                      {p.profilePic && <img src={p.profilePic} className="w-5 h-5 rounded-full" alt="" />}
                      <span className="truncate">{p.nickname || p.channelId || p.url}</span>
                      <span className={`text-[10px] ${textM} ml-auto`}>{formatFollowers(p.followers)}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProfile && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                  {selectedProfile.profilePic && <img src={selectedProfile.profilePic} className="w-6 h-6 rounded-full" alt="" />}
                  <span className={`text-xs font-medium ${textP} truncate`}>{selectedProfile.nickname}</span>
                  <span className={`text-[10px] ${textM}`}>{formatFollowers(selectedProfile.followers)}</span>
                  <button onClick={() => setSelectedProfileId('')} className={`ml-auto p-0.5 rounded ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Raw Message Input */}
            <div className="flex-1 flex flex-col p-4">
              <label className={`text-[11px] font-medium ${textS} mb-2 block`}>Tin nhắn / Email raw</label>
              <textarea
                value={rawMessage}
                onChange={(e) => setRawMessage(e.target.value)}
                placeholder={`Paste tin nhắn báo giá vào đây...\n\nVí dụ:\n"Anh ơi bên em giá video là 5tr, photo 2tr, còn SDHA thì 1.5tr ạ. Timeline 2 tuần sau confirm."`}
                className={`flex-1 px-3 py-2 text-sm rounded-xl border resize-none leading-relaxed ${inputBg}`}
              />
              <button
                onClick={handleParse}
                disabled={isParsing || !rawMessage.trim()}
                className="mt-3 w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl hover:from-emerald-600 hover:to-cyan-700 disabled:opacity-40 transition-all shadow-lg shadow-emerald-500/20"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isParsing ? 'Đang phân tích...' : '🤖 Phân tích với AI'}
              </button>
            </div>
          </div>

          {/* Result Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!parsedResult && !isParsing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <MessageSquare className={`h-12 w-12 mb-4 opacity-15 ${textM}`} />
                <p className={`text-sm font-medium ${textP}`}>Chưa có dữ liệu phân tích</p>
                <p className={`text-xs ${textM} mt-1`}>Paste tin nhắn báo giá ở bên trái rồi nhấn "Phân tích với AI"</p>
              </div>
            ) : isParsing ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className={`h-8 w-8 animate-spin mb-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <p className={`text-sm ${textS}`}>AI đang bóc tách dữ liệu...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Confidence Bar */}
                <div className={`rounded-xl border p-4 ${cardBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${textP}`}>Độ chính xác (Confidence)</span>
                    <span className={`text-sm font-bold ${
                      confidencePercent >= 80 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') :
                      confidencePercent >= 50 ? (isDark ? 'text-amber-400' : 'text-amber-600') :
                      isDark ? 'text-red-400' : 'text-red-600'
                    }`}>{confidencePercent}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        confidencePercent >= 80 ? 'bg-emerald-500' :
                        confidencePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  {confidencePercent < 60 && (
                    <div className={`flex items-center gap-1.5 mt-2 text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      Confidence thấp — nên kiểm tra kỹ trước khi lưu.
                    </div>
                  )}
                </div>

                {/* SOW Items */}
                <div className={`rounded-xl border p-4 ${cardBg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className={`h-4 w-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span className={`text-xs font-semibold ${textP}`}>SOW & Báo giá</span>
                    </div>
                    <button onClick={handleAddItem} className={`text-[10px] font-medium ${isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-600 hover:text-violet-500'}`}>+ Thêm item</button>
                  </div>
                  <div className="space-y-2">
                    {editedItems.map((item, idx) => (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          placeholder="Tên SOW"
                          className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
                        />
                        <div className="relative w-44 flex items-center gap-1">
                          <input
                            type="number"
                            value={item.price || ''}
                            onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                            placeholder="Giá"
                            className={`w-28 px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
                          />
                          <select
                            value={item.currency || 'VND'}
                            onChange={(e) => handleUpdateItem(idx, 'currency', e.target.value)}
                            className={`w-14 px-1 py-1.5 text-[10px] rounded-lg border focus:outline-none ${inputBg}`}
                          >
                            <option value="VND">VND</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                        <button onClick={() => handleRemoveItem(idx)} className={`p-1 rounded ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {editedItems.length > 0 && (
                    <div className={`mt-3 pt-3 border-t ${borderC} flex items-center justify-between`}>
                      <span className={`text-xs font-semibold ${textP}`}>Tổng cộng</span>
                      <span className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {formatPrice(totalPrice, editedItems[0]?.currency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div className={`rounded-xl border p-4 ${cardBg} grid grid-cols-2 gap-3`}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className={`h-3.5 w-3.5 ${textM}`} />
                      <label className={`text-[11px] font-medium ${textS}`}>Timeline</label>
                    </div>
                    <input type="text" value={editedTimeline} onChange={(e) => setEditedTimeline(e.target.value)} placeholder="VD: 2 tuần sau confirm" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className={`h-3.5 w-3.5 ${textM}`} />
                      <label className={`text-[11px] font-medium ${textS}`}>Usage Rights</label>
                    </div>
                    <input type="text" value={editedUsageRights} onChange={(e) => setEditedUsageRights(e.target.value)} placeholder="VD: 3 tháng" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className={`h-3.5 w-3.5 ${textM}`} />
                      <label className={`text-[11px] font-medium ${textS}`}>Ghi chú</label>
                    </div>
                    <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} placeholder="Ghi chú từ KOL..." rows={2} className={`w-full px-2 py-1.5 text-xs rounded-lg border resize-none ${inputBg}`} />
                  </div>
                </div>

                {/* Detected Contact */}
                {(editedPhone || editedEmail) && (
                  <div className={`rounded-xl border p-4 ${cardBg}`}>
                    <span className={`text-xs font-semibold ${textP} block mb-2`}>Thông tin liên hệ phát hiện</span>
                    <div className="grid grid-cols-2 gap-3">
                      {editedPhone && (
                        <div>
                          <label className={`text-[10px] ${textM} block mb-1`}>Phone</label>
                          <input type="text" value={editedPhone} onChange={(e) => setEditedPhone(e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
                        </div>
                      )}
                      {editedEmail && (
                        <div>
                          <label className={`text-[10px] ${textM} block mb-1`}>Email</label>
                          <input type="text" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Profile detected */}
                {parsedResult?.profileDetected?.name && !selectedProfile && (
                  <div className={`rounded-xl border p-3 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                    <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      ⚠️ AI phát hiện tên "<strong>{parsedResult.profileDetected.name}</strong>" nhưng chưa match profile. Hãy chọn profile thủ công ở bên trái.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            {parsedResult && (
              <div className={`px-5 py-3 border-t ${borderC} flex items-center justify-between shrink-0`}>
                <div className={`text-xs ${textM}`}>
                  {selectedProfile ? (
                    <span>Sẽ lưu vào <strong className={textP}>{selectedProfile.nickname}</strong></span>
                  ) : (
                    <span className={isDark ? 'text-amber-300' : 'text-amber-600'}>⚠ Chưa chọn profile</span>
                  )}
                </div>
                <button
                  onClick={handleSaveToCRM}
                  disabled={!selectedProfile || editedItems.length === 0 || saved}
                  className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-40 shadow-lg ${
                    saved
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white hover:from-emerald-600 hover:to-cyan-700 shadow-emerald-500/20'
                  }`}
                >
                  {saved ? <><CheckCircle className="h-4 w-4" /> Đã lưu!</> : <><Edit3 className="h-4 w-4" /> Lưu vào CRM</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
