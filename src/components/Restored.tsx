import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileDown, Search, Trash2, Link as LinkIcon, Filter, ArrowUpDown, CopyX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TagInput } from './ui/tag-input';
import * as XLSX from 'xlsx';
import { RestoredData } from '../types';
import { cn } from '../lib/utils';

interface RestoredProps {
  data: RestoredData[];
  onUpdateData: (data: RestoredData[]) => void;
}

const TIER_OPTIONS = ['UGC', 'Nano', 'Micro', 'Macro', 'Celeb'];
const LOCATION_OPTIONS = ['Bắc', 'Trung', 'Nam'];
const GROUP_OPTIONS = ['Beauty', 'Fashion', 'Food', 'Tech', 'Education', 'Entertainment'];

type SortField = 'saveDate' | 'nickname' | 'followers' | 'aveView' | 'aveEngagement';
type SortOrder = 'asc' | 'desc';

export function Restored({ data, onUpdateData }: RestoredProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('saveDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws) as any[];
        
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const saveDate = `${dd}-${mm}-${yyyy}`;

        const newRows: RestoredData[] = rows.map(row => {
          // Try to map fields
          const url = row['Link'] || row['url'] || row['URL'] || '';
          const nickname = row['Tên'] || row['nickname'] || row['Name'] || '';
          const channelId = row['ID'] || row['channelId'] || '';
          const followers = row['Followers'] || row['followers'] || '';
          const phone = row['SĐT'] || row['phone'] || '';
          const email = row['Email'] || row['email'] || '';
          const bioLink = row['Link Bio'] || row['bioLink'] || '';
          const bio = row['Tiểu sử (Bio)'] || row['bio'] || row['Bio'] || '';
          const profilePic = row['Link ảnh'] || row['profilePic'] || row['Avatar'] || '';
          const platform = row['Platform'] || row['platform'] || (url.includes('facebook.com') ? 'Facebook' : 'TikTok');
          const profileType = row['Profile'] || row['profileType'] || 'Individual';
          
          const tierStr = row['Tier'] || '';
          const locationStr = row['Vị trí'] || row['Location'] || '';
          const groupStr = row['Nhóm Influencer'] || row['Group'] || '';

          return {
            id: Math.random().toString(36).substring(7),
            url,
            status: 'success' as const,
            nickname,
            channelId,
            followers,
            phone,
            email,
            bioLink,
            bio,
            profilePic,
            platform,
            profileType,
            tier: tierStr ? tierStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            location: locationStr ? locationStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            group: groupStr ? groupStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
            campaign: [],
            notes: [],
            rating: 0,
            saveDate: row['Ngày lưu trữ'] || row['Save Date'] || saveDate
          };
        }).filter(r => r.url && (r.url.includes('tiktok.com') || r.url.includes('facebook.com')));

        onUpdateData([...data, ...newRows]);
        alert(`Đã import thành công ${newRows.length} dòng dữ liệu.`);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Lỗi khi đọc file. Vui lòng đảm bảo file có các cột tương ứng.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportToExcel = () => {
    if (data.length === 0) return;
    
    const exportData = data.map((row, index) => ({
      'STT': index + 1,
      'Ngày lưu trữ': row.saveDate,
      'Platform': row.platform || 'TikTok',
      'Profile': row.profileType || 'Individual',
      'Tên': row.nickname || '',
      'ID': row.channelId || '',
      'Followers / Members': formatFollowers(row.followers) || '',
      'SĐT': row.phone || '',
      'Email': row.email || '',
      'Link Bio': row.bioLink || '',
      'Link': row.url,
      'Tiểu sử (Bio)': row.bio || '',
      'Link ảnh': row.profilePic || '',
      'Tier': row.tier.join(', '),
      'Vị trí': row.location.join(', '),
      'Nhóm Influencer': row.group.join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Restored Data");
    XLSX.writeFile(wb, "tiktok_restored.xlsx");
  };

  const updateRow = (id: string, field: keyof RestoredData, value: any) => {
    onUpdateData(data.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRow = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa dòng này?')) {
      onUpdateData(data.filter(r => r.id !== id));
    }
  };

  const clearAll = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu lưu trữ?')) {
      onUpdateData([]);
    }
  };

  const removeDuplicates = () => {
    const uniqueData: RestoredData[] = [];
    const seen = new Set<string>();

    data.forEach(row => {
      // Create a string representation of the row for comparison (excluding id and saveDate)
      const rowString = JSON.stringify({
        url: row.url,
        nickname: row.nickname,
        channelId: row.channelId,
        followers: row.followers,
        phone: row.phone,
        email: row.email,
        bioLink: row.bioLink,
        bio: row.bio,
        profilePic: row.profilePic,
        platform: row.platform,
        profileType: row.profileType,
        tier: row.tier.sort(),
        location: row.location.sort(),
        group: row.group.sort()
      });

      if (!seen.has(rowString)) {
        seen.add(rowString);
        uniqueData.push(row);
      }
    });

    const removedCount = data.length - uniqueData.length;
    if (removedCount > 0) {
      onUpdateData(uniqueData);
      alert(`Đã loại bỏ ${removedCount} dữ liệu trùng lặp.`);
    } else {
      alert("Không tìm thấy dữ liệu trùng lặp nào.");
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for new sort field
    }
  };

  const parseNumberForSort = (val: string | number | undefined) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(val.replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.nickname && r.nickname.toLowerCase().includes(lower)) ||
        (r.channelId && r.channelId.toLowerCase().includes(lower)) ||
        (r.bio && r.bio.toLowerCase().includes(lower)) ||
        (r.tier.some(t => t.toLowerCase().includes(lower))) ||
        (r.location.some(l => l.toLowerCase().includes(lower))) ||
        (r.group.some(g => g.toLowerCase().includes(lower)))
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'followers' || sortField === 'aveView' || sortField === 'aveEngagement') {
        valA = parseNumberForSort(valA);
        valB = parseNumberForSort(valB);
      } else if (sortField === 'saveDate') {
        // Simple date sort assuming dd-mm-yyyy
        const [d1, m1, y1] = (valA as string || '').split('-');
        const [d2, m2, y2] = (valB as string || '').split('-');
        valA = new Date(`${y1}-${m1}-${d1}`).getTime() || 0;
        valB = new Date(`${y2}-${m2}-${d2}`).getTime() || 0;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortOrder]);

  const formatFollowers = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '' || val === 'N/A') return '';
    let strVal = val.toString().toLowerCase().trim();

    let multiplier = 1;
    if (strVal.includes('triệu') || strVal.includes('m')) {
      multiplier = 1000000;
    } else if (strVal.includes('nghìn') || strVal.includes('ngàn') || strVal.includes('k')) {
      multiplier = 1000;
    }

    let numStr = strVal.replace(/[^0-9.,]/g, '');

    if (multiplier > 1) {
      numStr = numStr.replace(',', '.');
    } else {
      numStr = numStr.replace(/,/g, '');
    }

    let parsedNum = parseFloat(numStr) * multiplier;

    if (isNaN(parsedNum)) return val.toString();

    if (parsedNum >= 1000000) {
      return (parsedNum / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (parsedNum >= 1000) {
      return (parsedNum / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return parsedNum.toString();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return <ArrowUpDown className={`h-3 w-3 ml-1 ${sortOrder === 'desc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} />;
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Dữ liệu lưu trữ (Restored)</CardTitle>
            <CardDescription>Tổng số: {filteredAndSortedData.length} hồ sơ</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm kiếm, lọc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" /> Import
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToExcel}
              disabled={data.length === 0}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <FileDown className="h-4 w-4 mr-1.5" /> Xuất Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={removeDuplicates}
              disabled={data.length === 0}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
              <CopyX className="h-4 w-4 mr-1.5" /> Lọc trùng
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAll}
              disabled={data.length === 0}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Xóa hết
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium w-12 text-center">STT</th>
                <th className="px-4 py-3 font-medium w-24 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('saveDate')}>
                  <div className="flex items-center">Ngày lưu <SortIcon field="saveDate" /></div>
                </th>
                <th className="px-4 py-3 font-medium w-24">Platform</th>
                <th className="px-4 py-3 font-medium w-24">Profile</th>
                <th className="px-4 py-3 font-medium w-48 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('nickname')}>
                  <div className="flex items-center">Tên / ID <SortIcon field="nickname" /></div>
                </th>
                <th className="px-4 py-3 font-medium w-24 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleSort('followers')}>
                  <div className="flex items-center justify-end">Followers / Members <SortIcon field="followers" /></div>
                </th>
                <th className="px-4 py-3 font-medium w-32">SĐT</th>
                <th className="px-4 py-3 font-medium w-48">Email</th>
                <th className="px-4 py-3 font-medium w-48">Link Bio</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Tier</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Vị trí</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Nhóm Influencer</th>
                <th className="px-4 py-3 font-medium w-16 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Chưa có dữ liệu lưu trữ.
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.saveDate}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        row.platform === 'Facebook' ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800"
                      )}>
                        {row.platform || 'TikTok'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        row.profileType === 'Community' ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                      )}>
                        {row.profileType || 'Individual'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[12rem]" title={row.nickname}>{row.nickname || '-'}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[12rem]" title={row.channelId}>
                        {row.channelId ? `@${row.channelId}` : '-'}
                      </div>
                      <a href={row.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                        <LinkIcon className="h-3 w-3 shrink-0" /> Link
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatFollowers(row.followers) || '-'}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">{row.phone && row.phone !== 'N/A' ? row.phone : '-'}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[12rem]" title={row.email}>{row.email && row.email !== 'N/A' ? row.email : '-'}</td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[12rem]" title={row.bioLink}>
                      {row.bioLink && row.bioLink !== 'N/A' ? (
                        <a href={row.bioLink.startsWith('http') ? row.bioLink : `https://${row.bioLink}`} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3 w-3 shrink-0" /> Link Bio
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <TagInput 
                        options={TIER_OPTIONS} 
                        value={row.tier} 
                        onChange={(val) => updateRow(row.id, 'tier', val)} 
                        placeholder="Chọn Tier..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TagInput 
                        options={LOCATION_OPTIONS} 
                        value={row.location} 
                        onChange={(val) => updateRow(row.id, 'location', val)} 
                        placeholder="Chọn Vị trí..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TagInput 
                        options={GROUP_OPTIONS} 
                        value={row.group} 
                        onChange={(val) => updateRow(row.id, 'group', val)} 
                        placeholder="Chọn Nhóm..."
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteRow(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
