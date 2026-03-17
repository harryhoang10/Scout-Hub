import React, { useState, useRef } from 'react';
import { Upload, FileDown, Play, CheckCircle2, XCircle, Loader2, Trash2, Link as LinkIcon, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import * as XLSX from 'xlsx';
import { ProfileData, RestoredData } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface FacebookExtractorProps {
  onSaveToRestored: (data: RestoredData[]) => void;
}

export function FacebookExtractor({ onSaveToRestored }: FacebookExtractorProps) {
  const [rows, setRows] = useState<ProfileData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualInput, setManualInput] = useState('');

  const handleManualAdd = () => {
    const urls = manualInput.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;
    
    const newRows = urls.map(url => ({
      id: Math.random().toString(36).substring(7),
      url,
      status: 'pending' as const
    }));

    setRows(prev => {
      const combined = [...prev, ...newRows];
      return combined.slice(0, 30);
    });
    setManualInput('');
  };

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
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const urls: string[] = [];
        for (const row of data) {
          for (const cell of row) {
            if (typeof cell === 'string' && cell.includes('facebook.com')) {
              urls.push(cell.trim());
              break;
            }
          }
        }

        const newRows = urls.map(url => ({
          id: Math.random().toString(36).substring(7),
          url,
          status: 'pending' as const
        }));

        setRows(prev => {
          const combined = [...prev, ...newRows];
          return combined.slice(0, 30);
        });
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Lỗi khi đọc file. Vui lòng đảm bảo file là định dạng Excel hoặc CSV hợp lệ.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processLinks = async () => {
    if (rows.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const pendingRows = rows.filter(r => r.status === 'pending' || r.status === 'error');
    
    for (const row of pendingRows) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'processing', errorMsg: undefined } : r));
      
      try {
        const response = await fetch('/api/extract-facebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: row.url }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Lỗi không xác định');
        }

        let phone = "N/A";
        let email = "N/A";
        let bioLink = "N/A";
        let followers = result.followers || "N/A";
        let bio = result.description || "N/A";
        let profileType: 'Individual' | 'Community' | 'N/A' = 'N/A';

        // Regex fallback for email
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        if (bio && (!email || email === "N/A")) {
          const emailMatch = bio.match(emailRegex);
          if (emailMatch && emailMatch.length > 0) {
            email = emailMatch[0];
          }
        }

        // Regex fallback for phone
        const phoneRegex = /(?:zalo|sđt|phone|call|lh|liên hệ|hotline)?\s*[:\-.]?\s*((?:0|\+84)[0-9\.\-\s]{8,13})/i;
        if (bio && (!phone || phone === "N/A")) {
          const phoneMatch = bio.match(phoneRegex);
          if (phoneMatch && phoneMatch.length > 1) {
            phone = phoneMatch[1].replace(/[\.\-\s]/g, '');
          }
        }

        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey && (result.description || result.title)) {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
Bạn là một chuyên gia trích xuất dữ liệu (Data Extractor).
Hãy phân tích các thông tin meta từ một đường link Facebook sau đây và trích xuất ra các thông tin cần thiết.
Đặc biệt lưu ý với Số điện thoại: Người dùng thường dùng icon, emoji (như 0️⃣9️⃣...), ghi chữ (không chín...), hoặc thêm dấu chấm/phẩy/khoảng trắng để lách luật. Hãy nhận diện và chuyển đổi chúng thành một chuỗi số điện thoại hợp lệ (ví dụ: 0912345678).

Title: """${result.title}"""
Description: """${result.description}"""
URL: """${row.url}"""
Followers (đã trích xuất sơ bộ): """${result.followers || ''}"""

Hãy trả về kết quả dưới dạng JSON với cấu trúc sau:
{
  "phone": "Số điện thoại đã được chuẩn hóa (chỉ chứa chữ số, ví dụ: 0912345678). Nếu không có, trả về rỗng",
  "email": "Địa chỉ email (nếu có). Nếu không có, trả về rỗng",
  "link": "Đường link website/bio (nếu có). Nếu không có, trả về rỗng",
  "followers": "Số lượng người theo dõi (Followers), lượt thích (Likes) hoặc thành viên (Members) dưới dạng số hoặc chữ (VD: 1.2M, 500K, 1200). Hãy tìm kỹ trong Description các từ như 'members', 'thành viên', 'người theo dõi', 'followers', 'likes', 'lượt thích'. Nếu không thấy, ưu tiên dùng 'Followers (đã trích xuất sơ bộ)' được cung cấp ở trên. Nếu vẫn không có, trả về rỗng",
  "bio": "Tiểu sử hoặc mô tả ngắn gọn về trang/người này (loại bỏ các thông tin rác). Nếu không có, trả về rỗng",
  "profileType": "Phân loại: Trả về 'Individual' nếu đây là trang cá nhân (Profile) hoặc Fanpage của một CÁ NHÂN (nghệ sĩ, KOL, ca sĩ, diễn viên, người nổi tiếng, v.v.). Trả về 'Community' nếu đây là Group (Nhóm), hoặc Fanpage của một TỔ CHỨC, DOANH NGHIỆP, CỘNG ĐỒNG."
}
            `;

            const aiResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    phone: { type: Type.STRING },
                    email: { type: Type.STRING },
                    link: { type: Type.STRING },
                    followers: { type: Type.STRING },
                    bio: { type: Type.STRING },
                    profileType: { type: Type.STRING }
                  },
                  required: ["phone", "email", "link", "followers", "bio", "profileType"]
                }
              }
            });

            if (aiResponse.text) {
              let text = aiResponse.text.trim();
              if (text.startsWith('\`\`\`json')) {
                text = text.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
              } else if (text.startsWith('\`\`\`')) {
                text = text.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
              }
              const aiData = JSON.parse(text);
              
              if (aiData.phone && aiData.phone.trim() !== "") phone = aiData.phone;
              if (aiData.email && aiData.email.trim() !== "") email = aiData.email;
              if (aiData.link && aiData.link.trim() !== "") bioLink = aiData.link;
              if (aiData.followers && aiData.followers.trim() !== "") followers = aiData.followers;
              if (aiData.bio && aiData.bio.trim() !== "") bio = aiData.bio;
              if (aiData.profileType === 'Community' || aiData.profileType === 'Individual') {
                profileType = aiData.profileType;
              }
            }
          }
        } catch (aiErr) {
          console.error("AI Extraction error:", aiErr);
        }

        // Fallback profile type from URL if AI failed
        if (profileType === 'N/A') {
          if (row.url.includes('/groups/') || row.url.includes('/pages/')) {
            profileType = 'Community';
          } else {
            profileType = 'Individual';
          }
        }

        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r,
          status: 'success',
          nickname: result.nickname,
          channelId: row.url.split('facebook.com/')[1]?.split('/')[0] || '',
          followers,
          bio,
          profilePic: result.profilePic,
          phone,
          email,
          bioLink,
          profileType
        } : r));

      } catch (error: any) {
        setRows(prev => prev.map(r => r.id === row.id ? {
          ...r,
          status: 'error',
          errorMsg: error.message
        } : r));
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setIsProcessing(false);
  };

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

  const exportToExcel = () => {
    if (rows.length === 0) return;
    
    const exportData = rows.map((row, index) => ({
      'STT': index + 1,
      'Tên': row.nickname || '',
      'ID': row.channelId || '',
      'Followers / Members': formatFollowers(row.followers) || '',
      'SĐT': row.phone || '',
      'Email': row.email || '',
      'Link Bio': row.bioLink || '',
      'Link': row.url,
      'Tiểu sử (Bio)': row.bio || '',
      'Profile': row.profileType || '',
      'Link ảnh': row.profilePic || '',
      'Trạng thái': row.status === 'success' ? 'Thành công' : row.status === 'error' ? `Lỗi: ${row.errorMsg}` : 'Chưa xử lý'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facebook Data");
    XLSX.writeFile(wb, "facebook_extract.xlsx");
  };

  const clearRows = () => {
    if (isProcessing) return;
    setRows([]);
  };

  const handleSave = () => {
    const successRows = rows.filter(r => r.status === 'success');
    if (successRows.length === 0) {
      alert("Không có dữ liệu thành công nào để lưu trữ.");
      return;
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const saveDate = `${dd}-${mm}-${yyyy}`;

    const restoredData: RestoredData[] = successRows.map(r => ({
      ...r,
      platform: 'Facebook',
      profileType: r.profileType || 'Individual',
      tier: [],
      location: [],
      group: [],
      campaign: [],
      notes: [],
      rating: 0,
      saveDate
    }));

    onSaveToRestored(restoredData);
    alert(`Đã lưu ${restoredData.length} hồ sơ vào trang Lưu trữ thành công!`);
    
    // Mark as saved so user doesn't save again
    setRows(prev => prev.filter(r => r.status !== 'success'));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Nhập link thủ công</CardTitle>
            <CardDescription>Mỗi link một dòng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full h-32 p-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-950 resize-none"
              placeholder="https://www.facebook.com/username1&#10;https://www.facebook.com/groups/123456"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              disabled={isProcessing}
            />
            <Button 
              onClick={handleManualAdd} 
              disabled={!manualInput.trim() || isProcessing || rows.length >= 30}
              className="w-full"
            >
              Thêm vào danh sách ({rows.length}/30)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Tải lên file (Excel/CSV)</CardTitle>
            <CardDescription>Hệ thống sẽ tự động tìm link Facebook trong file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex flex-col justify-center items-center h-[188px] border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50 m-6 mt-0">
            <Upload className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 text-center px-4">
              Kéo thả file hoặc click để chọn file .xlsx, .csv
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || rows.length >= 30}
            >
              Chọn file
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Danh sách xử lý</CardTitle>
            <CardDescription>Đã thêm {rows.length}/30 link</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearRows}
              disabled={isProcessing || rows.length === 0}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Xóa hết
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSave}
              disabled={isProcessing || rows.length === 0 || !rows.some(r => r.status === 'success')}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Save className="h-4 w-4 mr-1.5" /> Lưu trữ
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToExcel}
              disabled={rows.length === 0}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <FileDown className="h-4 w-4 mr-1.5" /> Xuất Excel
            </Button>
            <Button 
              size="sm" 
              onClick={processLinks}
              disabled={isProcessing || rows.length === 0 || !rows.some(r => r.status === 'pending' || r.status === 'error')}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Đang chạy...</>
              ) : (
                <><Play className="h-4 w-4 mr-1.5" /> Bắt đầu trích xuất</>
              )}
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium w-12 text-center">STT</th>
                <th className="px-4 py-3 font-medium w-48">Tên</th>
                <th className="px-4 py-3 font-medium w-32">ID</th>
                <th className="px-4 py-3 font-medium w-24 text-right">Followers / Members</th>
                <th className="px-4 py-3 font-medium w-32">SĐT</th>
                <th className="px-4 py-3 font-medium w-48">Email</th>
                <th className="px-4 py-3 font-medium w-48">Link Bio</th>
                <th className="px-4 py-3 font-medium w-48">Link</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Tiểu sử (Bio)</th>
                <th className="px-4 py-3 font-medium w-24 text-center">Profile</th>
                <th className="px-4 py-3 font-medium w-24 text-center">Ảnh</th>
                <th className="px-4 py-3 font-medium w-32 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    Chưa có dữ liệu. Vui lòng thêm link hoặc tải file lên.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium truncate max-w-[12rem]" title={row.nickname}>{row.nickname || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[8rem]" title={row.channelId}>{row.channelId ? `@${row.channelId}` : '-'}</td>
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
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[12rem]" title={row.url}>
                      <a href={row.url} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline flex items-center gap-1">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{row.url}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs line-clamp-2" title={row.bio}>{row.bio || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {row.profileType === 'Community' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600">Community</span>
                      ) : row.profileType === 'Individual' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">Individual</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.profilePic ? (
                        <a href={row.profilePic} target="_blank" rel="noreferrer" className="inline-block">
                          <img src={row.profilePic} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {row.status === 'pending' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Chờ xử lý</span>}
                        {row.status === 'processing' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Đang chạy</span>}
                        {row.status === 'success' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Thành công</span>}
                        {row.status === 'error' && (
                          <>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600" title={row.errorMsg}>
                              <XCircle className="h-3 w-3 mr-1" /> Lỗi
                            </span>
                            <button 
                              onClick={() => {
                                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'pending' } : r));
                                setTimeout(() => processLinks(), 100);
                              }}
                              disabled={isProcessing}
                              className="text-[10px] flex items-center text-slate-500 hover:text-blue-600 transition-colors mt-1"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Thử lại
                            </button>
                          </>
                        )}
                      </div>
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
