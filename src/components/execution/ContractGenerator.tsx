import React, { useState, useEffect } from 'react';
import { Campaign, ExecutionProfile, RestoredData } from '../../types';
import { 
  FileText, Copy, Download, X, Sparkles, AlertTriangle, Check, FileSignature 
} from 'lucide-react';

interface ContractGeneratorProps {
  campaign: Campaign;
  profile: ExecutionProfile;
  crmProfile: RestoredData;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const DEFAULT_TEMPLATE = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---

HỢP ĐỒNG DỊCH VỤ TRUYỀN THÔNG
(Số: {contract_number}/HĐDV-{year})

- Căn cứ Bộ luật Dân sự nước Cộng hòa Xã hội Chủ nghĩa Việt Nam;
- Căn cứ vào nhu cầu truyền thông của Bên A và năng lực cung cấp dịch vụ của Bên B;

Hôm nay, ngày {contract_date}, tại Thành phố Hồ Chí Minh, chúng tôi gồm có:

BÊN A (Bên Thuê Dịch Vụ):
- Tên đơn vị: CÔNG TY CỔ PHẦN TRUYỀN THÔNG VÀ QUẢNG CÁO {brand_name}
- Địa chỉ: 123 Đường Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh
- Mã số thuế: {brand_mst}
- Đại diện: {brand_representative} - Chức vụ: Giám đốc Marketing

BÊN B (Bên Cung Cấp Dịch Vụ):
- Tên đối tác (KOL): {kol_name}
- Số CMND/CCCD: {kol_id_card}
- Ngày cấp: {kol_id_date} - Nơi cấp: {kol_id_place}
- Mã số thuế cá nhân: {kol_mst}
- Địa chỉ thường trú: {kol_address}
- Số điện thoại: {kol_phone}
- Số tài khoản: {kol_bank_account}
- Tại ngân hàng: {kol_bank_name}

ĐIỀU 1: PHẠM VI DỊCH VỤ VÀ YÊU CẦU NỘI DUNG (SOW)
Bên B đồng ý thực hiện sản xuất và đăng tải nội dung quảng cáo cho chiến dịch [{campaign_name}] của Bên A theo các hạng mục cụ thể dưới đây:
{sow_details}

ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
- Tổng chi phí dịch vụ chốt: {total_cost} đ.
- Thuế TNCN: Bên A sẽ có trách nhiệm khấu trừ 10% Thuế TNCN của Bên B ({tax_amount} đ) để nộp vào ngân sách nhà nước theo quy định pháp luật. Số tiền thực nhận chuyển khoản của Bên B là: {net_cost} đ.
- Điều khoản & Tiến độ thanh toán: {payment_term}

ĐIỀU 3: TIMELINE & HẠN HOÀN THÀNH
- Thời gian nộp bản thảo duyệt (Content deadline): {content_deadline}
- Hạn đăng bài (Air date): Phối hợp theo lịch phát sóng của nhãn hàng.

ĐIỀU 4: ĐIỀU KHOẢN CHUNG
Hợp đồng có hiệu lực kể từ ngày ký. Được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.

ĐẠI DIỆN BÊN A                               ĐẠI DIỆN BÊN B
(Ký, ghi rõ họ tên)                          (Ký, ghi rõ họ tên)`;

export default function ContractGenerator({
  campaign,
  profile,
  crmProfile,
  onClose,
  theme
}: ContractGeneratorProps) {
  const isDark = theme === 'dark';

  // Custom vs Standard Template
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [contractFields, setContractFields] = useState({
    contract_number: `SH-${Math.floor(1000 + Math.random() * 9000)}`,
    year: new Date().getFullYear().toString(),
    contract_date: new Date().toLocaleDateString('vi-VN'),
    brand_name: campaign.brand.toUpperCase(),
    brand_mst: '0314567890',
    brand_representative: 'Nguyễn Văn A',
    kol_name: crmProfile.nickname || 'Chưa nhập',
    kol_id_card: '',
    kol_id_date: '',
    kol_id_place: '',
    kol_mst: '',
    kol_address: '',
    kol_phone: crmProfile.phone || '',
    kol_bank_account: '',
    kol_bank_name: '',
    campaign_name: campaign.name,
    sow_details: profile.confirmedSOW.length > 0 
      ? profile.confirmedSOW.map((item, idx) => `${idx + 1}. Hạng mục: ${item.name} | Số lượng: ${item.quantity} | Chi phí: ${item.price.toLocaleString('vi-VN')} đ`).join('\n')
      : '- 1x Bài đăng quảng bá sản phẩm truyền thông',
    total_cost: profile.totalCost.toLocaleString('vi-VN'),
    tax_amount: (profile.totalCost * 0.1).toLocaleString('vi-VN'),
    net_cost: (profile.totalCost * 0.9).toLocaleString('vi-VN'),
    payment_term: profile.paymentTerm || 'COD',
    content_deadline: profile.contentDeadline ? new Date(profile.contentDeadline).toLocaleDateString('vi-VN') : 'Theo lịch phối hợp'
  });

  const [compiledContract, setCompiledContract] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto-compile contract text when template or fields change
  useEffect(() => {
    let result = template;
    Object.entries(contractFields).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value);
    });
    setCompiledContract(result);
  }, [template, contractFields]);

  // Form input handler
  const handleInputChange = (field: keyof typeof contractFields, value: string) => {
    setContractFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Download contract as .txt
  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([compiledContract], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `HopDong_KOL_${crmProfile.channelId || 'Profile'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledContract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Color tokens
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark 
    ? 'bg-white/[0.03] border-white/[0.06] text-white focus:bg-white/[0.05] focus:border-violet-500/80' 
    : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500/80';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const panelBg = isDark ? 'bg-[#0d0d12]' : 'bg-slate-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-6xl h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${
        isDark ? 'bg-[#0f0f15] border-white/[0.08]' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center border-slate-500/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-600/15 rounded-xl text-violet-500">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-base font-extrabold ${textPrimary} tracking-tight`}>AI Contract Builder Framework</h3>
              <p className={`text-xs ${textSecondary} mt-0.5`}>
                Tự động điền dữ liệu CRM & SOW vào hợp đồng truyền thông mẫu. Rà soát và tải hợp đồng tức thì.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors ${textSecondary}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body split in two panels */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left panel: editable contract form */}
          <div className="w-full md:w-1/2 p-5 overflow-y-auto space-y-4 border-r border-slate-500/10">
            <div className="flex items-center gap-1.5 pb-2 border-b border-slate-500/5 text-violet-500 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>Trường thông tin cần điền (Auto-filled)</span>
            </div>

            {/* A. Brand representative info */}
            <div className="space-y-3">
              <p className={`text-[10px] font-bold uppercase ${textSecondary} tracking-wider`}>BÊN A (Nhãn hàng - Bên thuê)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Đại diện ký hợp đồng</label>
                  <input
                    type="text"
                    value={contractFields.brand_representative}
                    onChange={e => handleInputChange('brand_representative', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Mã số thuế Bên A</label>
                  <input
                    type="text"
                    value={contractFields.brand_mst}
                    onChange={e => handleInputChange('brand_mst', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>
            </div>

            {/* B. KOL info */}
            <div className="space-y-3 pt-2">
              <p className={`text-[10px] font-bold uppercase ${textSecondary} tracking-wider`}>BÊN B (KOL - Bên cung cấp)</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Họ và tên Bên B</label>
                  <input
                    type="text"
                    value={contractFields.kol_name}
                    onChange={e => handleInputChange('kol_name', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Số CMND / CCCCD *</label>
                  <input
                    type="text"
                    value={contractFields.kol_id_card}
                    onChange={e => handleInputChange('kol_id_card', e.target.value)}
                    placeholder="Nhập CCCD của KOL..."
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Ngày cấp CCCD</label>
                  <input
                    type="text"
                    value={contractFields.kol_id_date}
                    onChange={e => handleInputChange('kol_id_date', e.target.value)}
                    placeholder="VD: 15/08/2021"
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Nơi cấp CCCD</label>
                  <input
                    type="text"
                    value={contractFields.kol_id_place}
                    onChange={e => handleInputChange('kol_id_place', e.target.value)}
                    placeholder="VD: Cục CSQLHC về TTXH"
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Mã số thuế cá nhân</label>
                  <input
                    type="text"
                    value={contractFields.kol_mst}
                    onChange={e => handleInputChange('kol_mst', e.target.value)}
                    placeholder="Nhập MST cá nhân (nếu có)..."
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={contractFields.kol_phone}
                    onChange={e => handleInputChange('kol_phone', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500">Địa chỉ thường trú</label>
                <input
                  type="text"
                  value={contractFields.kol_address}
                  onChange={e => handleInputChange('kol_address', e.target.value)}
                  placeholder="Nhập địa chỉ ghi trên hộ khẩu thường trú..."
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Số tài khoản ngân hàng *</label>
                  <input
                    type="text"
                    value={contractFields.kol_bank_account}
                    onChange={e => handleInputChange('kol_bank_account', e.target.value)}
                    placeholder="Nhập STK chuyển tiền..."
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Mở tại Ngân hàng *</label>
                  <input
                    type="text"
                    value={contractFields.kol_bank_name}
                    onChange={e => handleInputChange('kol_bank_name', e.target.value)}
                    placeholder="VD: Vietcombank chi nhánh HCM"
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>
            </div>

            {/* C. Contract metadata */}
            <div className="space-y-3 pt-2">
              <p className={`text-[10px] font-bold uppercase ${textSecondary} tracking-wider`}>THÔNG TIN HỢP ĐỒNG CHUNG</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Số hợp đồng</label>
                  <input
                    type="text"
                    value={contractFields.contract_number}
                    onChange={e => handleInputChange('contract_number', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Ngày lập hợp đồng</label>
                  <input
                    type="text"
                    value={contractFields.contract_date}
                    onChange={e => handleInputChange('contract_date', e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                  />
                </div>
              </div>
            </div>

            {/* Template modifier guide alert */}
            <div className={`p-3 rounded-xl border leading-relaxed flex gap-2 ${
              isDark ? 'bg-amber-500/5 border-amber-500/10 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 text-amber-500 mt-0.5" />
              <div className="text-[10px]">
                <span className="font-bold">⚠️ Lưu ý soạn thảo:</span> Bạn có thể tuỳ ý chỉnh sửa khung sườn mẫu hợp đồng ở ô bên phải. Hệ thống sẽ tự động tìm kiếm các thẻ dạng <code className="font-semibold">{`{kol_name}`}</code>, <code className="font-semibold">{`{kol_bank_account}`}</code> để điền tức thì.
              </div>
            </div>
          </div>

          {/* Right panel: Compiled live preview and template editor */}
          <div className="w-full md:w-1/2 flex flex-col h-full bg-[#030305]/40 overflow-hidden">
            <div className={`flex justify-between items-center px-4 py-2 border-b ${borderColor} flex-shrink-0`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Live Preview (Bản hợp đồng hoàn chỉnh)
              </span>
              
              <button
                onClick={() => {
                  const custom = prompt("Dán mẫu template hợp đồng của bạn vào đây (Sử dụng các thẻ {kol_name}, {kol_id_card}, {sow_details}, {total_cost} v.v...)", template);
                  if (custom) setTemplate(custom);
                }}
                className="text-[9px] font-bold px-2 py-0.5 border border-violet-500/30 text-violet-400 bg-violet-600/5 hover:bg-violet-600/10 rounded transition-all"
              >
                📝 Edit Template mẫu
              </button>
            </div>

            {/* Document body text */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0 font-mono text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
              {compiledContract}
            </div>

            {/* Action Bar Footer */}
            <div className={`p-4 border-t ${borderColor} flex items-center justify-between flex-shrink-0 bg-black/25`}>
              <span className="text-[9px] text-slate-500 italic">Kiểm tra thông tin trước khi xuất hợp đồng (.txt)</span>
              
              <div className="flex gap-2.5">
                <button
                  onClick={handleCopy}
                  className="px-4.5 py-2.5 text-xs font-bold rounded-xl bg-slate-500/10 border border-white/5 hover:bg-slate-500/15 text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã copy!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy nội dung</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải Hợp Đồng</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
