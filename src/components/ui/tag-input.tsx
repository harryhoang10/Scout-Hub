import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Badge } from './badge';
import { cn } from '@/src/lib/utils';

interface TagInputProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TagInput({ options, value, onChange, placeholder }: TagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    if (!value.includes(option)) {
      onChange([...value, option]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleSelect(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(inputValue.toLowerCase()) && !value.includes(opt)
  );

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-within:ring-2 focus-within:ring-slate-950 focus-within:ring-offset-2"
        onClick={() => setIsOpen(true)}
      >
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="rounded-full hover:bg-slate-200 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none placeholder:text-slate-500 min-w-[80px]"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
        />
        <ChevronDown className="h-4 w-4 text-slate-400 cursor-pointer" onClick={() => setIsOpen(!isOpen)} />
      </div>

      {isOpen && (inputValue || filteredOptions.length > 0) && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {filteredOptions.map(option => (
            <div
              key={option}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => handleSelect(option)}
            >
              {option}
            </div>
          ))}
          {inputValue && !options.includes(inputValue) && !value.includes(inputValue) && (
            <div
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 text-blue-600"
              onClick={() => handleSelect(inputValue.trim())}
            >
              Thêm "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
