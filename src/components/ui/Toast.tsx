import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: ToastType }>;
      if (!customEvent.detail) return;
      const { message, type } = customEvent.detail;
      const id = Math.random().toString(36).substring(7);
      
      setToasts(prev => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    };

    window.addEventListener('scout-toast', handleToastEvent);
    return () => window.removeEventListener('scout-toast', handleToastEvent);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      {toasts.map(toast => {
        const bgColor = toast.type === 'success' 
          ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20' 
          : toast.type === 'error'
          ? 'bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-950/20'
          : 'bg-[#0f172a]/95 border-blue-500/30 text-blue-200 shadow-slate-950/20';

        const Icon = toast.type === 'success' 
          ? CheckCircle 
          : toast.type === 'error'
          ? AlertCircle 
          : Info;

        return (
          <div 
            key={toast.id} 
            className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-xl backdrop-blur-md pointer-events-auto transition-all duration-300 animate-slide-in-up ${bgColor}`}
            style={{
              animation: 'scout-toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <Icon className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs font-semibold leading-relaxed break-words">{toast.message}</div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-0.5 hover:bg-white/10 rounded transition-colors ml-1 cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const showToast = (message: string, type: ToastType = 'success') => {
  window.dispatchEvent(new CustomEvent('scout-toast', { detail: { message, type } }));
};
