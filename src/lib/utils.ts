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
