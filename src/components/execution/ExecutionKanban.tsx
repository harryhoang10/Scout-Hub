import React, { useState, useEffect } from 'react';
import { 
  Campaign, ExecutionProfile, RestoredData, SOWItem, FollowUpItem, 
  ConnectingStatus, LaunchingStatus, WrappingStatus 
} from '../../types';
import { 
  Rocket, ArrowLeft, Plus, DollarSign, Calendar, MessageSquare, Mail, 
  FileText, Clock, AlertCircle, CheckCircle2, ChevronRight, X, Sparkles, 
  Trash2, PlusCircle, Paperclip, ExternalLink, ShieldAlert, Check, Settings, Download
} from 'lucide-react';
import ContractGenerator from './ContractGenerator';
import * as XLSX from 'xlsx';

interface ExecutionKanbanProps {
  campaign: Campaign;
  executionProfiles: ExecutionProfile[];
  crmProfiles: RestoredData[];
  onUpdateExecutionProfile: (updatedProfile: ExecutionProfile) => void;
  onUpdateCRMProfile?: (profileId: string, field: keyof RestoredData, value: any) => void;
  onJumpToCRM?: (profileId: string) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

// Helper to run the Auto-Status Engine
export const runAutoStatusEngine = (profile: ExecutionProfile): ExecutionProfile => {
  const updated = { ...profile, updatedAt: new Date().toISOString() };
  
  if (updated.phase === 'connecting') {
    const hasSow = updated.confirmedSOW && updated.confirmedSOW.length > 0;
    const hasCost = updated.totalCost > 0;
    const hasTerm = updated.paymentTerm && updated.paymentTerm.trim().length > 0;
    
    if (hasSow && hasCost && hasTerm) {
      updated.connectingStatus = 'confirmed';
      // Auto-move transition to launching
      updated.phase = 'launching';
      updated.launchingStatus = 'preparing';
    } else if (hasSow) {
      updated.connectingStatus = 'dealing';
    } else {
      updated.connectingStatus = 'pending_quote';
    }
  } 
  else if (updated.phase === 'launching') {
    const hasLinks = updated.publishedLinks && updated.publishedLinks.length > 0;
    const hasContract = updated.contractType || (updated.confirmEmailDraft && updated.confirmEmailDraft.trim().length > 0);
    
    if (hasLinks) {
      updated.launchingStatus = 'aired';
      // Auto-move transition to wrapping
      updated.phase = 'wrapping';
      updated.wrappingStatus = 'pending_payment';
    } else if (hasContract) {
      updated.launchingStatus = 'in_progress';
    } else {
      updated.launchingStatus = 'preparing';
    }
  } 
  else if (updated.phase === 'wrapping') {
    const hasActualPayment = updated.actualPaymentDate && updated.actualPaymentDate.trim().length > 0;
    const hasInvoice = updated.invoiceNumber && updated.invoiceNumber.trim().length > 0;
    
    if (hasActualPayment) {
      updated.wrappingStatus = 'completed';
    } else if (hasInvoice) {
      updated.wrappingStatus = 'processing';
    } else {
      updated.wrappingStatus = 'pending_payment';
    }
  }

  return updated;
};

export default function ExecutionKanban({
  campaign,
  executionProfiles,
  crmProfiles,
  onUpdateExecutionProfile,
  onUpdateCRMProfile,
  onJumpToCRM,
  onBack,
  theme
}: ExecutionKanbanProps) {
  const isDark = theme === 'dark';
  
  // Filtering profiles for this campaign
  const campaignProfiles = executionProfiles.filter(p => p.campaignId === campaign.id);

  // States
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'paperwork' | 'wrapping' | 'followup' | 'activity'>('overview');
  
  const getDeadlineStatus = (deadlineStr?: string, isAired?: boolean) => {
    if (!deadlineStr || isAired) return 'normal';
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadline = new Date(deadlineStr);
    deadline.setHours(0,0,0,0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'warning';
    return 'normal';
  };
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<'connecting' | 'launching' | 'wrapping' | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Quick Dialog / Generator States
  const [showEmailGen, setShowEmailGen] = useState<string | null>(null); // profileId
  const [emailTone, setEmailTone] = useState<'formal' | 'friendly' | 'negotiate'>('formal');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  const [showMessageGen, setShowMessageGen] = useState<string | null>(null); // profileId
  const [messageTemplate, setMessageTemplate] = useState<'ask_quote' | 'counter' | 'confirm'>('ask_quote');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [showContractGen, setShowContractGen] = useState<string | null>(null); // profileId


  // SOW Temporary states for detail panel
  const [tempSowName, setTempSowName] = useState('');
  const [tempSowPrice, setTempSowPrice] = useState('');
  const [tempSowQty, setTempSowQty] = useState('1');

  // Follow-up Temporary states
  const [tempFollowDesc, setTempFollowDesc] = useState('');
  const [tempFollowDate, setTempFollowDate] = useState('');

  // Published links Temporary state
  const [tempLink, setTempLink] = useState('');

  const activeProfile = campaignProfiles.find(p => p.id === selectedProfileId);
  const activeCRMProfile = activeProfile ? crmProfiles.find(cp => cp.id === activeProfile.profileId) : null;

  // CSS classes based on theme
  const cardBg = isDark ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]' : 'bg-white border-slate-200 hover:shadow-md';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const sidebarBg = isDark ? 'bg-[#0f0f15] border-l border-white/[0.06]' : 'bg-white border-l border-slate-200';
  const panelBg = isDark ? 'bg-[#0d0d12]' : 'bg-slate-50';
  const inputBg = isDark 
    ? 'bg-white/[0.03] border-white/[0.06] text-white focus:bg-white/[0.05] focus:border-violet-500/80' 
    : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500/80';

  // Manual Drag & Drop support (simple simulation or manual status override via click)
  const handleManualMovePhase = (profile: ExecutionProfile, newPhase: 'connecting' | 'launching' | 'wrapping') => {
    let updated = { ...profile, phase: newPhase };
    if (newPhase === 'connecting') {
      updated.connectingStatus = 'pending_quote';
    } else if (newPhase === 'launching') {
      updated.launchingStatus = 'preparing';
    } else {
      updated.wrappingStatus = 'pending_payment';
    }
    updated.updatedAt = new Date().toISOString();

    // Record activity log
    const newActivityLog = [...(profile.activityLog || [])];
    newActivityLog.push({
      id: `act_${Math.random().toString(36).substring(7)}`,
      action: `Chuyển phase từ ${profile.phase.toUpperCase()} sang ${newPhase.toUpperCase()}`,
      timestamp: new Date().toISOString()
    });
    updated.activityLog = newActivityLog;

    onUpdateExecutionProfile(updated);
  };

  // Status labels translation
  const getStatusLabel = (profile: ExecutionProfile) => {
    if (profile.phase === 'connecting') {
      switch (profile.connectingStatus) {
        case 'pending_quote': return { text: 'Chờ báo giá', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
        case 'dealing': return { text: 'Đang deal', style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
        case 'confirmed': return { text: 'Đã confirm', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        case 'cancelled': return { text: 'Đã huỷ', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      }
    } else if (profile.phase === 'launching') {
      switch (profile.launchingStatus) {
        case 'preparing': return { text: 'Chuẩn bị', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
        case 'in_progress': return { text: 'Đang thực hiện', style: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
        case 'aired': return { text: 'Đã air', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        case 'cancelled': return { text: 'Đã huỷ', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      }
    } else {
      switch (profile.wrappingStatus) {
        case 'pending_payment': return { text: 'Chờ đi tiền', style: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
        case 'processing': return { text: 'Đang xử lý', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
        case 'completed': return { text: 'Hoàn thành', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        case 'cancelled': return { text: 'Đã huỷ', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      }
    }
  };

  // AI Message Generator (B8) logic simulation
  useEffect(() => {
    if (showMessageGen && activeProfile && activeCRMProfile) {
      const name = activeCRMProfile.nickname || activeCRMProfile.channelId || 'Bạn';
      const SOWDesc = activeProfile.confirmedSOW.length > 0 
        ? activeProfile.confirmedSOW.map(item => `${item.quantity}x ${item.name}`).join(', ')
        : 'video review sản phẩm';
      const cost = activeProfile.totalCost > 0 ? `${activeProfile.totalCost.toLocaleString('vi-VN')} đ` : '[nhập chi phí]';

      let template = '';
      if (messageTemplate === 'ask_quote') {
        template = `Hi ${name} ơi, mình bên nhãn hàng ${campaign.brand} nè. Mình thấy kênh của bạn rất phù hợp cho chiến dịch mới của bên mình. Bạn cho mình xin báo giá cho booking ${SOWDesc} nhé. Cảm ơn bạn!`;
      } else if (messageTemplate === 'counter') {
        template = `Hi ${name} nha, cảm ơn bạn đã gửi báo giá. Đối với booking ${SOWDesc}, ngân sách bên mình đang đề xuất là ${cost}. Bạn xem và cân đối giúp nhãn hàng xem có hỗ trợ được mức giá này không nhé, tụi mình rất mong có cơ hội hợp tác cùng bạn đợt này!`;
      } else if (messageTemplate === 'confirm') {
        template = `Chào ${name}, mình xin confirm lại các hạng mục công việc đã chốt của campaign [${campaign.name}] nha:\n- Hạng mục: ${SOWDesc}\n- Tổng chi phí: ${cost} (${activeProfile.paymentTerm || 'COD'})\nBạn check và xác nhận lại giúp mình nha. Cảm ơn bạn rất nhiều!`;
      }
      setGeneratedMessage(template);
    }
  }, [showMessageGen, messageTemplate, activeProfile, activeCRMProfile]);

  // AI Email Generator (B5) simulation
  const handleGenerateEmail = () => {
    if (!activeProfile || !activeCRMProfile) return;
    setIsGeneratingEmail(true);
    setTimeout(() => {
      const name = activeCRMProfile.nickname || activeCRMProfile.channelId || 'KOL';
      const SOWText = activeProfile.confirmedSOW.map(item => `- ${item.name} (SL: ${item.quantity}) - ${item.price.toLocaleString('vi-VN')} đ`).join('\n');
      const costText = `${activeProfile.totalCost.toLocaleString('vi-VN')} đ`;
      const contractTypeVietnamese = activeProfile.contractType === 'company' 
        ? 'Công ty (hóa đơn VAT)' 
        : activeProfile.contractType === 'business_household' 
        ? 'Hộ kinh doanh cá thể' 
        : 'Cá nhân (thuế TNCN khấu trừ)';

      let toneText = '';
      if (emailTone === 'friendly') {
        toneText = `Chào ${name} thương mến,\n\nLời đầu tiên, team ${campaign.brand} xin gửi lời cảm ơn chân thành đến bạn vì đã đồng hành cùng chiến dịch [${campaign.name}] lần này.\n\nĐể các bước tiếp theo diễn ra thuận lợi, mình xin tóm tắt lại thỏa thuận hợp tác (SOW) và chi phí như hai bên đã thống nhất nha:\n\n${SOWText}\n\n**Tổng chi phí:** ${costText} (Hình thức ký hợp đồng: ${contractTypeVietnamese})\n**Điều khoản thanh toán:** ${activeProfile.paymentTerm || 'Tạm ứng 50%, thanh toán 50% còn lại sau nghiệm thu'}\n\nBạn xem kỹ và reply email này để xác nhận SOW giúp mình nha. Sau khi bạn confirm, team sẽ tiến hành soạn thảo hợp đồng chính thức gửi bạn ký duyệt nè.\n\nChúc ${name} một ngày ngập tràn năng lượng và sáng tạo!\n\nThân mến,\nTeam Marketing - ${campaign.brand}`;
      } else if (emailTone === 'negotiate') {
        toneText = `Kính gửi ${name},\n\nLời đầu tiên, nhãn hàng ${campaign.brand} xin gửi lời chào trân trọng.\n\nCảm ơn bạn đã phản hồi đề xuất hợp tác cho chiến dịch [${campaign.name}]. Sau khi bàn bạc kỹ lưỡng về kế hoạch và cân đối ngân sách tổng thể của chiến dịch, nhãn hàng xin gửi lại đề xuất thương thảo SOW và chi phí như sau:\n\n${SOWText}\n\n**Tổng ngân sách đề xuất:** ${costText} (Đã bao gồm tất cả các thuế phí phát sinh)\n**Điều khoản thanh toán dự kiến:** ${activeProfile.paymentTerm || 'Net 30'}\n\nĐây là mức ngân sách tối ưu nhất mà nhãn hàng có thể dành riêng cho sự hợp tác đặc biệt này với mong muốn đồng hành lâu dài cùng bạn. Rất mong ${name} cân đối hỗ trợ nhãn hàng để chúng ta sớm bắt tay triển khai.\n\nMong sớm nhận được phản hồi tốt từ bạn.\n\nTrân trọng,\nMarketing Department - ${campaign.brand}`;
      } else {
        toneText = `Kính gửi đối tác ${name},\n\nNhãn hàng ${campaign.brand} xin gửi lời chào trân trọng và lời chúc sức khỏe.\n\nCăn cứ vào các cuộc trao đổi thảo luận trước đó về chiến dịch truyền thông [${campaign.name}], chúng tôi xin gửi email này để chính thức xác nhận các hạng mục công việc (SOW) và chi phí hợp tác như sau:\n\n1. Hạng mục công việc:\n${SOWText}\n\n2. Tổng giá trị hợp đồng: ${costText}\n3. Hình thức ký kết: Hợp đồng ${contractTypeVietnamese}\n4. Tiến độ thanh toán: ${activeProfile.paymentTerm || 'Thanh toán trong vòng 30 ngày sau khi hoàn thành nghiệm thu'}\n\nQúy đối tác vui lòng rà soát lại thông tin trên và phản hồi email này để xác nhận. Ngay sau khi nhận được xác nhận, bộ phận pháp chế của chúng tôi sẽ chuyển hợp đồng mẫu sang để đối tác duyệt trước khi ký kết.\n\nXin chân thành cảm ơn sự hợp tác của Qúy đối tác.\n\nTrân trọng,\nĐại diện nhãn hàng ${campaign.brand}`;
      }
      setGeneratedEmail(toneText);
      setIsGeneratingEmail(false);
    }, 800);
  };

  useEffect(() => {
    if (showEmailGen) {
      handleGenerateEmail();
    }
  }, [showEmailGen, emailTone]);

  // Handle updates inside the slide-in detail panel
  const handleFieldChange = (key: keyof ExecutionProfile, value: any) => {
    if (!activeProfile) return;
    const oldVal = activeProfile[key];
    
    // Check if value changed
    if (JSON.stringify(oldVal) === JSON.stringify(value)) return;

    let updated = { 
      ...activeProfile, 
      [key]: value 
    };
    
    // Automatically re-calculate total cost if SOW items changed
    if (key === 'confirmedSOW') {
      const items = value as SOWItem[];
      updated.totalCost = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // Trigger Auto-Status Engine
    const prevPhase = activeProfile.phase;
    updated = runAutoStatusEngine(updated);
    
    // Record activity log
    const newActivityLog = [...(activeProfile.activityLog || [])];
    
    let actionDesc = '';
    if (key === 'phase' || updated.phase !== prevPhase) {
      actionDesc = `Chuyển phase từ ${prevPhase.toUpperCase()} sang ${updated.phase.toUpperCase()}`;
    } else if (key === 'connectingStatus') {
      actionDesc = `Cập nhật trạng thái Connecting: ${value}`;
    } else if (key === 'launchingStatus') {
      actionDesc = `Cập nhật trạng thái Launching: ${value}`;
    } else if (key === 'wrappingStatus') {
      actionDesc = `Cập nhật trạng thái Wrapping: ${value}`;
    } else if (key === 'confirmedSOW') {
      actionDesc = `Cập nhật hạng mục công việc SOW (${value.length} hạng mục)`;
    } else if (key === 'totalCost') {
      actionDesc = `Thay đổi chi phí chốt: ${value.toLocaleString('vi-VN')} đ`;
    } else if (key === 'contentDeadline') {
      actionDesc = `Cập nhật Hạn nộp content: ${value}`;
    } else if (key === 'publishedLinks') {
      actionDesc = `Cập nhật danh sách bài đăng đã air (${value.length} bài đăng)`;
    } else if (key === 'invoiceNumber') {
      actionDesc = `Cập nhật Số hóa đơn: ${value}`;
    } else if (key === 'actualPaymentDate') {
      actionDesc = `Xác nhận ngày thực tế đi tiền: ${value}`;
    } else {
      actionDesc = `Cập nhật thông tin ${String(key)}`;
    }

    newActivityLog.push({
      id: `act_${Math.random().toString(36).substring(7)}`,
      action: actionDesc,
      timestamp: new Date().toISOString()
    });

    updated.activityLog = newActivityLog;
    
    onUpdateExecutionProfile(updated);
  };

  // Add SOW item
  const handleAddSOWItem = () => {
    if (!activeProfile || !tempSowName.trim() || !tempSowPrice) return;
    const newItem: SOWItem = {
      name: tempSowName.trim(),
      price: parseFloat(tempSowPrice) || 0,
      currency: activeProfile.currency || 'VND',
      quantity: parseInt(tempSowQty) || 1
    };
    const updatedSOW = [...activeProfile.confirmedSOW, newItem];
    handleFieldChange('confirmedSOW', updatedSOW);
    
    // Reset inputs
    setTempSowName('');
    setTempSowPrice('');
    setTempSowQty('1');
  };

  // Delete SOW item
  const handleDeleteSOWItem = (index: number) => {
    if (!activeProfile) return;
    const updatedSOW = activeProfile.confirmedSOW.filter((_, idx) => idx !== index);
    handleFieldChange('confirmedSOW', updatedSOW);
  };

  // Add Follow-up item
  const handleAddFollowUp = () => {
    if (!activeProfile || !tempFollowDesc.trim()) return;
    const newItem: FollowUpItem = {
      id: `fu_${Math.random().toString(36).substring(7)}`,
      description: tempFollowDesc.trim(),
      dueDate: tempFollowDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      completed: false
    };
    const updatedFollow = [...activeProfile.followUpItems, newItem];
    handleFieldChange('followUpItems', updatedFollow);
    setTempFollowDesc('');
    setTempFollowDate('');
  };

  // Toggle Follow-up completion
  const handleToggleFollowUp = (itemId: string) => {
    if (!activeProfile) return;
    const updatedFollow = activeProfile.followUpItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    handleFieldChange('followUpItems', updatedFollow);
  };

  // Delete Follow-up item
  const handleDeleteFollowUp = (itemId: string) => {
    if (!activeProfile) return;
    const updatedFollow = activeProfile.followUpItems.filter(item => item.id !== itemId);
    handleFieldChange('followUpItems', updatedFollow);
  };

  // Add published link
  const handleAddLink = () => {
    if (!activeProfile || !tempLink.trim()) return;
    const updatedLinks = [...activeProfile.publishedLinks, tempLink.trim()];
    handleFieldChange('publishedLinks', updatedLinks);
    setTempLink('');
  };

  // Remove published link
  const handleRemoveLink = (index: number) => {
    if (!activeProfile) return;
    const updatedLinks = activeProfile.publishedLinks.filter((_, idx) => idx !== index);
    handleFieldChange('publishedLinks', updatedLinks);
  };

  // Timeline events calculator for the Sidebar (B7)
  const getTimelineEvents = () => {
    const events: { 
      id: string; 
      date: string; 
      type: 'deadline' | 'payment' | 'followup'; 
      title: string; 
      desc: string; 
      status: 'overdue' | 'upcoming' | 'completed';
      profileName: string;
      profilePic?: string;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    campaignProfiles.forEach(p => {
      const crmProf = crmProfiles.find(cp => cp.id === p.profileId);
      const name = crmProf ? `@${crmProf.channelId}` : 'KOL';
      const pic = crmProf?.profilePic;

      // 1. Content deadline
      if (p.contentDeadline) {
        const isCompleted = p.publishedLinks.length > 0;
        const isOverdue = !isCompleted && p.contentDeadline < todayStr;
        events.push({
          id: `${p.id}_dl`,
          date: p.contentDeadline,
          type: 'deadline',
          title: 'Hạn nộp content',
          desc: `${name} cần nộp bài đăng duyệt`,
          status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'upcoming',
          profileName: name,
          profilePic: pic
        });
      }

      // 2. Expected Payment Date
      if (p.expectedPaymentDate) {
        const isCompleted = !!p.actualPaymentDate;
        const isOverdue = !isCompleted && p.expectedPaymentDate < todayStr;
        events.push({
          id: `${p.id}_pay`,
          date: p.expectedPaymentDate,
          type: 'payment',
          title: 'Thanh toán dự kiến',
          desc: `Chi trả số tiền: ${p.totalCost.toLocaleString('vi-VN')} đ`,
          status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'upcoming',
          profileName: name,
          profilePic: pic
        });
      }

      // 3. Follow-up items
      p.followUpItems.forEach(fu => {
        const isOverdue = !fu.completed && fu.dueDate < todayStr;
        events.push({
          id: fu.id,
          date: fu.dueDate,
          type: 'followup',
          title: fu.description,
          desc: `Mục cần theo dõi cho ${name}`,
          status: fu.completed ? 'completed' : isOverdue ? 'overdue' : 'upcoming',
          profileName: name,
          profilePic: pic
        });
      });
    });

    // Sort by date ascending (oldest first or newest depending on context, let's do chronological)
    return events.sort((a, b) => a.date.localeCompare(b.date));
  };

  const handleExportExcel = () => {
    if (campaignProfiles.length === 0) {
      alert('Không có dữ liệu KOL nào trong chiến dịch này để xuất báo cáo!');
      return;
    }

    // Format data for sheet
    const dataToExport = campaignProfiles.map((p, idx) => {
      const crm = crmProfiles.find(cp => cp.id === p.profileId);
      const SOWText = p.confirmedSOW.map(item => `${item.quantity}x ${item.name} (${item.price.toLocaleString('vi-VN')} đ)`).join('\n');
      
      let statusLabel = '';
      if (p.phase === 'connecting') {
        statusLabel = p.connectingStatus === 'pending_quote' ? 'Chờ báo giá' : p.connectingStatus === 'dealing' ? 'Đang deal' : p.connectingStatus === 'confirmed' ? 'Đã confirm' : 'Đã huỷ';
      } else if (p.phase === 'launching') {
        statusLabel = p.launchingStatus === 'preparing' ? 'Chuẩn bị' : p.launchingStatus === 'in_progress' ? 'Đang chạy' : p.launchingStatus === 'aired' ? 'Đã air' : 'Đã huỷ';
      } else {
        statusLabel = p.wrappingStatus === 'pending_payment' ? 'Chờ đi tiền' : p.wrappingStatus === 'processing' ? 'Đang xử lý' : p.wrappingStatus === 'completed' ? 'Hoàn thành' : 'Đã huỷ';
      }

      return {
        'STT': idx + 1,
        'Tên KOL': crm?.nickname || 'Chưa rõ',
        'Username / ID': crm?.channelId ? `@${crm.channelId}` : 'Chưa rõ',
        'Nền tảng': crm?.platform || 'N/A',
        'SĐT liên hệ': crm?.phone || 'Chưa có',
        'Email liên hệ': crm?.email || 'Chưa có',
        'Link ảnh': crm?.profilePic || '',
        'Phase hiện tại': p.phase.toUpperCase(),
        'Trạng thái': statusLabel,
        'Hạng mục (SOW)': SOWText,
        'Tổng chi phí (VND)': p.totalCost,
        'Điều khoản thanh toán': p.paymentTerm || 'COD',
        'Pháp nhân ký hợp đồng': p.contractType === 'company' ? 'Công ty' : p.contractType === 'business_household' ? 'Hộ kinh doanh' : p.contractType === 'individual' ? 'Cá nhân' : 'Chưa chọn',
        'Hạn nộp content': p.contentDeadline || 'Chưa set',
        'Link bài viết đã air': p.publishedLinks.join('\n') || 'Chưa có',
        'Số hóa đơn / UNC': p.invoiceNumber || 'Chưa có',
        'Ngày thực tế đi tiền': p.actualPaymentDate || 'Chưa đi tiền',
        'Ghi chú nghiệm thu': p.acceptanceNotes || '',
        'Ghi chú chung': p.notes || ''
      };
    });

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Set column widths for readability
    const max_widths = [
      { wch: 5 },   // STT
      { wch: 18 },  // Tên KOL
      { wch: 15 },  // Username
      { wch: 10 },  // Nền tảng
      { wch: 15 },  // SĐT
      { wch: 22 },  // Email
      { wch: 25 },  // Link ảnh
      { wch: 15 },  // Phase
      { wch: 15 },  // Trạng thái
      { wch: 35 },  // SOW
      { wch: 18 },  // Chi phí
      { wch: 20 },  // Điều khoản
      { wch: 20 },  // Pháp nhân
      { wch: 15 },  // Deadline
      { wch: 35 },  // Link air
      { wch: 15 },  // Số hóa đơn
      { wch: 18 },  // Ngày đi tiền
      { wch: 25 },  // Nghiệm thu
      { wch: 25 }   // Ghi chú
    ];
    worksheet['!cols'] = max_widths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KOL Execution Report');

    // Write file & trigger download
    XLSX.writeFile(workbook, `BaoCao_Execution_${campaign.brand}_${campaign.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const timelineEvents = getTimelineEvents();
  const overdueCount = timelineEvents.filter(e => e.status === 'overdue').length;

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)] relative">
      
      {/* Top Navigation Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-500/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`p-2 border rounded-xl hover:bg-slate-500/10 active:scale-95 transition-all cursor-pointer ${
              isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
            title="Quay lại danh sách chiến dịch"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className={`text-lg font-extrabold ${textPrimary} flex items-center gap-2 tracking-tight`}>
              {campaign.name}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                campaign.status === 'active' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {campaign.status === 'active' ? 'Đang chạy' : campaign.status}
              </span>
            </h3>
            <p className={`text-xs ${textSecondary} mt-0.5`}>
              Nhãn hàng: <span className="font-semibold">{campaign.brand}</span> | Charge Code: <span className="font-semibold">{campaign.chargeCode}</span> | Ngân sách: <span className="font-semibold text-amber-500">{campaign.budget ? `${campaign.budget.toLocaleString('vi-VN')} đ` : 'Chưa nhập'}</span>
            </p>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-pulse-slow">
              <Clock className="h-3.5 w-3.5" />
              <span>{overdueCount} đầu mục trễ hạn!</span>
            </div>
          )}
          
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/15 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{timelineCollapsed ? 'Hiện Timeline' : 'Ẩn Timeline'}</span>
          </button>
        </div>
      </div>

      {/* Main Kanban Content Area */}
      <div className="flex-1 flex gap-5 min-h-0 overflow-hidden relative">
        
        {/* Kanban Columns (Connecting, Launching, Wrapping) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto h-full pr-1">
          
          {/* 🔗 CONNECTING COLUMN */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedOverColumn !== 'connecting') setDraggedOverColumn('connecting');
            }}
            onDragLeave={() => {
              setDraggedOverColumn(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDraggedOverColumn(null);
              const profileId = e.dataTransfer.getData('text/plain');
              const profile = campaignProfiles.find(p => p.id === profileId);
              if (profile && profile.phase !== 'connecting') {
                handleManualMovePhase(profile, 'connecting');
              }
            }}
            className={`rounded-2xl border flex flex-col h-full overflow-hidden transition-all duration-200 ${borderColor} ${
              draggedOverColumn === 'connecting' 
                ? 'border-sky-500 bg-sky-500/5 shadow-lg shadow-sky-500/10 scale-[1.01]' 
                : isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'
            }`}
          >
            <div className="px-4 py-3.5 border-b border-sky-500/10 bg-gradient-to-r from-sky-500/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-md shadow-sky-500/35" />
                <h4 className={`text-sm font-bold ${textPrimary}`}>🔗 CONNECTING</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/15">
                {campaignProfiles.filter(p => p.phase === 'connecting').length} KOLs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {campaignProfiles.filter(p => p.phase === 'connecting').map(profile => {
                const crm = crmProfiles.find(cp => cp.id === profile.profileId);
                if (!crm) return null;
                const status = getStatusLabel(profile);

                return (
                  <div
                    key={profile.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', profile.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(profile.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                    }}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setDetailTab('overview');
                    }}
                    className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${cardBg} ${
                      draggingId === profile.id ? 'opacity-40 scale-95 border-dashed border-sky-500/50' : ''
                    }`}
                  >
                    {/* User profile info */}
                    <div className="flex items-center gap-3 mb-3">
                      {crm.profilePic ? (
                        <img 
                          src={crm.profilePic} 
                          alt={crm.nickname} 
                          className="w-9 h-9 rounded-full object-cover border border-violet-500/20"
                          onError={e => {
                            (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-sm">
                          {(crm.nickname || crm.channelId || 'K').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h5 className={`text-xs font-bold ${textPrimary} truncate`}>{crm.nickname || 'Không tên'}</h5>
                        <p className={`text-[10px] ${textSecondary} truncate`}>@{crm.channelId || 'no-id'} ({crm.platform})</p>
                      </div>
                    </div>

                    {/* SOW & Cost Summary */}
                    <div className={`mb-3 py-1.5 px-2.5 rounded-lg text-[11px] border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                      <div className="flex justify-between font-semibold mb-0.5">
                        <span className={textSecondary}>SOW:</span>
                        <span className={`${textPrimary} truncate max-w-[120px]`}>
                          {profile.confirmedSOW.length > 0 
                            ? profile.confirmedSOW.map(i => `${i.quantity}x ${i.name}`).join(', ') 
                            : 'Chưa chốt SOW'}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className={textSecondary}>Chi phí:</span>
                        <span className="text-violet-500">{profile.totalCost.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>

                    {/* Footer: status badge, quick actions */}
                    <div className="flex items-center justify-between border-t pt-2.5 border-slate-500/5" onClick={e => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${status?.style}`}>
                        {status?.text}
                      </span>
                      <div className="flex items-center gap-1 text-slate-500">
                        <button
                          onClick={() => onJumpToCRM?.(profile.profileId)}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Xem thông tin chi tiết ở CRM"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setShowMessageGen(profile.id)}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Soạn tin nhắn"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowEmailGen(profile.id);
                            setEmailTone('formal');
                          }}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Soạn email SOW"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleManualMovePhase(profile, 'launching')}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-amber-400 transition-colors`}
                          title="Chuyển sang Launching"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {campaignProfiles.filter(p => p.phase === 'connecting').length === 0 && (
                <div className={`text-center py-10 px-4 border border-dashed rounded-2xl ${borderColor} ${textMuted} text-xs`}>
                  Không có KOL nào ở bước đàm phán kết nối.
                </div>
              )}
            </div>
          </div>

          {/* 🚀 LAUNCHING COLUMN */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedOverColumn !== 'launching') setDraggedOverColumn('launching');
            }}
            onDragLeave={() => {
              setDraggedOverColumn(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDraggedOverColumn(null);
              const profileId = e.dataTransfer.getData('text/plain');
              const profile = campaignProfiles.find(p => p.id === profileId);
              if (profile && profile.phase !== 'launching') {
                handleManualMovePhase(profile, 'launching');
              }
            }}
            className={`rounded-2xl border flex flex-col h-full overflow-hidden transition-all duration-200 ${borderColor} ${
              draggedOverColumn === 'launching' 
                ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10 scale-[1.01]' 
                : isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'
            }`}
          >
            <div className="px-4 py-3.5 border-b border-amber-500/10 bg-gradient-to-r from-amber-500/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md shadow-amber-500/35 animate-pulse" />
                <h4 className={`text-sm font-bold ${textPrimary}`}>🚀 LAUNCHING</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">
                {campaignProfiles.filter(p => p.phase === 'launching').length} KOLs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {campaignProfiles.filter(p => p.phase === 'launching').map(profile => {
                const crm = crmProfiles.find(cp => cp.id === profile.profileId);
                if (!crm) return null;
                const status = getStatusLabel(profile);
                
                const dlStatus = getDeadlineStatus(profile.contentDeadline, profile.launchingStatus === 'aired');
                const dlBorderClass = dlStatus === 'overdue' 
                  ? 'border-rose-500 bg-rose-500/[0.01] shadow-sm animate-pulse-slow' 
                  : dlStatus === 'warning' 
                  ? 'border-amber-500 bg-amber-500/[0.01]' 
                  : cardBg;

                return (
                  <div
                    key={profile.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', profile.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(profile.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                    }}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setDetailTab('paperwork');
                    }}
                    className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${dlBorderClass} ${
                      draggingId === profile.id ? 'opacity-40 scale-95 border-dashed border-amber-500/50' : ''
                    }`}
                  >
                    {/* User profile info */}
                    <div className="flex items-center gap-3 mb-3">
                      {crm.profilePic ? (
                        <img 
                          src={crm.profilePic} 
                          alt={crm.nickname} 
                          className="w-9 h-9 rounded-full object-cover border border-violet-500/20"
                          onError={e => {
                            (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-50/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                          {(crm.nickname || crm.channelId || 'K').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h5 className={`text-xs font-bold ${textPrimary} truncate`}>{crm.nickname || 'Không tên'}</h5>
                        <p className={`text-[10px] ${textSecondary} truncate`}>@{crm.channelId || 'no-id'} ({crm.platform})</p>
                      </div>
                    </div>

                    {/* Paperwork details */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                      <div className={`p-1.5 rounded-lg border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                        <span className={`${textMuted} uppercase text-[8px] font-bold block mb-0.5`}>Hợp đồng</span>
                        <span className={`font-semibold ${profile.contractType ? 'text-emerald-400' : 'text-amber-500'}`}>
                          {profile.contractType ? '✓ Sẵn sàng' : '✗ Chưa làm'}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${
                        dlStatus === 'overdue' 
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-500 font-bold' 
                          : dlStatus === 'warning' 
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 font-bold animate-pulse-slow' 
                          : `${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`
                      }`}>
                        <span className={`${dlStatus !== 'normal' ? 'text-current' : textMuted} uppercase text-[8px] font-bold block mb-0.5`}>Deadline bài</span>
                        <span className={`font-bold ${dlStatus !== 'normal' ? 'text-current' : textPrimary}`}>
                          {profile.contentDeadline ? new Date(profile.contentDeadline).toLocaleDateString('vi-VN', {month: 'numeric', day: 'numeric'}) : 'Chưa set'}
                        </span>
                      </div>
                    </div>

                    {/* SOW & Cost Summary */}
                    <div className={`mb-3 py-1.5 px-2.5 rounded-lg text-[11px] border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                      <div className="flex justify-between font-bold">
                        <span className={textSecondary}>Ngân sách:</span>
                        <span className="text-violet-500">{profile.totalCost.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>

                    {/* Footer: status badge, quick actions */}
                    <div className="flex items-center justify-between border-t pt-2.5 border-slate-500/5" onClick={e => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${status?.style}`}>
                        {status?.text}
                      </span>
                      <div className="flex items-center gap-1 text-slate-500">
                        <button
                          onClick={() => handleManualMovePhase(profile, 'connecting')}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-sky-400 transition-colors`}
                          title="Trở lại Connecting"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onJumpToCRM?.(profile.profileId)}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Xem thông tin chi tiết ở CRM"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowContractGen(profile.id);
                          }}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Soạn thảo hợp đồng (AI Contract Builder)"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleManualMovePhase(profile, 'wrapping')}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-emerald-400 transition-colors`}
                          title="Chuyển sang Wrapping"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {campaignProfiles.filter(p => p.phase === 'launching').length === 0 && (
                <div className={`text-center py-10 px-4 border border-dashed rounded-2xl ${borderColor} ${textMuted} text-xs`}>
                  Không có KOL nào đang chạy chiến dịch.
                </div>
              )}
            </div>
          </div>

          {/* ✅ WRAPPING COLUMN */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedOverColumn !== 'wrapping') setDraggedOverColumn('wrapping');
            }}
            onDragLeave={() => {
              setDraggedOverColumn(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDraggedOverColumn(null);
              const profileId = e.dataTransfer.getData('text/plain');
              const profile = campaignProfiles.find(p => p.id === profileId);
              if (profile && profile.phase !== 'wrapping') {
                handleManualMovePhase(profile, 'wrapping');
              }
            }}
            className={`rounded-2xl border flex flex-col h-full overflow-hidden transition-all duration-200 ${borderColor} ${
              draggedOverColumn === 'wrapping' 
                ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10 scale-[1.01]' 
                : isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'
            }`}
          >
            <div className="px-4 py-3.5 border-b border-emerald-500/10 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/35" />
                <h4 className={`text-sm font-bold ${textPrimary}`}>✅ WRAPPING</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                {campaignProfiles.filter(p => p.phase === 'wrapping').length} KOLs
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {campaignProfiles.filter(p => p.phase === 'wrapping').map(profile => {
                const crm = crmProfiles.find(cp => cp.id === profile.profileId);
                if (!crm) return null;
                const status = getStatusLabel(profile);

                return (
                  <div
                    key={profile.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', profile.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(profile.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                    }}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setDetailTab('wrapping');
                    }}
                    className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${cardBg} ${
                      draggingId === profile.id ? 'opacity-40 scale-95 border-dashed border-emerald-500/50' : ''
                    }`}
                  >
                    {/* User profile info */}
                    <div className="flex items-center gap-3 mb-3">
                      {crm.profilePic ? (
                        <img 
                          src={crm.profilePic} 
                          alt={crm.nickname} 
                          className="w-9 h-9 rounded-full object-cover border border-violet-500/20"
                          onError={e => {
                            (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                          {(crm.nickname || crm.channelId || 'K').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h5 className={`text-xs font-bold ${textPrimary} truncate`}>{crm.nickname || 'Không tên'}</h5>
                        <p className={`text-[10px] ${textSecondary} truncate`}>@{crm.channelId || 'no-id'} ({crm.platform})</p>
                      </div>
                    </div>

                    {/* Wrapping Info */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                      <div className={`p-1.5 rounded-lg border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                        <span className={`${textMuted} uppercase text-[8px] font-bold block mb-0.5`}>Hóa đơn</span>
                        <span className={`font-semibold ${profile.invoiceNumber ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {profile.invoiceNumber ? `#${profile.invoiceNumber}` : 'Chưa nhận'}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-lg border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                        <span className={`${textMuted} uppercase text-[8px] font-bold block mb-0.5`}>Ngày đi tiền</span>
                        <span className={`font-bold ${profile.actualPaymentDate ? 'text-emerald-400' : 'text-amber-500'}`}>
                          {profile.actualPaymentDate ? new Date(profile.actualPaymentDate).toLocaleDateString('vi-VN', {month: 'numeric', day: 'numeric'}) : 'Chờ TT'}
                        </span>
                      </div>
                    </div>

                    {/* Total budget */}
                    <div className={`mb-3 py-1.5 px-2.5 rounded-lg text-[11px] border ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                      <div className="flex justify-between font-bold">
                        <span className={textSecondary}>Thực thanh toán:</span>
                        <span className="text-violet-500">{profile.totalCost.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>

                    {/* Footer: status badge, quick actions */}
                    <div className="flex items-center justify-between border-t pt-2.5 border-slate-500/5" onClick={e => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${status?.style}`}>
                        {status?.text}
                      </span>
                      <div className="flex items-center gap-1 text-slate-500">
                        <button
                          onClick={() => handleManualMovePhase(profile, 'launching')}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-amber-400 transition-colors`}
                          title="Trở lại Launching"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onJumpToCRM?.(profile.profileId)}
                          className={`p-1 rounded-md hover:bg-slate-500/10 hover:text-violet-400 transition-colors`}
                          title="Xem thông tin chi tiết ở CRM"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-500 font-semibold italic">Wrapping</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {campaignProfiles.filter(p => p.phase === 'wrapping').length === 0 && (
                <div className={`text-center py-10 px-4 border border-dashed rounded-2xl ${borderColor} ${textMuted} text-xs`}>
                  Không có KOL nào ở bước thanh toán & nghiệm thu.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* TIMELINE SIDEBAR PANEL (B7) */}
        {!timelineCollapsed && (
          <aside className={`w-80 rounded-2xl border p-4 flex flex-col h-full overflow-hidden flex-shrink-0 animate-slide-in ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-white'}`}>
            <div className="flex items-center gap-2 border-b pb-3 mb-3 border-slate-500/10 flex-shrink-0">
              <Calendar className="h-4.5 w-4.5 text-violet-500" />
              <h4 className={`text-sm font-bold ${textPrimary}`}>Lịch trình Timeline</h4>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
              {timelineEvents.length === 0 ? (
                <div className={`text-center py-10 ${textMuted} text-xs`}>
                  Chưa có lịch trình nào được tạo. Điền Content Deadline hoặc Ngày thanh toán dự kiến để tạo.
                </div>
              ) : (
                timelineEvents.map(event => (
                  <div 
                    key={event.id}
                    className={`p-3 rounded-xl border flex gap-3 items-start transition-all relative overflow-hidden ${borderColor} ${
                      event.status === 'overdue' 
                        ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' 
                        : event.status === 'completed'
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 opacity-60'
                        : isDark ? 'bg-white/[0.01] hover:bg-white/[0.03]' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    {/* Event color marker strip */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                      event.status === 'overdue' 
                        ? 'bg-rose-500' 
                        : event.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-violet-500'
                    }`} />

                    {/* Profile avatar / initial */}
                    {event.profilePic ? (
                      <img 
                        src={event.profilePic} 
                        alt={event.profileName} 
                        className="w-7 h-7 rounded-full object-cover border border-violet-500/10 flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold text-xs flex-shrink-0 mt-0.5">
                        {event.profileName.charAt(1).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-bold uppercase ${
                          event.status === 'overdue' ? 'text-rose-400' : event.status === 'completed' ? 'text-emerald-400' : 'text-violet-400'
                        }`}>
                          {event.title}
                        </span>
                        <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${textMuted}`}>
                          {new Date(event.date).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})}
                        </span>
                      </div>
                      <p className={`text-[11px] font-bold ${textPrimary} truncate`}>{event.desc}</p>
                      <p className={`text-[10px] ${textSecondary} truncate`}>{event.profileName}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

      </div>

      {/* EXECUTION DETAIL SLIDE-IN PANEL (B4 Detail Panel) */}
      {activeProfile && activeCRMProfile && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl shadow-2xl flex flex-col h-screen animate-slide-in-right">
          {/* Backdrop overlay */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={() => setSelectedProfileId(null)} />
          
          <div className={`h-full flex flex-col ${sidebarBg}`}>
            {/* Header */}
            <div className="p-5 border-b flex justify-between items-start border-slate-500/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                {activeCRMProfile.profilePic ? (
                  <img 
                    src={activeCRMProfile.profilePic} 
                    alt={activeCRMProfile.nickname} 
                    className="w-12 h-12 rounded-full object-cover border border-violet-500/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-extrabold text-lg">
                    {(activeCRMProfile.nickname || activeCRMProfile.channelId || 'K').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className={`text-base font-extrabold ${textPrimary}`}>{activeCRMProfile.nickname || 'Không tên'}</h4>
                  <p className={`text-xs ${textSecondary}`}>@{activeCRMProfile.channelId || 'no-id'} | {activeCRMProfile.platform}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProfileId(null)}
                  className={`p-1.5 rounded-lg hover:bg-slate-500/10 transition-colors ${textSecondary}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tab selection */}
            <div className="flex px-4 border-b border-slate-500/10 flex-shrink-0 text-xs font-bold">
              {[
                { id: 'overview' as const, label: 'Connecting (SOW)' },
                { id: 'paperwork' as const, label: 'Paperwork (Launching)' },
                { id: 'wrapping' as const, label: 'Wrapping (Tiền & HĐ)' },
                { id: 'followup' as const, label: 'Follow-ups' },
                { id: 'activity' as const, label: 'Nhật ký' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`py-3 px-4 border-b-2 transition-all relative ${
                    detailTab === tab.id 
                      ? 'border-violet-500 text-violet-500' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content scroll area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0 text-xs">
              
              {/* === TAB 1: OVERVIEW & SOW === */}
              {detailTab === 'overview' && (
                <div className="space-y-4">
                  {/* Status chip inline select */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Status: {activeProfile.connectingStatus}</label>
                    <select
                      value={activeProfile.connectingStatus}
                      onChange={e => handleFieldChange('connectingStatus', e.target.value as ConnectingStatus)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                    >
                      <option value="pending_quote">Chờ báo giá (Pending Quote)</option>
                      <option value="dealing">Đang đàm phán (Dealing)</option>
                      <option value="confirmed">Đã xác nhận (Confirmed) ➔ Auto Launching</option>
                      <option value="cancelled">Đã huỷ (Cancelled)</option>
                    </select>
                  </div>

                  {/* Phone & Email Linked Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Số điện thoại KOL *</label>
                      <input
                        type="text"
                        value={activeCRMProfile.phone || ''}
                        onChange={e => onUpdateCRMProfile && onUpdateCRMProfile(activeCRMProfile.id, 'phone', e.target.value)}
                        placeholder="Chưa có SĐT"
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${inputBg}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Email KOL *</label>
                      <input
                        type="email"
                        value={activeCRMProfile.email || ''}
                        onChange={e => onUpdateCRMProfile && onUpdateCRMProfile(activeCRMProfile.id, 'email', e.target.value)}
                        placeholder="Chưa có Email"
                        className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${inputBg}`}
                      />
                    </div>
                  </div>

                  {/* SOW Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Danh sách công việc (SOW)</label>
                      {activeProfile.confirmedSOW.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[9px] font-bold" title="Đã tự động đồng bộ về Lịch sử báo giá trong CRM">
                          <Check className="h-2.5 w-2.5" />
                          Synced to CRM
                        </span>
                      )}
                    </div>
                    
                    {/* SOW Items */}
                    <div className="space-y-2">
                      {activeProfile.confirmedSOW.map((item, idx) => (
                        <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50'}`}>
                          <div>
                            <p className={`font-bold ${textPrimary}`}>{item.name}</p>
                            <p className={`text-[10px] ${textSecondary}`}>SL: {item.quantity} | Đơn giá: {item.price.toLocaleString('vi-VN')} {item.currency}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSOWItem(idx)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* SOW Adder form */}
                    <div className={`p-3 rounded-xl border space-y-2.5 ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'}`}>
                      <p className={`text-[10px] font-bold ${textPrimary}`}>Thêm hạng mục booking:</p>
                      <input
                        type="text"
                        value={tempSowName}
                        onChange={e => setTempSowName(e.target.value)}
                        placeholder="Tên hạng mục (Ví dụ: 1x Video review TikTok)"
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={tempSowPrice}
                          onChange={e => setTempSowPrice(e.target.value)}
                          placeholder="Đơn giá (VND)"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                        />
                        <input
                          type="number"
                          value={tempSowQty}
                          onChange={e => setTempSowQty(e.target.value)}
                          placeholder="Số lượng"
                          className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSOWItem}
                        className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-[11px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Thêm vào SOW</span>
                      </button>
                    </div>
                  </div>

                  {/* SOW values sum */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Tổng chi phí (VND)</label>
                      <input
                        type="number"
                        value={activeProfile.totalCost}
                        onChange={e => handleFieldChange('totalCost', parseFloat(e.target.value) || 0)}
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Điều khoản thanh toán</label>
                      <select
                        value={activeProfile.paymentTerm}
                        onChange={e => handleFieldChange('paymentTerm', e.target.value)}
                        className={`w-full px-3 py-2.5 rounded-xl border focus:outline-none ${inputBg}`}
                      >
                        <option value="">-- Chọn điều khoản --</option>
                        <option value="Net 30">Net 30</option>
                        <option value="COD">Thanh toán COD</option>
                        <option value="50/50">Cọc 50% - 50% sau air</option>
                        <option value="Net 45">Net 45</option>
                      </select>
                    </div>
                  </div>

                  {/* Raw messages box */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Tin nhắn chốt thỏa thuận gốc</label>
                    <textarea
                      value={activeProfile.confirmMessageRaw}
                      onChange={e => handleFieldChange('confirmMessageRaw', e.target.value)}
                      placeholder="Paste tin nhắn confirm của KOL/Agency tại đây..."
                      rows={3}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none resize-none ${inputBg}`}
                    />
                  </div>
                </div>
              )}

              {/* === TAB 2: PAPERWORK (LAUNCHING) === */}
              {detailTab === 'paperwork' && (
                <div className="space-y-4">
                  {/* Status chip inline select */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Status: {activeProfile.launchingStatus}</label>
                    <select
                      value={activeProfile.launchingStatus}
                      onChange={e => handleFieldChange('launchingStatus', e.target.value as LaunchingStatus)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                    >
                      <option value="preparing">Chuẩn bị (Preparing)</option>
                      <option value="in_progress">Đang thực hiện (In Progress)</option>
                      <option value="aired">Đã air (Aired) ➔ Auto Wrapping</option>
                      <option value="cancelled">Đã huỷ (Cancelled)</option>
                    </select>
                  </div>

                  {/* Contract Type & Generator */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Hình thức pháp nhân ký hợp đồng</label>
                      <button
                        type="button"
                        onClick={() => setShowContractGen(activeProfile.id)}
                        className="text-[10px] font-bold text-violet-500 hover:text-violet-400 flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        AI Tạo Hợp Đồng
                      </button>
                    </div>
                    <select
                      value={activeProfile.contractType || ''}
                      onChange={e => handleFieldChange('contractType', e.target.value || undefined)}
                      className={`w-full px-3 py-2.5 rounded-xl border focus:outline-none ${inputBg}`}
                    >
                      <option value="">-- Chưa chọn --</option>
                      <option value="individual">Ký cá nhân (Khấu trừ thuế TNCN 10%)</option>
                      <option value="company">Ký công ty (Yêu cầu hoá đơn VAT)</option>
                      <option value="business_household">Ký hộ kinh doanh cá thể</option>
                    </select>
                  </div>

                  {/* Google Doc Link & content deadline */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Deadline nộp bài</label>
                      <input
                        type="date"
                        value={activeProfile.contentDeadline || ''}
                        onChange={e => handleFieldChange('contentDeadline', e.target.value || undefined)}
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Link Google Doc hợp đồng</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={activeProfile.contractGoogleDocUrl || ''}
                          onChange={e => handleFieldChange('contractGoogleDocUrl', e.target.value || undefined)}
                          placeholder="https://docs.google.com/..."
                          className={`w-full pl-3 pr-8 py-2 text-xs rounded-xl border focus:outline-none ${inputBg}`}
                        />
                        {activeProfile.contractGoogleDocUrl && (
                          <a
                            href={activeProfile.contractGoogleDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-violet-500"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Notes */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Ghi chú hợp đồng</label>
                    <textarea
                      value={activeProfile.contractNotes}
                      onChange={e => handleFieldChange('contractNotes', e.target.value)}
                      placeholder="Các điều khoản phát sinh, lưu ý khi thanh toán hoặc phạt trễ hạn..."
                      rows={2}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none resize-none ${inputBg}`}
                    />
                  </div>

                  {/* Email confirm draft */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Bản nháp email xác nhận SOW</label>
                      <button
                        type="button"
                        onClick={() => setShowEmailGen(activeProfile.id)}
                        className="text-[10px] font-bold text-violet-500 hover:text-violet-400 flex items-center gap-0.5 active:scale-95 transition-all"
                      >
                        <Sparkles className="h-3 w-3" />
                        AI Soạn lại email
                      </button>
                    </div>
                    <textarea
                      value={activeProfile.confirmEmailDraft || ''}
                      onChange={e => handleFieldChange('confirmEmailDraft', e.target.value)}
                      placeholder="Mẫu email xác nhận chốt SOW được AI sinh ra..."
                      rows={4}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none font-mono text-[10px] resize-none ${inputBg}`}
                    />
                  </div>

                  {/* Published links list (B4 Launching final trigger) */}
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Link bài viết đã air * (Air link sẽ auto Wrapping)</label>
                    
                    <div className="space-y-1.5">
                      {activeProfile.publishedLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={link}
                            readOnly
                            className={`flex-1 px-2.5 py-1 text-xs rounded-lg border leading-tight truncate ${inputBg}`}
                          />
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className={`p-1.5 rounded-lg border hover:bg-slate-500/10 ${borderColor}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                          </a>
                          <button
                            onClick={() => handleRemoveLink(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempLink}
                        onChange={e => setTempLink(e.target.value)}
                        placeholder="Paste link bài viết (Tiktok/Facebook) đã air tại đây..."
                        className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                      />
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all cursor-pointer"
                      >
                        Thêm link
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB 3: WRAPPING & PAYMENT === */}
              {detailTab === 'wrapping' && (
                <div className="space-y-4">
                  {/* Status chip inline select */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Status: {activeProfile.wrappingStatus}</label>
                    <select
                      value={activeProfile.wrappingStatus}
                      onChange={e => handleFieldChange('wrappingStatus', e.target.value as WrappingStatus)}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${inputBg}`}
                    >
                      <option value="pending_payment">Chờ đi tiền (Pending Payment)</option>
                      <option value="processing">Đang xử lý (Processing)</option>
                      <option value="completed">Hoàn thành (Completed)</option>
                      <option value="cancelled">Đã huỷ (Cancelled)</option>
                    </select>
                  </div>

                  {/* Expected vs Actual dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Ngày thanh toán dự kiến</label>
                      <input
                        type="date"
                        value={activeProfile.expectedPaymentDate || ''}
                        onChange={e => handleFieldChange('expectedPaymentDate', e.target.value || undefined)}
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Ngày đi tiền thực tế *</label>
                      <input
                        type="date"
                        value={activeProfile.actualPaymentDate || ''}
                        onChange={e => handleFieldChange('actualPaymentDate', e.target.value || undefined)}
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${inputBg}`}
                      />
                    </div>
                  </div>

                  {/* Invoice Number */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Số hoá đơn / Mã chứng từ *</label>
                    <input
                      type="text"
                      value={activeProfile.invoiceNumber || ''}
                      onChange={e => handleFieldChange('invoiceNumber', e.target.value || undefined)}
                      placeholder="Mã số hoá đơn tài chính VAT hoặc mã UNC chuyển khoản..."
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none ${inputBg}`}
                    />
                  </div>

                  {/* Acceptance notes */}
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Biên bản nghiệm thu & Ghi chú</label>
                    <textarea
                      value={activeProfile.acceptanceNotes}
                      onChange={e => handleFieldChange('acceptanceNotes', e.target.value)}
                      placeholder="Ghi chú về hiệu quả bài air, chỉ số sơ bộ (views, clicks) hoặc các vấn đề trong nghiệm thu..."
                      rows={3}
                      className={`w-full px-3 py-2 rounded-xl border focus:outline-none resize-none ${inputBg}`}
                    />
                  </div>
                </div>
              )}

              {/* === TAB 4: FOLLOW-UPS === */}
              {detailTab === 'followup' && (
                <div className="space-y-4">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Danh sách đầu việc cần theo dõi</label>
                  
                  {/* Follow-up Checklist */}
                  <div className="space-y-2">
                    {activeProfile.followUpItems.map(item => (
                      <div 
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${borderColor} ${
                          item.completed 
                            ? 'bg-emerald-500/5 border-emerald-500/25 opacity-60 text-emerald-500 line-through' 
                            : isDark ? 'bg-white/[0.01]' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleFollowUp(item.id)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              item.completed 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : `${isDark ? 'border-white/10 bg-white/5' : 'border-slate-300 bg-slate-50'}`
                            }`}
                          >
                            <Check className="h-3 w-3 stroke-[3]" />
                          </button>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs leading-tight truncate">{item.description}</p>
                            <p className={`text-[9px] ${textMuted} flex items-center gap-0.5 mt-0.5`}>
                              <Calendar className="w-2.5 h-2.5 inline" />
                              Deadline: {new Date(item.dueDate).toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFollowUp(item.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10 flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {activeProfile.followUpItems.length === 0 && (
                      <div className={`text-center py-8 ${textMuted} text-xs border border-dashed rounded-xl ${borderColor}`}>
                        Chưa có đầu việc follow-up nào được thiết lập.
                      </div>
                    )}
                  </div>

                  {/* Add Follow-up Form */}
                  <div className={`p-4 rounded-xl border space-y-2.5 ${borderColor} ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'}`}>
                    <p className={`text-[10px] font-bold ${textPrimary}`}>Thêm việc cần theo dõi:</p>
                    <input
                      type="text"
                      value={tempFollowDesc}
                      onChange={e => setTempFollowDesc(e.target.value)}
                      placeholder="Mô tả công việc (Ví dụ: Thu thập báo cáo nghiệm thu...)"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                    />
                    <div className="space-y-1">
                      <span className={`text-[9px] uppercase font-bold block ${textMuted}`}>Hạn hoàn thành (Deadline)</span>
                      <input
                        type="date"
                        value={tempFollowDate}
                        onChange={e => setTempFollowDate(e.target.value)}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none ${inputBg}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFollowUp}
                      className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>Thêm Follow-up</span>
                    </button>
                  </div>
                </div>
              )}

              {/* === TAB 5: LỊCH SỬ HOẠT ĐỘNG === */}
              {detailTab === 'activity' && (
                <div className="space-y-4">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Nhật ký hoạt động thực thi</label>
                  <div className="relative pl-6 border-l border-violet-500/20 space-y-4 py-2">
                    {((activeProfile.activityLog || [])).slice().reverse().map((act) => (
                      <div key={act.id} className="relative">
                        {/* Dot indicator */}
                        <div className="absolute -left-[29px] top-1 w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-white dark:border-[#0f0f15]" />
                        
                        <div className="text-xs">
                          <p className={`font-bold ${textPrimary}`}>{act.action}</p>
                          <p className={`text-[9px] ${textMuted} mt-0.5`}>
                            {new Date(act.timestamp).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    ))}

                    {(!activeProfile.activityLog || activeProfile.activityLog.length === 0) && (
                      <div className="relative">
                        <div className="absolute -left-[29px] top-1 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-white dark:border-[#0f0f15]" />
                        <div className="text-xs">
                          <p className={`font-semibold ${textSecondary}`}>Chưa ghi nhận hoạt động nào.</p>
                          <p className={`text-[9px] ${textMuted} mt-0.5`}>
                            Hệ thống sẽ tự động ghi chép nhật ký khi có thay đổi trạng thái, SOW hoặc thông tin liên hệ.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* General meta notes footer in detail panel */}
            <div className="p-5 border-t border-slate-500/10 flex-shrink-0 space-y-2.5">
              <div className="space-y-1">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>Ghi chú tự do chung</label>
                <textarea
                  value={activeProfile.notes}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                  placeholder="Ghi chú bất kỳ thông tin gì liên quan đến KOL này..."
                  rows={2}
                  className={`w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none resize-none ${inputBg}`}
                />
              </div>
              
              <div className={`text-[10px] ${textMuted} flex justify-between`}>
                <span>Assigned: {new Date(activeProfile.assignedAt).toLocaleDateString('vi-VN')}</span>
                <span>Last updated: {new Date(activeProfile.updatedAt).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK DIALOG: AI EMAIL GENERATOR (B5) */}
      {showEmailGen && activeProfile && activeCRMProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl animate-scale-up ${isDark ? 'bg-[#0f0f15] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-500/10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
                <h3 className={`text-base font-bold ${textPrimary}`}>AI SOW Confirm Email Generator</h3>
              </div>
              <button 
                onClick={() => setShowEmailGen(null)}
                className={`p-1.5 rounded-lg hover:bg-slate-500/10 ${textSecondary}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tone selector */}
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${textSecondary}`}>Chọn văn phong:</span>
                {(['formal', 'friendly', 'negotiate'] as const).map(tone => (
                  <button
                    key={tone}
                    onClick={() => setEmailTone(tone)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      emailTone === tone 
                        ? 'bg-violet-600/15 border-violet-500 text-violet-400' 
                        : `${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} ${textSecondary}`
                    }`}
                  >
                    {tone === 'formal' ? '💼 Trang trọng' : tone === 'friendly' ? '🤝 Thân thiện' : '💬 Thương lượng giá'}
                  </button>
                ))}
              </div>

              {/* Email output */}
              <div className="space-y-1 relative">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  <span>Xem trước email</span>
                  {isGeneratingEmail && <span className="text-violet-500 animate-pulse">AI đang suy nghĩ...</span>}
                </div>
                <textarea
                  value={generatedEmail}
                  readOnly
                  rows={10}
                  className={`w-full p-4 text-xs rounded-xl border font-mono resize-none focus:outline-none ${inputBg}`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-500/10">
                <span className="text-[10px] text-slate-500 italic">Copy nội dung email dán vào Outlook/Gmail của bạn</span>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedEmail);
                      alert('✓ Đã sao chép nội dung email vào Clipboard!');
                    }}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Copy Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange('confirmEmailDraft', generatedEmail);
                      setShowEmailGen(null);
                    }}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold hover:bg-slate-500/10 cursor-pointer ${
                      isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Lưu thành Bản nháp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK DIALOG: AI MESSAGE GENERATOR (B8) */}
      {showMessageGen && activeProfile && activeCRMProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-scale-up ${isDark ? 'bg-[#0f0f15] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-500/10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
                <h3 className={`text-base font-bold ${textPrimary}`}>AI Message Templates (Connecting)</h3>
              </div>
              <button 
                onClick={() => setShowMessageGen(null)}
                className={`p-1.5 rounded-lg hover:bg-slate-500/10 ${textSecondary}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Template selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['ask_quote', 'counter', 'confirm'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMessageTemplate(t)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                      messageTemplate === t 
                        ? 'bg-violet-600/15 border-violet-500 text-violet-400' 
                        : `${isDark ? 'border-white/5 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'} ${textSecondary}`
                    }`}
                  >
                    {t === 'ask_quote' ? '💬 Hỏi báo giá' : t === 'counter' ? '💸 Counter-offer' : '✓ Confirm SOW'}
                  </button>
                ))}
              </div>

              {/* Message Output */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Xem trước tin nhắn</span>
                <textarea
                  value={generatedMessage}
                  readOnly
                  rows={6}
                  className={`w-full p-4.5 text-xs rounded-xl border resize-none focus:outline-none ${inputBg}`}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-500/10">
                <span className="text-[10px] text-slate-500 italic">Mở Zalo/TikTok DM dán để gửi nhanh cho KOL</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedMessage);
                    alert('✓ Đã sao chép tin nhắn vào Clipboard!');
                    setShowMessageGen(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Copy Tin nhắn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK DIALOG: AI CONTRACT GENERATOR (B6) */}
      {showContractGen && (() => {
        const targetProfile = campaignProfiles.find(p => p.id === showContractGen);
        const targetCRMProfile = targetProfile ? crmProfiles.find(cp => cp.id === targetProfile.profileId) : null;
        if (!targetProfile || !targetCRMProfile) return null;
        return (
          <ContractGenerator
            campaign={campaign}
            profile={targetProfile}
            crmProfile={targetCRMProfile}
            onUpdateCRMProfile={onUpdateCRMProfile}
            onClose={() => setShowContractGen(null)}
            theme={theme}
          />
        );
      })()}

    </div>
  );
}
