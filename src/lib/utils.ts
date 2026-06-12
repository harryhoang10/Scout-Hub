import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanAvatarUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  
  // Extract original URL if it is already wrapped in our proxy URL
  if (cleaned.includes('/api/proxy-image/')) {
    try {
      const parsed = new URL(cleaned);
      const rawUrl = parsed.searchParams.get('url');
      if (rawUrl) {
        cleaned = rawUrl;
      }
    } catch (e) {}
  }
  
  if (cleaned.includes('tiktokcdn.com')) {
    // 1. Rewrite low-res shrink WebP path parameter to high-res cropcenter JPEG
    cleaned = cleaned.replace(/~tplv-tiktok-shrink:[^?]+\.webp/g, '~tplv-tiktokx-cropcenter:1080:1080.jpeg');
    
    // 2. Catch any other ~tplv-* template with .webp extension
    cleaned = cleaned.replace(/(~tplv-[^:]+:[^.]+)\.webp/g, '$1.jpeg');
    
    // 3. Fallback: replace any remaining .webp extension in path with .jpeg
    cleaned = cleaned.replace(/\.webp($|\?)/g, '.jpeg$1');
  }
  
  return cleaned;
}

export function parseMetricValue(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  if (!raw || raw === 'n/a' || raw === '-') return 0;

  let multiplier = 1;
  if (raw.includes('triệu') || raw.endsWith('m')) multiplier = 1_000_000;
  else if (raw.includes('nghìn') || raw.includes('ngàn') || raw.endsWith('k')) multiplier = 1_000;

  // Extract digits, dots, commas
  const numericText = raw.replace(/[^0-9.,]/g, '');
  if (!numericText) return 0;

  let normalized = numericText;
  
  // Case 1: Both comma and dot exist (e.g. 1,500.50 or 1.500,50)
  if (numericText.includes(',') && numericText.includes('.')) {
    const lastComma = numericText.lastIndexOf(',');
    const lastDot = numericText.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Comma is decimal separator (e.g. 1.500,50)
      normalized = numericText.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is decimal separator (e.g. 1,500.50)
      normalized = numericText.replace(/,/g, '');
    }
  } 
  // Case 2: Only comma exists (e.g. 10,000 or 10,5)
  else if (numericText.includes(',') && !numericText.includes('.')) {
    const parts = numericText.split(',');
    // If last part has length 3, it's likely a thousands separator (e.g. 10,000)
    // If last part has length 1 or 2, it's likely a decimal separator (e.g. 10,5)
    if (parts[parts.length - 1].length === 3) {
      normalized = numericText.replace(/,/g, '');
    } else {
      normalized = numericText.replace(/,/g, '.');
    }
  } 
  // Case 3: Only dot exists (e.g. 10.000 or 10.5)
  else if (numericText.includes('.') && !numericText.includes(',')) {
    const parts = numericText.split('.');
    // If last part has length 3, it's likely a thousands separator (e.g. 10.000 or 1.500.000)
    // If last part has length 1 or 2, it's likely a decimal separator (e.g. 10.5)
    if (parts[parts.length - 1].length === 3) {
      normalized = numericText.replace(/\./g, '');
    } else {
      // Already a decimal separator dot, keep it
    }
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

