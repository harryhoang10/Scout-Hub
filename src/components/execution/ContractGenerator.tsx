import React, { useState, useEffect } from 'react';
import { Campaign, ExecutionProfile, RestoredData, KOLContractInfo } from '../../types';
import { 
  FileText, Copy, Download, X, Sparkles, AlertTriangle, Check, FileSignature, 
  ArrowRight, ArrowLeft, Upload, FileCheck, ClipboardList, CheckCircle2, RefreshCw, FileCode
} from 'lucide-react';
import { 
  parseKOLInfoText, 
  detectEntityType, 
  fillContractTemplate, 
  getUnfilledPlaceholders, 
  markdownToWordHtml 
} from '../../lib/kolInfoParser';

interface ContractGeneratorProps {
  campaign: Campaign;
  profile: ExecutionProfile;
  crmProfile: RestoredData;
  onUpdateCRMProfile?: (profileId: string, field: keyof RestoredData, value: any) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const DEFAULT_INDIVIDUAL_TEMPLATE = `# CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
## Độc lập - Tự do - Hạnh phúc
---
# HỢP ĐỒNG DỊCH VỤ TRUYỀN THÔNG CÁ NHÂN
**Số: {{ contract_number }}/HĐDV-{{ year }}**

- *Căn cứ Bộ luật Dân sự nước Cộng hòa Xã hội Chủ nghĩa Việt Nam;*
- *Căn cứ vào nhu cầu truyền thông của Bên A và năng lực cung cấp dịch vụ của Bên B;*

Hôm nay, ngày {{ contract_date }}, chúng tôi gồm có:

## BÊN A (Bên Thuê Dịch Vụ)
- **Tên đơn vị:** {{ brand_company_name }}
- **Địa chỉ:** {{ brand_address }}
- **Mã số thuế:** {{ brand_tax_id }}
- **Đại diện:** {{ brand_representative }} — Chức vụ: {{ brand_position }}

## BÊN B (Bên Cung Cấp Dịch Vụ — Cá nhân)
- **Họ và tên:** {{ kol_full_name }}
- **Số CCCD:** {{ kol_id_number }}
- **Ngày cấp:** {{ kol_id_issue_date }} — Nơi cấp: {{ kol_id_issue_place }}
- **Mã số thuế cá nhân:** {{ kol_personal_tax_id }}
- **Địa chỉ thường trú:** {{ kol_permanent_address }}
- **Địa chỉ liên hệ:** {{ kol_contact_address }}
- **Số điện thoại:** {{ kol_phone }}
- **Email:** {{ kol_email }}
- **Tên tài khoản ngân hàng:** {{ kol_bank_account_name }}
- **Số tài khoản:** {{ kol_bank_account_no }}
- **Tại ngân hàng:** {{ kol_bank_name }}

## ĐIỀU 1: PHẠM VI DỊCH VỤ VÀ YÊU CẦU NỘI DUNG (SOW)
Bên B đồng ý thực hiện sản xuất và đăng tải nội dung quảng cáo cho chiến dịch [{{ campaign_name }}] của Bên A theo các hạng mục cụ thể dưới đây:

{{ sow_table }}

## ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
- **Tổng chi phí dịch vụ chốt:** {{ total_cost }} đ.
- **Thuế TNCN khấu trừ (10%):** {{ tax_amount }} đ *(Bên A có trách nhiệm khấu trừ và nộp thay Bên B vào ngân sách nhà nước)*.
- **Số tiền thực nhận chuyển khoản:** {{ net_cost }} đ.
- **Điều khoản thanh toán:** {{ payment_term }}

## ĐIỀU 3: TIẾN ĐỘ THỰC HIỆN
- **Hạn nộp bản thảo duyệt (Content deadline):** {{ content_deadline }}
- **Hạn đăng bài chính thức (Air date):** Theo lịch phối hợp nhãn hàng.

## ĐIỀU 4: ĐIỀU KHOẢN CHUNG
Hợp đồng có hiệu lực kể từ ngày ký. Được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.

---
| ĐẠI DIỆN BÊN A | ĐẠI DIỆN BÊN B |
|:---:|:---:|
| *(Ký, ghi rõ họ tên)* | *(Ký, ghi rõ họ tên)* |`;

const DEFAULT_COMPANY_TEMPLATE = `# CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
## Độc lập - Tự do - Hạnh phúc
---
# HỢP ĐỒNG DỊCH VỤ TRUYỀN THÔNG DOANH NGHIỆP
**Số: {{ contract_number }}/HĐDV-{{ year }}**

- *Căn cứ Luật Thương mại nước Cộng hòa Xã hội Chủ nghĩa Việt Nam;*
- *Căn cứ nhu cầu và khả năng thực tế của hai bên;*

Hôm nay, ngày {{ contract_date }}, chúng tôi gồm có:

## BÊN A (Bên Thuê Dịch Vụ)
- **Tên đơn vị:** {{ brand_company_name }}
- **Địa chỉ:** {{ brand_address }}
- **Mã số thuế:** {{ brand_tax_id }}
- **Đại diện:** {{ brand_representative }} — Chức vụ: {{ brand_position }}

## BÊN B (Bên Cung Cấp Dịch Vụ — Công ty)
- **Tên Công ty:** {{ kol_company_name }}
- **Mã số thuế:** {{ kol_company_tax_id }}
- **Địa chỉ trụ sở:** {{ kol_company_address }}
- **Đại diện theo pháp luật:** {{ kol_legal_representative }}
- **Theo Giấy ủy quyền (nếu có):** {{ kol_authorization }}
- **Chức vụ:** {{ kol_position }}
- **Số điện thoại:** {{ kol_phone }}
- **Tên tài khoản công ty:** {{ kol_bank_account_name }}
- **Số tài khoản:** {{ kol_bank_account_no }}
- **Tại ngân hàng:** {{ kol_bank_name }}

## ĐIỀU 1: PHẠM VI DỊCH VỤ VÀ YÊU CẦU NỘI DUNG (SOW)
Bên B đồng ý thực hiện sản xuất và đăng tải nội dung quảng cáo cho chiến dịch [{{ campaign_name }}] của Bên A theo các hạng mục cụ thể dưới đây:

{{ sow_table }}

## ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
- **Tổng chi phí dịch vụ chốt:** {{ total_cost }} đ (Đã bao gồm thuế VAT).
- **Tiến độ thanh toán:** {{ payment_term }}

## ĐIỀU 3: TIẾN ĐỘ THỰC HIỆN
- **Hạn nộp bản thảo duyệt (Content deadline):** {{ content_deadline }}

## ĐIỀU 4: ĐIỀU KHOẢN CHUNG
Hợp đồng có hiệu lực kể từ ngày ký. Được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.

---
| ĐẠI DIỆN BÊN A | ĐẠI DIỆN BÊN B |
|:---:|:---:|
| *(Ký, đóng dấu)* | *(Ký, đóng dấu)* |`;

const DEFAULT_HOUSEHOLD_TEMPLATE = `# CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
## Độc lập - Tự do - Hạnh phúc
---
# HỢP ĐỒNG DỊCH VỤ TRUYỀN THÔNG HỘ KINH DOANH
**Số: {{ contract_number }}/HĐDV-{{ year }}**

Hôm nay, ngày {{ contract_date }}, chúng tôi gồm có:

## BÊN A (Bên Thuê Dịch Vụ)
- **Tên đơn vị:** {{ brand_company_name }}
- **Địa chỉ:** {{ brand_address }}
- **Mã số thuế:** {{ brand_tax_id }}
- **Đại diện:** {{ brand_representative }} — Chức vụ: {{ brand_position }}

## BÊN B (Bên Cung Cấp Dịch Vụ — Hộ Kinh Doanh)
- **Tên Hộ Kinh Doanh:** {{ kol_company_name }}
- **Số ĐKHKD:** {{ kol_business_reg_no }}
- **Địa chỉ kinh doanh:** {{ kol_business_address }}
- **Chủ hộ kinh doanh:** {{ kol_business_owner }}
- **Số điện thoại:** {{ kol_phone }}
- **Tên tài khoản ngân hàng:** {{ kol_bank_account_name }}
- **Số tài khoản:** {{ kol_bank_account_no }}
- **Tại ngân hàng:** {{ kol_bank_name }}

## ĐIỀU 1: PHẠM VI DỊCH VỤ VÀ YÊU CẦU NỘI DUNG (SOW)
Bên B đồng ý thực hiện sản xuất và đăng tải nội dung quảng cáo cho chiến dịch [{{ campaign_name }}] của Bên A theo các hạng mục cụ thể dưới đây:

{{ sow_table }}

## ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
- **Tổng chi phí hợp đồng:** {{ total_cost }} đ.
- **Tiến độ thanh toán:** {{ payment_term }}

## ĐIỀU 3: TIẾN ĐỘ THỰC HIỆN
- **Hạn nộp bản thảo duyệt (Content deadline):** {{ content_deadline }}

## ĐIỀU 4: ĐIỀU KHOẢN CHUNG
Hợp đồng có hiệu lực kể từ ngày ký. Được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.

---
| ĐẠI DIỆN BÊN A | ĐẠI DIỆN BÊN B |
|:---:|:---:|
| *(Ký, ghi rõ họ tên)* | *(Ký, ghi rõ họ tên)* |`;

export default function ContractGenerator({
  campaign,
  profile,
  crmProfile,
  onUpdateCRMProfile,
  onClose,
  theme
}: ContractGeneratorProps) {
  const isDark = theme === 'dark';

  // 1. Wizard Steps: 
  // Step 1: Nhập & Trích xuất thông tin (KOL Info Collection Form)
  // Step 2: Lựa chọn / Chỉnh sửa mẫu template
  // Step 3: Xem trước hợp đồng & chỉnh sửa thủ công
  // Step 4: Tải file xuất & Hoàn thành
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Raw copy-paste information text state
  const [rawText, setRawText] = useState(crmProfile.contractInfo?.rawText || '');
  const [isParsedSuccessfully, setIsParsedSuccessfully] = useState(!!crmProfile.contractInfo);
  const [parsedConfidence, setParsedConfidence] = useState(85);

  // Contract Information details (parsed or manual input)
  const [contractInfo, setContractInfo] = useState<KOLContractInfo>(() => {
    return crmProfile.contractInfo || {
      entityType: 'individual',
      fullName: crmProfile.nickname || '',
      phone: crmProfile.phone || '',
      email: crmProfile.email || '',
      bankAccountName: '',
      bankAccountNo: '',
      bankName: ''
    };
  });

  // Persistent templates state loaded from localStorage or defaults
  const [templates, setTemplates] = useState<Record<'individual' | 'company' | 'business_household', string>>(() => {
    try {
      const saved = localStorage.getItem('scout_hub_contract_templates');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return {
      individual: DEFAULT_INDIVIDUAL_TEMPLATE,
      company: DEFAULT_COMPANY_TEMPLATE,
      business_household: DEFAULT_HOUSEHOLD_TEMPLATE
    };
  });

  // General billing contract fields
  const [generalFields, setGeneralFields] = useState({
    contract_number: `SH-${Math.floor(1000 + Math.random() * 9000)}`,
    brand_representative: 'Nguyễn Văn A',
    brand_position: 'Giám đốc Marketing',
    brand_address: '123 Đường Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh',
    brand_tax_id: '0314567890'
  });

  const [compiledContract, setCompiledContract] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedGoogle, setCopiedGoogle] = useState(false);

  // Auto-detect & compile contract text
  useEffect(() => {
    const selectedTemplate = templates[contractInfo.entityType];
    const filled = fillContractTemplate(
      selectedTemplate,
      contractInfo,
      profile.confirmedSOW || [],
      profile.totalCost || 0,
      profile.paymentTerm || 'COD',
      profile.contentDeadline || '',
      campaign.name,
      campaign.brand.toUpperCase(),
      generalFields.contract_number
    );
    setCompiledContract(filled);
  }, [templates, contractInfo, profile, campaign, generalFields]);

  // Form input handlers
  const handleInfoChange = (field: keyof KOLContractInfo, value: string) => {
    setContractInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGeneralChange = (field: keyof typeof generalFields, value: string) => {
    setGeneralFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Trích xuất thông tin bằng parser regex của chúng ta
  const handleParseText = () => {
    if (!rawText.trim()) return;
    
    const parsed = parseKOLInfoText(rawText);
    const entity = detectEntityType(parsed, rawText);
    
    const mergedInfo: KOLContractInfo = {
      entityType: entity,
      // Merge parsed fields, fallback to existing crm details if not found
      fullName: parsed.fullName || contractInfo.fullName || crmProfile.nickname || '',
      idNumber: parsed.idNumber || contractInfo.idNumber || '',
      idIssueDate: parsed.idIssueDate || contractInfo.idIssueDate || '',
      idIssuePlace: parsed.idIssuePlace || contractInfo.idIssuePlace || '',
      permanentAddress: parsed.permanentAddress || contractInfo.permanentAddress || '',
      contactAddress: parsed.contactAddress || contractInfo.contactAddress || '',
      personalTaxId: parsed.personalTaxId || contractInfo.personalTaxId || '',
      cccdLink: parsed.cccdLink || contractInfo.cccdLink || '',
      
      companyName: parsed.companyName || contractInfo.companyName || '',
      companyTaxId: parsed.companyTaxId || contractInfo.companyTaxId || '',
      companyAddress: parsed.companyAddress || contractInfo.companyAddress || '',
      legalRepresentative: parsed.legalRepresentative || contractInfo.legalRepresentative || '',
      authorization: parsed.authorization || contractInfo.authorization || '',
      position: parsed.position || contractInfo.position || '',
      
      businessRegNo: parsed.businessRegNo || contractInfo.businessRegNo || '',
      businessOwner: parsed.businessOwner || contractInfo.businessOwner || '',
      businessAddress: parsed.businessAddress || contractInfo.businessAddress || '',
      
      bankAccountName: parsed.bankAccountName || contractInfo.bankAccountName || '',
      bankAccountNo: parsed.bankAccountNo || contractInfo.bankAccountNo || '',
      bankName: parsed.bankName || contractInfo.bankName || '',
      
      phone: parsed.phone || contractInfo.phone || crmProfile.phone || '',
      email: parsed.email || contractInfo.email || crmProfile.email || '',
      rawText: rawText
    };

    setContractInfo(mergedInfo);
    setIsParsedSuccessfully(true);
    setParsedConfidence(mergedInfo.fullName && mergedInfo.bankAccountNo ? 98 : 70);
  };

  // Lưu trữ dữ liệu pháp lý vào CRM
  const handleSaveToCRM = () => {
    if (onUpdateCRMProfile) {
      onUpdateCRMProfile(crmProfile.id, 'contractInfo', {
        ...contractInfo,
        collectedAt: new Date().toISOString(),
        rawText: rawText
      });
    }
    alert('Đã lưu thông tin pháp lý của KOL vào hồ sơ Scout CRM thành công!');
  };

  // Tải mẫu hợp đồng
  const handleSaveCustomTemplate = (type: KOLContractInfo['entityType'], markdown: string) => {
    const updated = {
      ...templates,
      [type]: markdown
    };
    setTemplates(updated);
    localStorage.setItem('scout_hub_contract_templates', JSON.stringify(updated));
  };

  // Download contract as rich Word Document (.doc XML wrapper)
  const handleDownloadWord = () => {
    const htmlBody = markdownToWordHtml(compiledContract);
    const filename = `HopDong_KOL_${crmProfile.channelId || 'Partner'}_${campaign.brand}_${generalFields.contract_number}.doc`;
    
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><title>Hợp đồng truyền thông</title>
    <!--[if gte mso 9]><xml>
    <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
    </xml><![endif]-->
    <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.4; color: #000; margin: 1in; }
    p, li { margin: 0; margin-bottom: 6.0pt; text-align: justify; }
    h1 { text-align: center; text-transform: uppercase; font-size: 14pt; font-weight: bold; margin-top: 12.0pt; margin-bottom: 6.0pt; color: #000; }
    h2 { font-size: 12pt; font-weight: bold; margin-top: 10.0pt; margin-bottom: 4.0pt; text-transform: uppercase; color: #000; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 6.0pt; margin-bottom: 2.0pt; color: #000; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 10px; }
    th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt; }
    th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
    hr { border: none; border-top: 1px double #000; height: 3px; margin: 15px 0; }
    </style></head>
    <body>`;
    const footer = "</body></html>";
    const sourceHTML = header + htmlBody + footer;
    
    const blob = new Blob(['\ufeff' + sourceHTML], {
      type: 'application/msword;charset=utf-8'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(compiledContract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy as rich HTML for Google Docs (paste as rich formatted document)
  const handleCopyGoogleDocs = () => {
    const htmlBody = markdownToWordHtml(compiledContract);
    const blobHtml = new Blob([htmlBody], { type: 'text/html' });
    const blobText = new Blob([compiledContract], { type: 'text/plain' });
    
    const data = [new ClipboardItem({
      'text/html': blobHtml,
      'text/plain': blobText
    })];
    
    navigator.clipboard.write(data).then(() => {
      setCopiedGoogle(true);
      setTimeout(() => setCopiedGoogle(false), 2000);
    });
  };

  const unfilledPlaceholders = getUnfilledPlaceholders(compiledContract);

  // Styling Classes
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const inputBg = isDark 
    ? 'bg-white/[0.03] border-white/[0.06] text-white focus:bg-white/[0.05] focus:border-violet-500/80' 
    : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500/80';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const panelBg = isDark ? 'bg-[#0d0d12]' : 'bg-slate-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className={`w-full max-w-6xl h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${
        isDark ? 'bg-[#0f0f15] border-white/[0.08]' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center border-slate-500/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl text-white shadow-md shadow-violet-500/25">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-base font-extrabold ${textPrimary} tracking-tight`}>AI Contract Automation pipeline</h3>
              <p className={`text-xs ${textSecondary} mt-0.5`}>
                Thu thập thông tin ➔ Chọn HĐ mẫu ➔ Biên dịch Live Preview ➔ Xuất file Word (.docx) chuyên nghiệp.
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

        {/* 4-Step Progress Indicator Wizard Bar */}
        <div className="px-6 py-3 bg-violet-500/[0.03] border-b flex justify-between items-center text-xs font-bold border-slate-500/10 flex-shrink-0">
          {[
            { id: 1, label: '1. Thu thập & Smart Parse' },
            { id: 2, label: '2. Cài đặt HĐ Mẫu (.md)' },
            { id: 3, label: '3. Biên dịch Live Preview' },
            { id: 4, label: '4. Xuất File & Hoàn thành' }
          ].map(s => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div 
                key={s.id} 
                className={`flex items-center gap-2 transition-all pb-1.5 border-b-2 ${
                  isActive 
                    ? 'border-violet-500 text-violet-500 font-extrabold' 
                    : isCompleted 
                    ? 'border-emerald-500 text-emerald-500' 
                    : 'border-transparent text-slate-500'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isActive 
                    ? 'bg-violet-500 text-white' 
                    : isCompleted 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {isCompleted ? '✓' : s.id}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Wizard Main Content Panels */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 select-text">
          
          {/* STEP 1: PARSE AND COLLECT INFO */}
          {step === 1 && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
              {/* Left Side: Paste Text box */}
              <div className="w-full md:w-1/2 p-5 overflow-y-auto space-y-4 border-r border-slate-500/10 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1">
                    <ClipboardList className="h-4 w-4" />
                    <span>Dán thông tin thô của KOL</span>
                  </span>
                  
                  {isParsedSuccessfully && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Parsed (Độ tin cậy: {parsedConfidence}%)</span>
                    </span>
                  )}
                </div>

                <p className={`text-[11px] ${textSecondary} leading-relaxed`}>
                  Dán nội dung sao chép từ Zalo, Email hoặc Google Form. Hệ thống sử dụng quy tắc ngôn ngữ học để tự động tách các trường pháp lý (Tên, CCCD, Nơi cấp, MST, Bank...).
                </p>

                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Ví dụ:&#10;THÔNG TIN HỢP ĐỒNG CÁ NHÂN&#10;Tên: NGUYỄN THỊ B&#10;Số CCCD: 012345678901&#10;Ngày cấp: 12/04/2021&#10;Nơi cấp: Cục trưởng Cục CSQLHC về TTXH&#10;Địa chỉ thường trú: 456 Lê Lợi, Quận 1, TPHCM&#10;Tên tài khoản: NGUYEN THI B&#10;Số tài khoản: 190288889999&#10;Tại: Techcombank chi nhánh Gia Định"
                  className={`flex-1 w-full p-4 text-xs font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none ${inputBg}`}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleParseText}
                    disabled={!rawText.trim()}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/15"
                  >
                    <Sparkles className="h-4.5 w-4.5" />
                    <span>🤖 Tự động Trích xuất (Smart Parse)</span>
                  </button>
                  {isParsedSuccessfully && (
                    <button
                      onClick={handleSaveToCRM}
                      className="px-4 py-3 rounded-xl bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/15 text-violet-400 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                      title="Lưu thông tin vừa trích xuất vào CRM hồ sơ của KOL để tái sử dụng sau này"
                    >
                      Lưu CRM
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side: Parse review form editor */}
              <div className="w-full md:w-1/2 p-5 overflow-y-auto space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block pb-2 border-b border-slate-500/5">
                  🔍 Kết quả Review & Hiệu chỉnh thông tin pháp lý
                </span>

                {/* Entity Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Hình thức pháp nhân ký hợp đồng</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'individual' as const, label: '👤 Cá nhân' },
                      { id: 'company' as const, label: '🏢 Công ty' },
                      { id: 'business_household' as const, label: '🏪 Hộ kinh doanh' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleInfoChange('entityType', type.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          contractInfo.entityType === type.id 
                            ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-600/15'
                            : `${isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-500/10 pt-3 space-y-4">
                  {/* Cá nhân Fields */}
                  {contractInfo.entityType === 'individual' && (
                    <div className="space-y-3">
                      <p className={`text-[10px] font-bold text-sky-500 uppercase tracking-wider`}>Thông tin cá nhân (CCCD)</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Họ và tên Bên B</label>
                          <input
                            type="text"
                            value={contractInfo.fullName || ''}
                            onChange={e => handleInfoChange('fullName', e.target.value)}
                            placeholder="Chưa nhận dạng..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.fullName ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Số CCCD (12 số)</label>
                          <input
                            type="text"
                            value={contractInfo.idNumber || ''}
                            onChange={e => handleInfoChange('idNumber', e.target.value)}
                            placeholder="Chưa nhận dạng..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.idNumber ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Ngày cấp CCCD</label>
                          <input
                            type="text"
                            value={contractInfo.idIssueDate || ''}
                            onChange={e => handleInfoChange('idIssueDate', e.target.value)}
                            placeholder="Chưa nhận dạng..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Nơi cấp CCCD</label>
                          <input
                            type="text"
                            value={contractInfo.idIssuePlace || ''}
                            onChange={e => handleInfoChange('idIssuePlace', e.target.value)}
                            placeholder="Chưa nhận dạng..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Mã số thuế cá nhân</label>
                          <input
                            type="text"
                            value={contractInfo.personalTaxId || ''}
                            onChange={e => handleInfoChange('personalTaxId', e.target.value)}
                            placeholder="Trùng số CCCD hoặc khác..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Link CCCD</label>
                          <input
                            type="text"
                            value={contractInfo.cccdLink || ''}
                            onChange={e => handleInfoChange('cccdLink', e.target.value)}
                            placeholder="Dán link ảnh CCCD chụp..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Địa chỉ thường trú</label>
                        <input
                          type="text"
                          value={contractInfo.permanentAddress || ''}
                          onChange={e => handleInfoChange('permanentAddress', e.target.value)}
                          placeholder="Địa chỉ hộ khẩu..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Địa chỉ liên hệ</label>
                        <input
                          type="text"
                          value={contractInfo.contactAddress || ''}
                          onChange={e => handleInfoChange('contactAddress', e.target.value)}
                          placeholder="Địa chỉ gửi thư từ / tạm trú..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Công ty Fields */}
                  {contractInfo.entityType === 'company' && (
                    <div className="space-y-3">
                      <p className={`text-[10px] font-bold text-indigo-500 uppercase tracking-wider`}>Thông tin doanh nghiệp (Company)</p>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Tên Công ty Bên B</label>
                        <input
                          type="text"
                          value={contractInfo.companyName || ''}
                          onChange={e => handleInfoChange('companyName', e.target.value)}
                          placeholder="Ví dụ: CÔNG TY TNHH MULTI-CHANNEL..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.companyName ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Mã số thuế doanh nghiệp</label>
                          <input
                            type="text"
                            value={contractInfo.companyTaxId || ''}
                            onChange={e => handleInfoChange('companyTaxId', e.target.value)}
                            placeholder="Mã số thuế 10 số..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.companyTaxId ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Người đại diện pháp luật</label>
                          <input
                            type="text"
                            value={contractInfo.legalRepresentative || ''}
                            onChange={e => handleInfoChange('legalRepresentative', e.target.value)}
                            placeholder="Họ và tên..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Chức vụ đại diện</label>
                          <input
                            type="text"
                            value={contractInfo.position || 'Giám đốc'}
                            onChange={e => handleInfoChange('position', e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Giấy ủy quyền (nếu đại diện ký thay)</label>
                          <input
                            type="text"
                            value={contractInfo.authorization || ''}
                            onChange={e => handleInfoChange('authorization', e.target.value)}
                            placeholder="Giấy ủy quyền số..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Địa chỉ trụ sở công ty</label>
                        <input
                          type="text"
                          value={contractInfo.companyAddress || ''}
                          onChange={e => handleInfoChange('companyAddress', e.target.value)}
                          placeholder="Địa chỉ trụ sở chính đăng ký..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Hộ kinh doanh Fields */}
                  {contractInfo.entityType === 'business_household' && (
                    <div className="space-y-3">
                      <p className={`text-[10px] font-bold text-amber-500 uppercase tracking-wider`}>Thông tin Hộ kinh doanh (Business Household)</p>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Tên Hộ Kinh Doanh</label>
                        <input
                          type="text"
                          value={contractInfo.companyName || ''}
                          onChange={e => handleInfoChange('companyName', e.target.value)}
                          placeholder="Ví dụ: Hộ Kinh Doanh Nguyễn Văn A..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.companyName ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Số Giấy Đăng Ký Hộ Kinh Doanh</label>
                          <input
                            type="text"
                            value={contractInfo.businessRegNo || ''}
                            onChange={e => handleInfoChange('businessRegNo', e.target.value)}
                            placeholder="Số GPKD hộ cá thể..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.businessRegNo ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500">Chủ hộ kinh doanh</label>
                          <input
                            type="text"
                            value={contractInfo.businessOwner || ''}
                            onChange={e => handleInfoChange('businessOwner', e.target.value)}
                            placeholder="Tên chủ hộ..."
                            className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Địa chỉ kinh doanh</label>
                        <input
                          type="text"
                          value={contractInfo.businessAddress || ''}
                          onChange={e => handleInfoChange('businessAddress', e.target.value)}
                          placeholder="Địa điểm hoạt động hộ..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Banking Info (Shared) */}
                  <div className="space-y-3 pt-3 border-t border-slate-500/5">
                    <p className={`text-[10px] font-bold text-violet-500 uppercase tracking-wider`}>Thông tin thanh toán ngân hàng</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Tên tài khoản (VIẾT HOA KHÔNG DẤU)</label>
                        <input
                          type="text"
                          value={contractInfo.bankAccountName || ''}
                          onChange={e => handleInfoChange('bankAccountName', e.target.value.toUpperCase())}
                          placeholder="Ví dụ: NGUYEN VAN A"
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.bankAccountName ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Số tài khoản ngân hàng</label>
                        <input
                          type="text"
                          value={contractInfo.bankAccountNo || ''}
                          onChange={e => handleInfoChange('bankAccountNo', e.target.value)}
                          placeholder="Ví dụ: 19034567..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.bankAccountNo ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Mở tại Ngân hàng</label>
                        <input
                          type="text"
                          value={contractInfo.bankName || ''}
                          onChange={e => handleInfoChange('bankName', e.target.value)}
                          placeholder="Ví dụ: Vietcombank CN TPHCM"
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg} ${!contractInfo.bankName ? 'border-amber-500/40 bg-amber-500/[0.02]' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Số điện thoại liên hệ</label>
                        <input
                          type="text"
                          value={contractInfo.phone || ''}
                          onChange={e => handleInfoChange('phone', e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TEMPLATE SETTING (.md format) */}
          {step === 2 && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
              {/* Left Side: Select template guidelines */}
              <div className="w-full md:w-1/3 p-5 overflow-y-auto space-y-4 border-r border-slate-500/10 flex flex-col h-full bg-[#030305]/15">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1.5">
                  <FileCode className="h-4.5 w-4.5" />
                  <span>Cấu hình mẫu Hợp đồng (.md)</span>
                </span>
                
                <p className={`text-[11px] ${textSecondary} leading-relaxed`}>
                  ScoutHub lưu trữ hợp đồng mẫu bằng định dạng Markdown (.md) có chứa các thẻ thay thế. Bạn có thể chép mẫu hợp đồng pháp chế của team mình vào đây để hệ thống tự động điền.
                </p>

                <div className={`p-4 rounded-xl border leading-relaxed space-y-2 text-[10px] ${
                  isDark ? 'bg-amber-500/5 border-amber-500/10 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <p className="font-bold">⚠️ Các biến được hệ thống hỗ trợ:</p>
                  <ul className="list-disc pl-4 space-y-1 font-mono text-[9px] text-slate-400">
                    <li><code className="text-amber-500">{`{{ contract_number }}`}</code>: Số hợp đồng</li>
                    <li><code className="text-amber-500">{`{{ kol_full_name }}`}</code>: Tên KOL cá nhân</li>
                    <li><code className="text-amber-500">{`{{ kol_company_name }}`}</code>: Tên cty / Hộ kinh doanh</li>
                    <li><code className="text-amber-500">{`{{ kol_id_number }}`}</code>: Số CCCD</li>
                    <li><code className="text-amber-500">{`{{ kol_bank_account_no }}`}</code>: Số TK ngân hàng</li>
                    <li><code className="text-amber-500">{`{{ sow_table }}`}</code>: Bảng SOW chi tiết</li>
                    <li><code className="text-amber-500">{`{{ total_cost }}`}</code>: Chi phí chốt</li>
                    <li><code className="text-amber-500">{`{{ tax_amount }}`}</code>: Thuế TNCN (10%)</li>
                    <li><code className="text-amber-500">{`{{ net_cost }}`}</code>: Thực nhận (90%)</li>
                  </ul>
                </div>
              </div>

              {/* Right Side: Markdown editor for selected entity type template */}
              <div className="w-full md:w-2/3 p-5 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-500/5 flex-shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Mẫu Hợp đồng {contractInfo.entityType === 'individual' ? 'Cá nhân' : contractInfo.entityType === 'company' ? 'Công ty' : 'Hộ kinh doanh'} đang dùng
                  </span>
                  
                  <button
                    onClick={() => {
                      if (confirm('Bạn muốn khôi phục template mẫu mặc định của ScoutHub cho loại pháp nhân này?')) {
                        const defaults = {
                          individual: DEFAULT_INDIVIDUAL_TEMPLATE,
                          company: DEFAULT_COMPANY_TEMPLATE,
                          business_household: DEFAULT_HOUSEHOLD_TEMPLATE
                        };
                        handleSaveCustomTemplate(contractInfo.entityType, defaults[contractInfo.entityType]);
                      }
                    }}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Reset về mặc định</span>
                  </button>
                </div>

                <textarea
                  value={templates[contractInfo.entityType]}
                  onChange={e => handleSaveCustomTemplate(contractInfo.entityType, e.target.value)}
                  className={`flex-1 w-full p-4 font-mono text-[10px] leading-relaxed rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${inputBg}`}
                />
              </div>
            </div>
          )}

          {/* STEP 3: AUTO-FILL & LIVE PREVIEW */}
          {step === 3 && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
              {/* Left Column: Placeholders Form */}
              <div className="w-full md:w-1/3 p-5 overflow-y-auto space-y-4 border-r border-slate-500/10 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1.5">
                  <ClipboardList className="h-4.5 w-4.5" />
                  <span>Hiệu chỉnh nhanh hợp đồng</span>
                </span>

                <div className="space-y-4">
                  {/* General settings */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Thông số Bên A & Chung</p>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500">Đại diện ký hợp đồng (Bên A)</label>
                      <input
                        type="text"
                        value={generalFields.brand_representative}
                        onChange={e => handleGeneralChange('brand_representative', e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Mã số hợp đồng</label>
                        <input
                          type="text"
                          value={generalFields.contract_number}
                          onChange={e => handleGeneralChange('contract_number', e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Chức vụ Bên A</label>
                        <input
                          type="text"
                          value={generalFields.brand_position}
                          onChange={e => handleGeneralChange('brand_position', e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* General settings B */}
                  <div className="space-y-3 pt-3 border-t border-slate-500/5">
                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Thông số Bên B (KOL)</p>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500">Họ tên chính thức / Pháp nhân B</label>
                      <input
                        type="text"
                        value={contractInfo.fullName || contractInfo.companyName || ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (contractInfo.entityType === 'individual') {
                            handleInfoChange('fullName', val);
                          } else {
                            handleInfoChange('companyName', val);
                          }
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Số tài khoản B</label>
                        <input
                          type="text"
                          value={contractInfo.bankAccountNo || ''}
                          onChange={e => handleInfoChange('bankAccountNo', e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500">Tại Ngân hàng</label>
                        <input
                          type="text"
                          value={contractInfo.bankName || ''}
                          onChange={e => handleInfoChange('bankName', e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation list */}
                {unfilledPlaceholders.length > 0 ? (
                  <div className={`p-4 rounded-xl border space-y-2 mt-4 text-[10px] ${
                    isDark ? 'bg-rose-500/5 border-rose-500/10 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
                      <span>Phát hiện biến chưa điền ({unfilledPlaceholders.length})</span>
                    </div>
                    <p className="leading-relaxed text-[9px] text-slate-400">
                      Các thẻ biến sau chưa có dữ liệu và sẽ để khoảng trống. Quay lại Bước 1 hoặc chỉnh sửa template:
                    </p>
                    <div className="flex flex-wrap gap-1 font-mono text-[8px] max-h-20 overflow-y-auto pr-1">
                      {unfilledPlaceholders.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border flex gap-2.5 items-center mt-4 bg-emerald-500/5 border-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                    <span>Dữ liệu hợp đồng đã đầy đủ!</span>
                  </div>
                )}
              </div>

              {/* Right Column: Markdown rendered Live preview */}
              <div className="w-full md:w-2/3 flex flex-col h-full bg-[#030305]/40 overflow-hidden relative">
                <div className={`flex justify-between items-center px-4 py-2 border-b ${borderColor} flex-shrink-0 bg-black/15`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Live Preview (Bản hợp đồng hoàn chỉnh)</span>
                  </span>
                </div>

                {/* Rendered HTML/Markdown Body */}
                <div 
                  className={`flex-1 p-6 overflow-y-auto min-h-0 font-mono text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap select-text markdown-preview`}
                  dangerouslySetInnerHTML={{ __html: markdownToWordHtml(compiledContract) }}
                />
              </div>
            </div>
          )}

          {/* STEP 4: EXPORT DOWNLOAD */}
          {step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 animate-bounce-slow">
                <FileCheck className="h-9 w-9" />
              </div>

              <div className="space-y-2">
                <h3 className={`text-xl font-extrabold ${textPrimary}`}>Biên dịch Hợp đồng thành công!</h3>
                <p className={`text-sm ${textSecondary} max-w-md mx-auto`}>
                  Hợp đồng dịch vụ truyền thông của KOL <b>@{crmProfile.channelId}</b> cho chiến dịch <b>{campaign.name}</b> đã sẵn sàng để xuất file.
                </p>
              </div>

              {/* Download actions list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-4">
                {/* A. Rich formatted .doc for MS Word */}
                <button
                  onClick={handleDownloadWord}
                  className="flex flex-col items-center p-5 rounded-2xl border hover:border-violet-500/40 hover:bg-violet-600/5 transition-all text-center space-y-2 cursor-pointer border-slate-500/10 active:scale-95 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Download className="h-5 w-5" />
                  </div>
                  <span className={`text-xs font-bold ${textPrimary}`}>Tải Word (.doc)</span>
                  <span className="text-[9px] text-slate-500">Hỗ trợ Microsoft Word & Google Docs định dạng đẹp</span>
                </button>

                {/* B. Copy rich formatted for Google Docs */}
                <button
                  onClick={handleCopyGoogleDocs}
                  className="flex flex-col items-center p-5 rounded-2xl border hover:border-violet-500/40 hover:bg-violet-600/5 transition-all text-center space-y-2 cursor-pointer border-slate-500/10 active:scale-95 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {copiedGoogle ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-bold ${copiedGoogle ? 'text-emerald-400' : textPrimary}`}>Copy sang Google Docs</span>
                  <span className="text-[9px] text-slate-500">Giữ nguyên định dạng, bảng biểu, bold để dán trực tiếp</span>
                </button>

                {/* C. Copy plain markdown */}
                <button
                  onClick={handleCopyText}
                  className="flex flex-col items-center p-5 rounded-2xl border hover:border-violet-500/40 hover:bg-violet-600/5 transition-all text-center space-y-2 cursor-pointer border-slate-500/10 active:scale-95 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <ClipboardList className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-bold ${copied ? 'text-emerald-400' : textPrimary}`}>Copy Plain Text</span>
                  <span className="text-[9px] text-slate-500">Sao chép văn bản thuần không chứa định dạng để chat</span>
                </button>
              </div>

              {/* Validation alert if unfilled */}
              {unfilledPlaceholders.length > 0 && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] text-left leading-relaxed flex gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span><b>Chú ý:</b> Hợp đồng này vẫn còn {unfilledPlaceholders.length} biến chưa điền và sẽ hiển thị dạng trống trong file tải về. Bạn có thể quay lại bước 3 để điền bổ sung.</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Wizard Footer Controls */}
        <div className={`p-4 border-t ${borderColor} flex items-center justify-between flex-shrink-0 bg-black/25`}>
          <button
            onClick={() => setStep(prev => (prev - 1) as any)}
            disabled={step === 1}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
              isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>
          
          <div className="flex gap-2">
            {step === 1 && isParsedSuccessfully && (
              <button
                onClick={handleSaveToCRM}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-violet-500/20 bg-violet-600/5 hover:bg-violet-600/10 text-violet-400 transition-all cursor-pointer active:scale-95"
              >
                💾 Lưu CRM
              </button>
            )}

            <button
              onClick={() => {
                if (step < 4) {
                  setStep(prev => (prev + 1) as any);
                } else {
                  onClose();
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold shadow-lg shadow-violet-600/15 transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.97]"
            >
              <span>{step === 4 ? 'Hoàn tất & Đóng' : 'Tiếp tục'}</span>
              {step < 4 && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
