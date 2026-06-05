import { KOLContractInfo, SOWItem } from '../types';

/**
 * Smart hybrid rule-based parser to extract legal entity info for contracts
 * from raw copy-pasted text.
 */
export function parseKOLInfoText(rawText: string): Partial<KOLContractInfo> {
  const info: Partial<KOLContractInfo> = {};
  
  if (!rawText || !rawText.trim()) return info;

  // Cleanup helper
  const clean = (val?: string): string | undefined => {
    if (!val) return undefined;
    // Remove leading/trailing colons, spaces, brackets, or template indicators
    let result = val.replace(/^[\s:\-–—\(\)\[\]]+|[\s:\-–—\(\)\[\]]+$/g, '').trim();
    if (/^\(vui lòng|\(lưu ý|vui lòng chụp|lưu ý cập nhật/i.test(result)) {
      // User left the template instruction in
      return undefined;
    }
    return result || undefined;
  };

  // Define regex list for each field
  const PATTERNS: Record<keyof Omit<KOLContractInfo, 'entityType' | 'collectedAt' | 'rawText'>, RegExp[]> = {
    fullName: [
      /Tên\s*:\s*(.+)/i,
      /Họ\s*(và|&)?\s*tên\s*:\s*(.+)/i,
      /Họ\s*tên\s*:\s*(.+)/i,
      /Full\s*name\s*:\s*(.+)/i
    ],
    idNumber: [
      /Số\s*CCCD\s*:\s*([0-9Xx\s]+)/i,
      /CMND\s*\/?\s*CCCD\s*:\s*([0-9Xx\s]+)/i,
      /CCCD\s*:\s*([0-9Xx\s]+)/i,
      /CMT\s*:\s*([0-9Xx\s]+)/i,
      /Số\s*hộ\s*chiếu\s*:\s*(.+)/i
    ],
    idIssueDate: [
      /Ngày\s*cấp\s*:\s*(.+)/i,
      /Ngày\s*cấp\s*CCCD\s*:\s*(.+)/i,
      /Issue\s*date\s*:\s*(.+)/i
    ],
    idIssuePlace: [
      /Nơi\s*cấp\s*:\s*(.+)/i,
      /Nơi\s*cấp\s*CCCD\s*:\s*(.+)/i,
      /Issue\s*place\s*:\s*(.+)/i
    ],
    permanentAddress: [
      /Địa\s*chỉ\s*thường\s*trú\s*:\s*(.+)/i,
      /ĐC\s*thường\s*trú\s*:\s*(.+)/i,
      /Thường\s*trú\s*:\s*(.+)/i
    ],
    contactAddress: [
      /Địa\s*chỉ\s*liên\s*hệ\s*:\s*(.+)/i,
      /ĐC\s*liên\s*hệ\s*:\s*(.+)/i,
      /Địa\s*chỉ\s*hiện\s*tại\s*:\s*(.+)/i,
      /Địa\s*chỉ\s*nhận\s*thư\s*:\s*(.+)/i
    ],
    personalTaxId: [
      /MST\s*cá\s*nhân\s*:\s*([0-9a-zA-Z\s]+)/i,
      /Mã\s*số\s*thuế\s*cá\s*nhân\s*:\s*([0-9a-zA-Z\s]+)/i
    ],
    cccdLink: [
      /Link\s*CCCD\s*:\s*(.+)/i,
      /Link\s*ảnh\s*CCCD\s*:\s*(.+)/i,
      /CCCD\s*link\s*:\s*(.+)/i
    ],
    // Company specific
    companyName: [
      /Tên\s*Công\s*ty\s*:\s*(.+)/i,
      /Tên\s*doanh\s*nghiệp\s*:\s*(.+)/i,
      /Công\s*ty\s*:\s*(.+)/i
    ],
    companyTaxId: [
      /Mã\s*số\s*thuế\s*(doanh nghiệp|công ty)?\s*:\s*([0-9a-zA-Z\s]+)/i,
      /MST\s*(doanh nghiệp|công ty)?\s*:\s*([0-9a-zA-Z\s]+)/i
    ],
    companyAddress: [
      /Địa\s*chỉ\s*trụ\s*sở\s*:\s*(.+)/i,
      /Trụ\s*sở\s*chính\s*:\s*(.+)/i,
      /Địa\s*chỉ\s*công\s*ty\s*:\s*(.+)/i
    ],
    legalRepresentative: [
      /Đại\s*diện\s*theo\s*pháp\s*luật\s*:\s*(.+)/i,
      /Người\s*đại\s*diện\s*theo\s*PL\s*:\s*(.+)/i,
      /Người\s*đại\s*diện\s*:\s*(.+)/i
    ],
    authorization: [
      /Theo\s*Giấy\s*ủy\s*quyền\s*:\s*(.+)/i,
      /Giấy\s*ủy\s*quyền\s*:\s*(.+)/i
    ],
    position: [
      /Chức\s*vụ\s*:\s*(.+)/i,
      /Vai\s*trò\s*:\s*(.+)/i
    ],
    // Business Household
    businessRegNo: [
      /Số\s*ĐKHKD\s*:\s*(.+)/i,
      /Số\s*đăng\s*ký\s*hộ\s*kinh\s*doanh\s*:\s*(.+)/i,
      /Giấy\s*phép\s*hộ\s*kinh\s*doanh\s*:\s*(.+)/i
    ],
    businessOwner: [
      /Chủ\s*hộ\s*:\s*(.+)/i,
      /Chủ\s*hộ\s*kinh\s*doanh\s*:\s*(.+)/i,
      /Đại\s*diện\s*hộ\s*:\s*(.+)/i
    ],
    businessAddress: [
      /Địa\s*chỉ\s*kinh\s*doanh\s*:\s*(.+)/i,
      /Địa\s*điểm\s*kinh\s*doanh\s*:\s*(.+)/i
    ],
    // Banking & Contact
    bankAccountName: [
      /Tên\s*tài\s*khoản\s*:\s*(.+)/i,
      /Chủ\s*tài\s*khoản\s*:\s*(.+)/i,
      /Tên\s*TK\s*:\s*(.+)/i
    ],
    bankAccountNo: [
      /Số\s*tài\s*khoản\s*(ngân\s*hàng)?\s*:\s*([0-9a-zA-Z\s]+)/i,
      /Số\s*TK\s*:\s*([0-9a-zA-Z\s]+)/i,
      /STK\s*:\s*([0-9a-zA-Z\s]+)/i
    ],
    bankName: [
      /Tại\s*:\s*(.+)/i,
      /Ngân\s*hàng\s*:\s*(.+)/i,
      /Tại\s*ngân\s*hàng\s*:\s*(.+)/i,
      /Chi\s*nhánh\s*:\s*(.+)/i
    ],
    phone: [
      /Điện\s*thoại\s*:\s*([0-9\+\s]+)/i,
      /SĐT\s*:\s*([0-9\+\s]+)/i,
      /Phone\s*:\s*([0-9\+\s]+)/i
    ],
    email: [
      /Email\s*:\s*([a-zA-Z0-9\._%\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,})/i,
      /Mail\s*:\s*([a-zA-Z0-9\._%\+\-]+@[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,})/i
    ]
  };

  // Run the regex parser for each defined field
  Object.keys(PATTERNS).forEach((fieldKey) => {
    const regexes = PATTERNS[fieldKey as keyof typeof PATTERNS];
    for (const regex of regexes) {
      const match = rawText.match(regex);
      if (match && match[1] || (match && match[2])) {
        const val = clean(match[2] || match[1]);
        if (val) {
          info[fieldKey as keyof typeof PATTERNS] = val as any;
          break; // Stop at first matched regex for this field
        }
      }
    }
  });

  return info;
}

/**
 * Automatically detects the contract entity type based on parsed fields or raw text.
 */
export function detectEntityType(parsed: Partial<KOLContractInfo>, rawText: string): 'individual' | 'company' | 'business_household' {
  const text = rawText.toLowerCase();
  
  // 1. Detect Company
  if (
    parsed.companyName || 
    parsed.companyTaxId || 
    parsed.legalRepresentative ||
    text.includes('thông tin hợp đồng công ty') ||
    text.includes('tên công ty') ||
    text.includes('mã số thuế công ty') ||
    text.includes('đại diện theo pháp luật')
  ) {
    return 'company';
  }

  // 2. Detect Business Household
  if (
    parsed.businessRegNo || 
    parsed.businessOwner ||
    text.includes('hộ kinh doanh') ||
    text.includes('số đkhkd') ||
    text.includes('chủ hộ')
  ) {
    return 'business_household';
  }

  // 3. Fallback to Individual
  return 'individual';
}

/**
 * Compiles a markdown template by substituting placeholders `{{field_name}}` with their actual values.
 */
export function fillContractTemplate(
  templateContent: string,
  crmInfo: Partial<KOLContractInfo>,
  sowItems: SOWItem[],
  totalCost: number,
  paymentTerm: string,
  contentDeadline: string,
  campaignName: string,
  brandName: string,
  contractNumber: string
): string {
  let result = templateContent;

  const year = new Date().getFullYear().toString();
  const dateStr = new Date().toLocaleDateString('vi-VN');

  // Derive tax & net for Individual
  const taxAmount = Math.round(totalCost * 0.1);
  const netCost = totalCost - taxAmount;

  // Generate SOW markdown table
  let sowTableStr = `| Hạng mục | Số lượng | Đơn giá | Thành tiền |\n|---|:---:|:---:|:---:|\n`;
  if (sowItems && sowItems.length > 0) {
    sowItems.forEach((item) => {
      sowTableStr += `| ${item.name} | ${item.quantity} | ${item.price.toLocaleString('vi-VN')} đ | ${(item.price * item.quantity).toLocaleString('vi-VN')} đ |\n`;
    });
    sowTableStr += `| **Tổng cộng** | | | **${totalCost.toLocaleString('vi-VN')} đ** |\n`;
  } else {
    sowTableStr += `| Dịch vụ truyền thông thương hiệu | 1 | ${totalCost.toLocaleString('vi-VN')} đ | ${totalCost.toLocaleString('vi-VN')} đ |\n`;
  }

  // Value mapping dictionary
  const mappings: Record<string, string> = {
    // Basic contract details
    'contract_number': contractNumber,
    'year': year,
    'contract_date': dateStr,
    'campaign_name': campaignName,
    'brand_company_name': brandName,
    'brand_address': '123 Đường Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh',
    'brand_tax_id': '0314567890',
    'brand_representative': 'Nguyễn Văn A',
    'brand_position': 'Giám đốc Marketing',

    // KOL General details
    'kol_phone': crmInfo.phone || '',
    'kol_email': crmInfo.email || '',
    'kol_bank_account_name': crmInfo.bankAccountName || '',
    'kol_bank_account_no': crmInfo.bankAccountNo || '',
    'kol_bank_name': crmInfo.bankName || '',

    // SOW & Pricing details
    'sow_table': sowTableStr,
    'total_cost': totalCost.toLocaleString('vi-VN'),
    'tax_amount': taxAmount.toLocaleString('vi-VN'),
    'net_cost': netCost.toLocaleString('vi-VN'),
    'payment_term': paymentTerm || 'Thanh toán COD',
    'content_deadline': contentDeadline ? new Date(contentDeadline).toLocaleDateString('vi-VN') : 'Theo lịch phối hợp',

    // Entity-specific: Cá nhân
    'kol_full_name': crmInfo.fullName || '',
    'kol_id_number': crmInfo.idNumber || '',
    'kol_id_issue_date': crmInfo.idIssueDate || '',
    'kol_id_issue_place': crmInfo.idIssuePlace || '',
    'kol_personal_tax_id': crmInfo.personalTaxId || '',
    'kol_permanent_address': crmInfo.permanentAddress || '',
    'kol_contact_address': crmInfo.contactAddress || '',

    // Entity-specific: Công ty
    'kol_company_name': crmInfo.companyName || '',
    'kol_company_tax_id': crmInfo.companyTaxId || '',
    'kol_company_address': crmInfo.companyAddress || '',
    'kol_legal_representative': crmInfo.legalRepresentative || '',
    'kol_authorization': crmInfo.authorization || 'N/A',
    'kol_position': crmInfo.position || 'Giám đốc',

    // Entity-specific: Hộ kinh doanh
    'kol_business_reg_no': crmInfo.businessRegNo || '',
    'kol_business_owner': crmInfo.businessOwner || '',
    'kol_business_address': crmInfo.businessAddress || ''
  };

  // Replace placeholders
  Object.entries(mappings).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Checks for any unfilled placeholders inside compiled contract.
 * Returns an array of field names that remain unfilled (e.g. {{kol_id_number}})
 */
export function getUnfilledPlaceholders(compiledContract: string): string[] {
  const matches = compiledContract.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.replace(/{{\s*|\s*}}/g, ''))));
}

