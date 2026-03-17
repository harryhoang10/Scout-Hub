import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, CheckCircle2 } from 'lucide-react';

interface TagSelectorProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  color?: 'violet' | 'emerald' | 'blue';
}

export function TagSelector({ options, value, onChange, color = 'violet' }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const removeTag = (e: React.MouseEvent, opt: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== opt));
  };

  const colorClasses = {
    violet: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-800/40',
    emerald: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/40',
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/40'
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[28px] w-full border dark:border-white/10 rounded px-2 py-1 flex flex-wrap gap-1 items-center bg-transparent cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-colors"
      >
        {value.length === 0 && <span className="text-[10px] text-slate-400">Chọn...</span>}
        {value.map(val => (
          <span 
            key={val} 
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${colorClasses[color]}`}
          >
            {val}
            <button onClick={(e) => removeTag(e, val)} className="opacity-70 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <ChevronDown className="h-3 w-3 text-slate-400 ml-auto flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-white/10 rounded-lg shadow-xl max-h-48 overflow-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">Không có tùy chọn</div>
          ) : (
            options.map(opt => {
              const selected = value.includes(opt);
              return (
                <div 
                  key={opt}
                  onClick={() => toggleOption(opt)}
                  className={`px-3 py-1.5 text-[11px] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between ${selected ? 'text-violet-600 dark:text-violet-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  {opt}
                  {selected && <CheckCircle2 className="h-3 w-3" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
