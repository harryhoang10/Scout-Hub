import React, { useState } from 'react';
import { RestoredData } from '../types';
import { X, Plus, Trash2, Calendar, DollarSign, History } from 'lucide-react';

interface RateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RestoredData | null;
  onUpdateRates: (id: string, rates: NonNullable<RestoredData['rateHistory']>) => void;
  theme: string;
}

export const RateHistoryModal: React.FC<RateHistoryModalProps> = ({ isOpen, onClose, profile, onUpdateRates, theme }) => {
  const [priceStr, setPriceStr] = useState('');
  const [note, setNote] = useState('');
  const [sow, setSow] = useState<string[]>([]);
  const [customSow, setCustomSow] = useState('');
  const SOW_OPTIONS = ['Photo Post', 'Video Post', 'SDHA (KĐQ)', 'SDHA (ĐQ)'];

  if (!isOpen || !profile) return null;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200';
  const overlayBg = isDark ? 'bg-black/80' : 'bg-slate-900/50';
  const textP = isDark ? 'text-slate-100' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const borderC = isDark ? 'border-white/10' : 'border-slate-200';
  const inputBg = isDark ? 'bg-black/20 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-900';
  const btnPrimary = isDark ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white';

  const history = profile.rateHistory || [];

  const handleAdd = () => {
    if (!priceStr.trim()) return;
    const numPrice = parseFloat(priceStr.replace(/[^0-9]/g, ''));
    if (isNaN(numPrice)) return;
    
    // Format to Vietnamese currency text representation locally for ease if needed or just use number
    const today = new Date();
    const saveDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    const newRate = {
      id: Math.random().toString(36).substring(7),
      date: saveDate,
      price: numPrice,
      note: note.trim(),
      sow: [...sow]
    };

    onUpdateRates(profile.id, [...history, newRate]);
    setPriceStr('');
    setNote('');
    setSow([]);
    setCustomSow('');
  };

  const handleDelete = (rateId: string) => {
    onUpdateRates(profile.id, history.filter(r => r.id !== rateId));
  };

  const formatPriceForDisplay = (p: number) => {
    return p.toLocaleString('vi-VN') + ' đ';
  };

  // Convert input like 1000000 into formatted while typing if desired, but keeping it simple for now
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg}`}>
      <div className={`w-full max-w-lg rounded-2xl border shadow-xl flex flex-col max-h-[90vh] ${modalBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${borderC}`}>
          <div>
            <h2 className={`text-lg font-bold flex items-center gap-2 ${textP}`}>
              <History className="h-5 w-5 text-violet-500" /> 
              Lịch sử Báo Giá
            </h2>
            <p className={`text-xs mt-1 ${textS}`}>Theo dõi biến động giá booking của {profile.nickname}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create Form */}
        <div className={`p-5 border-b ${borderC} space-y-3`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[11px] font-medium mb-1.5 ${textS}`}>Mức giá (VNĐ)</label>
              <div className="relative">
                <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textS}`} />
                <input 
                  type="text" 
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="VD: 5000000"
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-violet-500/50 focus:outline-none ${inputBg}`} 
                />
              </div>
            </div>
            <div>
              <label className={`block text-[11px] font-medium mb-1.5 ${textS}`}>Ghi chú thời điểm (Tùy chọn)</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="VD: Giá Tết, Giá KOC..."
                className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-violet-500/50 focus:outline-none ${inputBg}`} 
              />
            </div>
          </div>
          
          {/* SOW Selection */}
          <div className="space-y-2 pb-1">
            <label className={`block text-[11px] font-medium ${textS}`}>Gói công việc (SOW)</label>
            <div className="flex flex-wrap gap-1.5">
              {SOW_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSow(prev => prev.includes(opt) ? prev.filter(s => s !== opt) : [...prev, opt])}
                  className={`px-2 py-1 text-[10px] rounded-md transition-colors border ${sow.includes(opt) ? (isDark ? 'bg-pink-900/40 text-pink-300 border-pink-500/30' : 'bg-pink-100 text-pink-700 border-pink-200') : (isDark ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')}`}
                >
                  {opt}
                </button>
              ))}
              {sow.filter(s => !SOW_OPTIONS.includes(s)).map(opt => (
                <button
                  key={opt}
                  onClick={() => setSow(prev => prev.filter(s => s !== opt))}
                  className={`px-2 py-1 text-[10px] rounded-md flex items-center transition-colors border ${isDark ? 'bg-pink-900/40 text-pink-300 border-pink-500/30' : 'bg-pink-100 text-pink-700 border-pink-200'}`}
                >
                  {opt} <X className="inline-block h-2.5 w-2.5 ml-1 opacity-70" />
                </button>
              ))}
              <input
                type="text"
                value={customSow}
                onChange={(e) => setCustomSow(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customSow.trim() && !sow.includes(customSow.trim())) {
                    setSow(prev => [...prev, customSow.trim()]);
                    setCustomSow('');
                  }
                }}
                placeholder="+ Tùy chỉnh (Enter)"
                className={`w-28 px-2 py-1 text-[10px] rounded-md border focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
              />
            </div>
          </div>

          <button 
            onClick={handleAdd}
            disabled={!priceStr.trim()}
            className={`w-full py-2 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${btnPrimary}`}
          >
            <Plus className="h-4 w-4" /> Thêm mức giá mới
          </button>
        </div>

        {/* History List */}
        <div className="p-5 overflow-y-auto min-h-[200px]">
          {history.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center text-center py-8 ${textS}`}>
              <History className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Chưa có lịch sử báo giá nào.</p>
              <p className="text-xs mt-1 opacity-70">Thêm mức giá đầu tiên ở phía trên để bắt đầu theo dõi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.sort((a,b) => new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime()).map((rate) => (
                <div key={rate.id} className={`flex items-start justify-between p-3 rounded-lg border group ${isDark ? 'bg-white/[0.02] border-white/5 hover:border-violet-500/30' : 'bg-slate-50 border-slate-200 hover:border-violet-300'} transition-colors`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {formatPriceForDisplay(rate.price)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${isDark ? 'bg-white/10 text-slate-300' : 'bg-white text-slate-600 border'}`}>
                        <Calendar className="h-3 w-3" /> {rate.date}
                      </span>
                    </div>
                    {rate.note && <p className={`text-xs mt-1.5 ${textS}`}>{rate.note}</p>}
                    {rate.sow && rate.sow.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {rate.sow.map(s => (
                          <span key={s} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-pink-900/20 text-pink-300 border border-pink-500/20' : 'bg-pink-50 border border-pink-200 text-pink-600'}`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDelete(rate.id)}
                    className={`p-1.5 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'text-slate-500 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'} rounded`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