/**
 * Helper to convert Markdown structure to rich Word HTML format
 * that Microsoft Word and Google Docs can open beautifully.
 */
export function markdownToWordHtml(markdown: string): string {
  // Simple conversion of basic markdown tags to structured HTML tags
  let html = markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$2</h2>')
    .replace(/^### (.*$)/gim, '<h3>$3</h3>')
    .replace(/^\*\*([^*]+)\*\*/gim, '<b>$1</b>')
    .replace(/^\*([^*]+)\*/gim, '<i>$1</i>')
    .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
    // Handle list nesting cleanup
    .replace(/<\/ul>\s*<ul>/gim, '')
    // Handle horizontal rules
    .replace(/^---$/gim, '<hr style="border: 1px solid #ccc;"/>')
    // Handle double newlines as paragraphs
    .split('\n\n')
    .map(para => {
      // If it already starts with a header or table tag, don't wrap in <p>
      if (para.trim().startsWith('<h') || para.trim().startsWith('<ul') || para.trim().startsWith('<table') || para.trim().startsWith('<hr')) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  // Convert SOW Markdown Table to styled HTML Table
  const tableRegex = /\|([^\n]+)\|\r?\n\|([-:| ]+)\|\r?\n((?:\|[^\n]+\|\r?\n?)*)/g;
  html = html.replace(tableRegex, (match, headerRow, separatorRow, bodyRows) => {
    const headers = headerRow.split('|').slice(1, -1).map((h: string) => h.trim());
    
    let htmlTable = `<table style="border-collapse: collapse; width: 100%; border: 1px solid #000; margin-top: 10px; margin-bottom: 10px;">\n`;
    
    // Header
    htmlTable += `  <thead>\n    <tr style="background-color: #f2f2f2; font-weight: bold;">\n`;
    headers.forEach((h: string) => {
      htmlTable += `      <th style="border: 1px solid #000; padding: 8px; text-align: left;">${h}</th>\n`;
    });
    htmlTable += `    </tr>\n  </thead>\n`;
    
    // Body
    htmlTable += `  <tbody>\n`;
    const rows = bodyRows.trim().split('\n');
    rows.forEach((row: string) => {
      if (!row.trim()) return;
      const cells = row.split('|').slice(1, -1).map((c: string) => c.trim());
      htmlTable += `    <tr>\n`;
      cells.forEach((c: string) => {
        // Highlight bold in table cells
        let cellContent = c;
        if (c.startsWith('**') && c.endsWith('**')) {
          cellContent = `<b>${c.slice(2, -2)}</b>`;
        }
        htmlTable += `      <td style="border: 1px solid #000; padding: 8px; text-align: left;">${cellContent}</td>\n`;
      });
      htmlTable += `    </tr>\n`;
    });
    htmlTable += `  </tbody>\n</table>`;
    
    return htmlTable;
  });

  return html;
}
