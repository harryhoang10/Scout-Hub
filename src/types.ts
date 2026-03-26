export interface ProfileData {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  nickname?: string;
  channelId?: string;
  followers?: string | number;
  following?: string | number;
  likes?: string | number;
  bio?: string;
  profilePic?: string;
  phone?: string;
  email?: string;
  bioLink?: string;
  platform?: Platform;
  profileType?: 'Individual' | 'Community' | 'N/A';
  // TikTok engagement metrics
  averageView?: number;
  averageEngagement?: number;
  totalLikes?: number;
  totalComments?: number;
  totalShares?: number;
  totalSaves?: number;
  videoCount?: number;
}

export interface ProfileNote {
  id: string;
  text: string;
  createdAt: string;
}

export type Tier = 'Macro' | 'Micro' | 'Nano' | 'UGC';
export type Platform = 'TikTok' | 'Facebook';

export interface RestoredData extends ProfileData {
  id: string;
  tier: Tier[];
  location: string[];
  group: string[];
  campaign: string[];
  sow: string[];
  notes: { id: string, text: string, createdAt: string }[];
  rateHistory?: { id: string, date: string, price: number, note?: string, sow?: string[] }[];
  rating: number;
  saveDate: string;
  lastUpdated?: string;
}
