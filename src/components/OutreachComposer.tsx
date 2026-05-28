import React, { useState, useMemo } from 'react';
import { RestoredData, OutreachTemplate, OutreachStatus } from '../types';
import {
  X, Send, Copy, RefreshCw, Plus, Trash2, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Mail, MessageCircle, Briefcase, Sparkles, FileText, Edit3
} from 'lucide-react';

const TEMPLATE_STORAGE_KEY = 'scout_hub_outreach_templates';

const SECTION_LABELS: Record<OutreachTemplate['section'], string> = {
  email: '📧 Email',
  dm_tiktok: '💬 DM TikTok',
  dm_facebook: '💬 DM Facebook',
  dm_instagram: '💬 DM Instagram',
  other: '📝 Khác',
};

const SECTION_OPTIONS: OutreachTemplate['section'][] = ['email', 'dm_tiktok', 'dm_facebook', 'dm_instagram', 'other'];

const DEFAULT_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'default_email_collab',
    name: 'Email mời hợp tác',
    section: 'email',
    subject: '[{{brand}}] Lời mời hợp tác cùng {{tên_kol}}',
    body: `Chào {{tên_kol}},

Mình là [Tên bạn] đến từ {{brand}}.

Bên mình đang triển khai dự án {{tên_dự_án}} và sau khi theo dõi kênh của bạn, mình nhận thấy phong cách nội dung của bạn rất phù hợp với chiến dịch lần này.

SOW dự kiến: {{sow}}
Timeline: {{deadline}}

Nếu bạn quan tâm, mình có thể gửi chi tiết brief và thảo luận thêm về mức báo giá.

Rất mong được hợp tác!
Trân trọng.`,
    variables: ['{{tên_kol}}', '{{brand}}', '{{tên_dự_án}}', '{{sow}}', '{{deadline}}'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default_dm_collab',
    name: 'DM mời hợp tác',
    section: 'dm_tiktok',
    subject: '',
    body: `Chào {{tên_kol}} 👋

Mình bên {{brand}} ạ. Bên mình đang có dự án {{tên_dự_án}} và thấy content của bạn rất match với chiến dịch này.

Bạn có thể share mức giá cho {{sow}} được không ạ?

Cảm ơn bạn nhiều! 🙏`,
    variables: ['{{tên_kol}}', '{{brand}}', '{{tên_dự_án}}', '{{sow}}'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default_followup',
    name: 'Follow-up nhắc',
    section: 'dm_tiktok',
    subject: '',
    body: `Chào {{tên_kol}},

Mình bên {{brand}} đã nhắn trước đó về dự án {{tên_dự_án}} ạ. Không biết bạn đã có thời gian xem qua chưa nhỉ?

Nếu bạn quan tâm thì mình có thể gửi brief chi tiết. Cảm ơn bạn! 🙏`,
    variables: ['{{tên_kol}}', '{{brand}}', '{{tên_dự_án}}'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function loadTemplates(): OutreachTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [...DEFAULT_TEMPLATES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_TEMPLATES];
    return parsed;
  } catch {
    return [...DEFAULT_TEMPLATES];
  }
}

function saveTemplates(templates: OutreachTemplate[]) {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function formatFollowers(val: string | number | undefined): string {
  if (!val) return '-';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return String(val);
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

export interface OutreachProject {
  id: string;
  name: string;
  brand: string;
  sow: string;
  deadline: string;
  notes: string;
  conversationContext: string;
  conversationSamples?: string[];
  createdAt: string;
  updatedAt: string;
}

const PROJECT_STORAGE_KEY = 'scout_hub_outreach_projects';

function loadProjects(defaultName: string = ''): OutreachProject[] {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) {
      return [{
        id: 'default_project',
        name: defaultName || 'Dự án mặc định',
        brand: '',
        sow: '',
        deadline: '',
        notes: '',
        conversationContext: '',
        conversationSamples: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: any) => {
        const samples = p.conversationSamples || [];
        if (samples.length === 0 && p.conversationContext) {
          samples.push(p.conversationContext);
        }
        return {
          id: p.id,
          name: p.name,
          brand: p.brand || '',
          sow: p.sow || '',
          deadline: p.deadline || '',
          notes: p.notes || '',
          conversationContext: p.conversationContext || '',
          conversationSamples: samples,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        };
      });
    }
    return [{
      id: 'default_project',
      name: defaultName || 'Dự án mặc định',
      brand: '',
      sow: '',
      deadline: '',
      notes: '',
      conversationContext: '',
      conversationSamples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  } catch {
    return [{
      id: 'default_project',
      name: defaultName || 'Dự án mặc định',
      brand: '',
      sow: '',
      deadline: '',
      notes: '',
      conversationContext: '',
      conversationSamples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }
}

function saveProjects(projects: OutreachProject[]) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
}

interface OutreachComposerProps {
  profiles: RestoredData[];
  projectName?: string;
  onClose: () => void;
  onUpdateProfile: (id: string, updates: Partial<RestoredData>) => void;
  theme?: string;
}

export const OutreachComposer: React.FC<OutreachComposerProps> = ({
  profiles, projectName = '', onClose, onUpdateProfile, theme = 'dark'
}) => {
  const [templates, setTemplates] = useState<OutreachTemplate[]>(loadTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [sectionFilter, setSectionFilter] = useState<OutreachTemplate['section'] | 'all'>('all');
  const [activeProfileIdx, setActiveProfileIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkGenProgress, setBulkGenProgress] = useState({ current: 0, total: 0 });
  const [generatedDrafts, setGeneratedDrafts] = useState<Record<string, { subject: string; body: string }>>(() => {
    const initial: Record<string, { subject: string; body: string }> = {};
    profiles.forEach(p => {
      if (p.outreachDraftSubject || p.outreachDraftBody) {
        initial[p.id] = {
          subject: p.outreachDraftSubject || '',
          body: p.outreachDraftBody || '',
        };
      }
    });
    return initial;
  });
  const [copied, setCopied] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [localSamples, setLocalSamples] = useState<string[]>([]);
  const [composerTab, setComposerTab] = useState<'editor' | 'history'>('editor');

  React.useEffect(() => {
    setComposerTab('editor');
  }, [activeProfileIdx]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSection, setNewTemplateSection] = useState<OutreachTemplate['section']>('email');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Persistent Projects State
  const [projects, setProjects] = useState<OutreachProject[]>(() => loadProjects(projectName));
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || 'default_project');

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const updateActiveProjectField = (field: keyof OutreachProject, value: string) => {
    if (!activeProject) return;
    const updated = projects.map(p => p.id === activeProject.id ? { ...p, [field]: value, updatedAt: new Date().toISOString() } : p);
    setProjects(updated);
    saveProjects(updated);
  };

  const handleCreateNewProject = () => {
    const newProj: OutreachProject = {
      id: `proj_${Date.now()}`,
      name: `Dự án mới #${projects.length + 1}`,
      brand: '',
      sow: '',
      deadline: '',
      notes: '',
      conversationContext: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...projects, newProj];
    setProjects(updated);
    saveProjects(updated);
    setSelectedProjectId(newProj.id);
  };

  const openTrainingModal = () => {
    setLocalSamples(activeProject?.conversationSamples || []);
    setShowTrainingModal(true);
  };

  const handleSaveSamples = () => {
    if (!activeProject) return;
    const cleanSamples = localSamples.map(s => s.trim()).filter(Boolean);
    const contextText = cleanSamples[0] || '';
    const updated = projects.map(p => p.id === activeProject.id ? { 
      ...p, 
      conversationSamples: cleanSamples,
      conversationContext: contextText,
      updatedAt: new Date().toISOString() 
    } : p);
    setProjects(updated);
    saveProjects(updated);
    setShowTrainingModal(false);
  };

  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      alert('Không thể xóa dự án duy nhất còn lại.');
      return;
    }
    if (!confirm(`Xóa dự án "${activeProject?.name}" này?`)) return;
    const updated = projects.filter(p => p.id !== selectedProjectId);
    setProjects(updated);
    saveProjects(updated);
    setSelectedProjectId(updated[0].id);
  };

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200';
  const overlayBg = isDark ? 'bg-black/80' : 'bg-slate-900/50';
  const textP = isDark ? 'text-slate-100' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const borderC = isDark ? 'border-white/10' : 'border-slate-200';
  const inputBg = isDark ? 'bg-black/20 border-white/10 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400';
  const sidebarBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50';
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200';

  const activeProfile = profiles[activeProfileIdx] || null;

  const activeDraft = useMemo(() => {
    if (!activeProfile) return { subject: '', body: '' };
    return generatedDrafts[activeProfile.id] || { subject: '', body: '' };
  }, [generatedDrafts, activeProfile?.id]);

  const setDraft = (profileId: string, subject: string, body: string) => {
    setGeneratedDrafts(prev => ({
      ...prev,
      [profileId]: { subject, body }
    }));
  };

  const filteredTemplates = useMemo(() => {
    if (sectionFilter === 'all') return templates;
    return templates.filter(t => t.section === sectionFilter);
  }, [templates, sectionFilter]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || null;

  const handleSaveTemplate = (template: OutreachTemplate) => {
    const updated = templates.map(t => t.id === template.id ? template : t);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const handleSaveTemplateAction = () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;

    if (editingTemplateId) {
      // Editing
      const updated = templates.map(t => {
        if (t.id === editingTemplateId) {
          return {
            ...t,
            name: newTemplateName.trim(),
            section: newTemplateSection,
            subject: newTemplateSubject.trim() || undefined,
            body: newTemplateBody.trim(),
            variables: extractVariables(newTemplateBody),
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });
      setTemplates(updated);
      saveTemplates(updated);
      setSelectedTemplateId(editingTemplateId);
      setEditingTemplateId(null);
    } else {
      // Creating
      const newTemplate: OutreachTemplate = {
        id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: newTemplateName.trim(),
        section: newTemplateSection,
        subject: newTemplateSubject.trim() || undefined,
        body: newTemplateBody.trim(),
        variables: extractVariables(newTemplateBody),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [...templates, newTemplate];
      setTemplates(updated);
      saveTemplates(updated);
      setSelectedTemplateId(newTemplate.id);
    }

    setShowNewTemplate(false);
    setNewTemplateName('');
    setNewTemplateSection('email');
    setNewTemplateSubject('');
    setNewTemplateBody('');
  };

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('Xoá template này?')) return;
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    if (selectedTemplateId === id && updated.length > 0) {
      setSelectedTemplateId(updated[0].id);
    }
  };

  function extractVariables(text: string): string[] {
    const matches = text.match(/\{\{[^}]+\}\}/g) || [];
    return [...new Set(matches)];
  }

  const handleGenerate = async () => {
    if (!activeProfile || !selectedTemplate) return;
    setIsGenerating(true);
    setDraft(activeProfile.id, '', '');

    const aiApiKey = localStorage.getItem('scout_hub_gemini_key') || '';
    if (!aiApiKey) {
      setDraft(activeProfile.id, '', '⚠️ Chưa cấu hình AI API Key. Vui lòng vào Cài đặt để thêm key.');
      setIsGenerating(false);
      return;
    }

    let aiBaseUrl = localStorage.getItem('scout_hub_ai_base_url') || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    if (!aiBaseUrl.endsWith('/')) aiBaseUrl += '/';
    const aiModel = localStorage.getItem('scout_hub_ai_model') || 'gemini-2.5-flash';

    const sectionTypeLabel = SECTION_LABELS[selectedTemplate.section] || 'tin nhắn';
    const bioTruncated = (activeProfile.bio || '').slice(0, 300);

    const prompt = `Bạn là một Booker/Outreach Specialist kỳ cựu chuyên đi booking KOLS/Influencers tại Việt Nam. Bạn viết tin nhắn/email tiếp cận cực kỳ tự nhiên, gãy gọn, tinh tế, tỷ lệ phản hồi cao, hoàn toàn KHÔNG CÓ CẢM GIÁC LÀ AI VIẾT.

TEMPLATE PHÁT THẢO KHUNG (Sử dụng để tham khảo cấu trúc):
"""
${selectedTemplate.body}
"""

THÔNG TIN DỰ ÁN CẦN THỜI THƯỢNG:
- Brand/Nhãn hàng: ${activeProject?.brand || '(Chưa xác định)'}
- Tên dự án/Campaign: ${activeProject?.name || '(Chưa xác định)'}
- SOW (Phạm vi công việc): ${activeProject?.sow || '(Chưa xác định)'}
- Timeline/Deadline: ${activeProject?.deadline || '(Chưa xác định)'}
- Ghi chú chiến dịch: ${activeProject?.notes || '(Không có)'}

${activeProject?.conversationSamples && activeProject.conversationSamples.length > 0 ? `VĂN PHONG MẪU CỦA BOOKER (AI bắt chước chính xác phong cách xưng hô, emoji, cấu trúc câu và độ dài từ các mẫu thực tế này):
${activeProject.conversationSamples.map((sample, idx) => `--- MẪU #${idx + 1} ---\n${sample}`).join('\n\n')}` : `VĂN PHONG MẪU CỦA BOOKER (Hãy bắt chước 100% đại từ xưng hô, emoji, cấu trúc câu và sự ngắn gọn từ tin nhắn cũ này):
"""
${activeProject?.conversationContext || 'Tự nhiên, lịch sự, thân thiện, dùng xưng hô "mình - bạn" hoặc xưng tên KOL nếu phù hợp.'}
"""`}

${activeProfile.outreachHistory && activeProfile.outreachHistory.length > 0 ? `LỊCH SỬ TIN NHẮN ĐÃ GỬI TRƯỚC ĐÓ CHO KOL NÀY (Hãy viết tin nhắn follow-up tự nhiên, tuyệt đối KHÔNG lặp lại nguyên văn nội dung cũ, chỉ khéo léo gợi nhớ hoặc hỏi thăm nhẹ nhàng):
${activeProfile.outreachHistory.map((h, i) => `--- TIN NHẮN GỬI LẦN ${i + 1} (${h.sentAt.split('T')[0]}) ---\nSubject: ${h.subject}\nBody: ${h.body}`).join('\n\n')}` : ''}

THÔNG TIN ĐỐI TƯỢNG TIẾP CẬN (KOL/INFLUENCER):
- Tên/Nickname: ${activeProfile.nickname || '(Không rõ)'}
- Platform hoạt động: ${activeProfile.platform || 'TikTok'}
- Số lượng người theo dõi (Followers): ${formatFollowers(activeProfile.followers)}
- Chủ đề/Niche chính: ${activeProfile.profileNiche || '(Chưa phân loại)'}
- Giới thiệu bản thân (Bio): ${bioTruncated || '(Không có)'}
- Đường dẫn trang cá nhân (URL): ${activeProfile.url || ''}

QUY TẮC VIẾT OUTREACH ĐỈNH CAO:
1. KHÔNG DÙNG CÁC CỤM TỪ RẬP KHUÔN CỦA AI: Tuyệt đối tránh "Hy vọng bạn có một ngày tốt lành", "Tôi vô cùng ấn tượng với kênh của bạn", "Tôi viết thư này để", "Kính gửi", "Hân hạnh được liên hệ", v.v. Hãy mở đầu thẳng thắn, tự nhiên như hai người trong ngành nói chuyện với nhau.
2. CÁ NHÂN HÓA SÂU SẮC: Nhìn vào Bio và Niche của KOL để đưa ra 1 lý do cực kỳ hợp lý vì sao bạn muốn book bạn này (ví dụ: "Thấy bạn hay review skincare rất chân thực...", "Mình xem clip phối đồ của bạn rất có gu...").
3. BẮT CHƯỚC VĂN PHONG ĐÃ FEED: Nếu mục VĂN PHONG MẪU CỦA BOOKER có nội dung, hãy học hỏi đại xưng hô (mình-bạn, ad-bạn, em-chị,...), cách ngắt dòng, cách chèn emoji và sự ngắn gọn từ đó.
4. THÔNG TIN RÕ RÀNG: Lồng ghép khéo léo thông tin Brand, Dự án, SOW và Deadline vào nội dung một cách tự nhiên, không gượng ép.
5. CHI TIẾT ĐỊNH DẠNG:
   - Nếu là Email (section: email): Phải tạo tiêu đề email cuốn hút, bắt đầu bằng "Subject: [Tiêu đề email]".
   - Nếu là DM (TikTok, Facebook, Instagram): Viết siêu ngắn gọn, cuốn hút, thân thiện, thích hợp để đọc trên điện thoại.
6. Ngôn ngữ: Tiếng Việt. Chỉ xuất ra nội dung tin nhắn/email hoàn chỉnh, tuyệt đối không thêm lời giới thiệu, lời giải thích hay ký hiệu Markdown thừa.`;

    try {
      const response = await fetch(`${aiBaseUrl}chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.75,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        setDraft(activeProfile.id, '', `⚠️ Lỗi API (${response.status}). Kiểm tra AI Key và Base URL trong Cài đặt.`);
        setIsGenerating(false);
        return;
      }

      const resData = await response.json();
      let text = resData?.choices?.[0]?.message?.content?.trim() || '';

      let subjectText = '';
      let bodyText = text;

      // Extract subject if email
      if (selectedTemplate.section === 'email') {
        const subjectMatch = text.match(/^Subject:\s*(.+?)$/im);
        if (subjectMatch) {
          subjectText = subjectMatch[1].trim();
          bodyText = text.replace(/^Subject:\s*.+?$/im, '').trim();
        }
      }

      setDraft(activeProfile.id, subjectText, bodyText);

      // Auto-update outreach status
      if (activeProfile) {
        onUpdateProfile(activeProfile.id, { 
          outreachStatus: 'Drafted',
          outreachDraftSubject: subjectText,
          outreachDraftBody: bodyText
        });
      }
    } catch (e: any) {
      setDraft(activeProfile.id, '', `⚠️ Lỗi: ${e.message}`);
    }
    setIsGenerating(false);
  };

  const handleBulkGenerate = async () => {
    if (profiles.length === 0 || !selectedTemplate) return;
    setIsBulkGenerating(true);
    setBulkGenProgress({ current: 0, total: profiles.length });

    const aiApiKey = localStorage.getItem('scout_hub_gemini_key') || '';
    if (!aiApiKey) {
      alert('⚠️ Chưa cấu hình AI API Key. Vui lòng vào Cài đặt để thêm key.');
      setIsBulkGenerating(false);
      return;
    }

    let aiBaseUrl = localStorage.getItem('scout_hub_ai_base_url') || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    if (!aiBaseUrl.endsWith('/')) aiBaseUrl += '/';
    const aiModel = localStorage.getItem('scout_hub_ai_model') || 'gemini-2.5-flash';

    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      setBulkGenProgress({ current: i + 1, total: profiles.length });
      setDraft(p.id, '', 'Đang tạo bằng AI...');

      const sectionTypeLabel = SECTION_LABELS[selectedTemplate.section] || 'tin nhắn';
      const bioTruncated = (p.bio || '').slice(0, 300);

      const prompt = `Bạn là một Booker/Outreach Specialist kỳ cựu chuyên đi booking KOLS/Influencers tại Việt Nam. Bạn viết tin nhắn/email tiếp cận cực kỳ tự nhiên, gãy gọn, tinh tế, tỷ lệ phản hồi cao, hoàn toàn KHÔNG CÓ CẢM GIÁC LÀ AI VIẾT.

TEMPLATE PHÁT THẢO KHUNG (Sử dụng để tham khảo cấu trúc):
"""
${selectedTemplate.body}
"""

THÔNG TIN DỰ ÁN CẦN THỜI THƯỢNG:
- Brand/Nhãn hàng: ${activeProject?.brand || '(Chưa xác định)'}
- Tên dự án/Campaign: ${activeProject?.name || '(Chưa xác định)'}
- SOW (Phạm vi công việc): ${activeProject?.sow || '(Chưa xác định)'}
- Timeline/Deadline: ${activeProject?.deadline || '(Chưa xác định)'}
- Ghi chú chiến dịch: ${activeProject?.notes || '(Không có)'}

VĂN PHONG MẪU CỦA BOOKER (Hãy bắt chước 100% đại từ xưng hô, emoji, cấu trúc câu và sự ngắn gọn từ tin nhắn cũ này):
"""
${activeProject?.conversationContext || 'Tự nhiên, lịch sự, thân thiện, dùng xưng hô "mình - bạn" hoặc xưng tên KOL nếu phù hợp.'}
"""

THÔNG TIN ĐỐI TƯỢNG TIẾP CẬN (KOL/INFLUENCER):
- Tên/Nickname: ${p.nickname || '(Không rõ)'}
- Platform hoạt động: ${p.platform || 'TikTok'}
- Số lượng người theo dõi (Followers): ${formatFollowers(p.followers)}
- Chủ đề/Niche chính: ${p.profileNiche || '(Chưa phân loại)'}
- Giới thiệu bản thân (Bio): ${bioTruncated || '(Không có)'}
- Đường dẫn trang cá nhân (URL): ${p.url || ''}

QUY TẮC VIẾT OUTREACH ĐỈNH CAO:
1. KHÔNG DÙNG CÁC CỤM TỪ RẬP KHUÔN CỦA AI: Tuyệt đối tránh "Hy vọng bạn có một ngày tốt lành", "Tôi vô cùng ấn tượng với kênh của bạn", "Tôi viết thư này để", "Kính gửi", "Hân hạnh được liên hệ", v.v. Hãy mở đầu thẳng thắn, tự nhiên như hai người trong ngành nói chuyện với nhau.
2. CÁ NHÂN HÓA SÂU SẮC: Nhìn vào Bio và Niche của KOL để đưa ra 1 lý do cực kỳ hợp lý vì sao bạn muốn book bạn này (ví dụ: "Thấy bạn hay review skincare rất chân thực...", "Mình xem clip phối đồ của bạn rất có gu...").
3. BẮT CHƯỚC VĂN PHONG ĐÃ FEED: Nếu mục VĂN PHONG MẪU CỦA BOOKER có nội dung, hãy học hỏi đại xưng hô (mình-bạn, ad-bạn, em-chị,...), cách ngắt dòng, cách chèn emoji và sự ngắn gọn từ đó.
4. THÔNG TIN RÕ RÀNG: Lồng ghép khéo léo thông tin Brand, Dự án, SOW và Deadline vào nội dung một cách tự nhiên, không gượng ép.
5. CHI TIẾT ĐỊNH DẠNG:
   - Nếu là Email (section: email): Phải tạo tiêu đề email cuốn hút, bắt đầu bằng "Subject: [Tiêu đề email]".
   - Nếu là DM (TikTok, Facebook, Instagram): Viết siêu ngắn gọn, cuốn hút, thân thiện, thích hợp để đọc trên điện thoại.
6. Ngôn ngữ: Tiếng Việt. Chỉ xuất ra nội dung tin nhắn/email hoàn chỉnh, tuyệt đối không thêm lời giới thiệu, lời giải thích hay ký hiệu Markdown thừa.`;

      try {
        const response = await fetch(`${aiBaseUrl}chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.75,
            max_tokens: 800,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          let text = resData?.choices?.[0]?.message?.content?.trim() || '';
          let subjectText = '';
          let bodyText = text;

          if (selectedTemplate.section === 'email') {
            const subjectMatch = text.match(/^Subject:\s*(.+?)$/im);
            if (subjectMatch) {
              subjectText = subjectMatch[1].trim();
              bodyText = text.replace(/^Subject:\s*.+?$/im, '').trim();
            }
          }

          setGeneratedDrafts(prev => ({
            ...prev,
            [p.id]: { subject: subjectText, body: bodyText }
          }));

          onUpdateProfile(p.id, { 
            outreachStatus: 'Drafted',
            outreachDraftSubject: subjectText,
            outreachDraftBody: bodyText
          });
        } else {
          setGeneratedDrafts(prev => ({
            ...prev,
            [p.id]: { subject: '', body: `⚠️ Lỗi API (${response.status}).` }
          }));
        }
      } catch (e: any) {
        setGeneratedDrafts(prev => ({
          ...prev,
          [p.id]: { subject: '', body: `⚠️ Lỗi: ${e.message}` }
        }));
      }
    }
    setIsBulkGenerating(false);
  };

  const handleCopy = async () => {
    const fullContent = activeDraft.subject
      ? `Subject: ${activeDraft.subject}\n\n${activeDraft.body}`
      : activeDraft.body;
    await navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkSent = () => {
    if (activeProfile) {
      const activeDraft = generatedDrafts[activeProfile.id] || { subject: '', body: '' };
      const newHistoryItem = {
        id: `outreach_${Date.now()}`,
        subject: activeDraft.subject || '',
        body: activeDraft.body || '',
        sentAt: new Date().toISOString(),
      };
      
      const existingHistory = activeProfile.outreachHistory || [];
      
      onUpdateProfile(activeProfile.id, { 
        outreachStatus: 'Sent',
        outreachHistory: [...existingHistory, newHistoryItem]
      });
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg}`}>
      <div className={`w-full max-w-6xl h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${modalBg}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderC} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${textP}`}>AI Outreach Composer</h2>
              <p className={`text-[11px] ${textM}`}>
                {profiles.length > 1 ? `${profiles.length} profiles · ` : ''}
                Soạn tin nhắn/email mời hợp tác KOL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profiles.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveProfileIdx(Math.max(0, activeProfileIdx - 1))}
                  disabled={activeProfileIdx === 0}
                  className={`p-1.5 rounded-lg disabled:opacity-30 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className={`text-xs font-medium ${textS}`}>{activeProfileIdx + 1}/{profiles.length}</span>
                <button
                  onClick={() => setActiveProfileIdx(Math.min(profiles.length - 1, activeProfileIdx + 1))}
                  disabled={activeProfileIdx === profiles.length - 1}
                  className={`p-1.5 rounded-lg disabled:opacity-30 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className={`w-72 shrink-0 border-r ${borderC} ${sidebarBg} flex flex-col overflow-hidden`}>
            {/* Section filter */}
            <div className={`px-4 py-3 border-b ${borderC}`}>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value as any)}
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              >
                <option value="all">Tất cả section</option>
                {SECTION_OPTIONS.map(s => (
                  <option key={s} value={s}>{SECTION_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {filteredTemplates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all group ${
                    selectedTemplateId === tmpl.id
                      ? isDark ? 'bg-violet-600/15 border border-violet-500/20 text-violet-300' : 'bg-violet-50 border border-violet-200 text-violet-700'
                      : isDark ? 'hover:bg-white/[0.04] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{tmpl.name}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplateId(tmpl.id);
                          setNewTemplateName(tmpl.name);
                          setNewTemplateSection(tmpl.section);
                          setNewTemplateSubject(tmpl.subject || '');
                          setNewTemplateBody(tmpl.body);
                          setShowNewTemplate(true);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                        title="Sửa template"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                        title="Xoá template"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <span className={`text-[10px] ${textM}`}>{SECTION_LABELS[tmpl.section]}</span>
                </button>
              ))}
            </div>

            {/* Add template button */}
            <div className={`px-3 py-3 border-t ${borderC}`}>
              {showNewTemplate ? (
                <div className="space-y-2">
                  <div className={`text-[10px] font-bold ${textP}`}>{editingTemplateId ? 'SỬA TEMPLATE' : 'THÊM TEMPLATE MỚI'}</div>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Tên template"
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
                  />
                  <select
                    value={newTemplateSection}
                    onChange={(e) => setNewTemplateSection(e.target.value as OutreachTemplate['section'])}
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
                  >
                    {SECTION_OPTIONS.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
                  </select>
                  {newTemplateSection === 'email' && (
                    <input
                      type="text"
                      value={newTemplateSubject}
                      onChange={(e) => setNewTemplateSubject(e.target.value)}
                      placeholder="Subject line"
                      className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
                    />
                  )}
                  <textarea
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    placeholder="Nội dung mẫu... Dùng {{tên_kol}}, {{brand}}, {{tên_dự_án}}, {{sow}}, {{deadline}} cho biến"
                    rows={5}
                    className={`w-full px-2 py-1.5 text-xs rounded-lg border resize-none ${inputBg}`}
                  />
                  <div className="flex gap-1.5">
                    <button onClick={handleSaveTemplateAction} className="flex-1 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                      {editingTemplateId ? 'Cập nhật' : 'Lưu'}
                    </button>
                    <button onClick={() => { setShowNewTemplate(false); setEditingTemplateId(null); setNewTemplateName(''); setNewTemplateSection('email'); setNewTemplateSubject(''); setNewTemplateBody(''); }} className={`px-3 py-1.5 text-xs rounded-lg border ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm Template
                </button>
              )}
            </div>

            {/* Project Brief */}
            <div className={`px-3 py-3 border-t ${borderC} space-y-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Briefcase className={`h-3.5 w-3.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${textP}`}>Dự án & Style Feed</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateNewProject}
                    className={`text-[10px] font-semibold transition-colors ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}
                    title="Tạo dự án mới"
                  >
                    + Mới
                  </button>
                  {projects.length > 1 && (
                    <button
                      onClick={handleDeleteProject}
                      className="text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors"
                      title="Xóa dự án"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {/* Selector */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name || 'Dự án không tên'}</option>
                ))}
              </select>

              <input
                type="text"
                value={activeProject?.brand || ''}
                onChange={(e) => updateActiveProjectField('brand', e.target.value)}
                placeholder="Brand / Nhãn hàng"
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              />
              <input
                type="text"
                value={activeProject?.name || ''}
                onChange={(e) => updateActiveProjectField('name', e.target.value)}
                placeholder="Tên dự án / Campaign"
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              />
              <input
                type="text"
                value={activeProject?.sow || ''}
                onChange={(e) => updateActiveProjectField('sow', e.target.value)}
                placeholder="SOW (VD: 1 Video + 1 Photo)"
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              />
              <input
                type="text"
                value={activeProject?.deadline || ''}
                onChange={(e) => updateActiveProjectField('deadline', e.target.value)}
                placeholder="Deadline (VD: 15/06)"
                className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`}
              />
              <textarea
                value={activeProject?.notes || ''}
                onChange={(e) => updateActiveProjectField('notes', e.target.value)}
                placeholder="Ghi chú thêm..."
                rows={2}
                className={`w-full px-2 py-1.5 text-xs rounded-lg border resize-none ${inputBg}`}
              />
              <button
                onClick={openTrainingModal}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  activeProject?.conversationSamples?.length
                    ? 'border-violet-500/30 bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 shadow-md shadow-violet-500/5'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                💬 Huấn luyện Văn phong AI {activeProject?.conversationSamples?.length ? `(${activeProject.conversationSamples.length})` : ''}
              </button>
              <div className={`text-[9px] ${textM} leading-tight text-center mt-1`}>
                * Cung cấp mẫu đối thoại thô để AI phân tích cấu trúc, xưng hô và biểu cảm tự động.
              </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Profile Context Card */}
            {activeProfile && (
              <div className={`px-5 py-3 border-b ${borderC} shrink-0`}>
                <div className="flex items-center gap-3">
                  {activeProfile.profilePic ? (
                    <img src={activeProfile.profilePic} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <Mail className={`h-5 w-5 ${textM}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${textP} truncate`}>{activeProfile.nickname || '—'}</span>
                      {activeProfile.channelId && <span className={`text-xs ${textM}`}>@{activeProfile.channelId}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-[11px] ${textS}`}>{activeProfile.platform || 'TikTok'}</span>
                      <span className={`text-[11px] font-medium ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>{formatFollowers(activeProfile.followers)} followers</span>
                      {activeProfile.profileNiche && <span className={`text-[11px] ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>{activeProfile.profileNiche}</span>}
                      {activeProfile.outreachStatus && activeProfile.outreachStatus !== 'Not Started' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          activeProfile.outreachStatus === 'Drafted' ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700') :
                          activeProfile.outreachStatus === 'Sent' ? (isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700') :
                          isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'
                        }`}>{activeProfile.outreachStatus}</span>
                      )}
                    </div>
                  </div>
                  {activeProfile.bio && (
                    <p className={`text-[10px] ${textM} max-w-xs truncate hidden lg:block`}>{activeProfile.bio.slice(0, 100)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab Navigation in Compose Area */}
            <div className="flex border-b border-white/5 bg-white/[0.01] px-5 py-2 gap-4 shrink-0">
              <button
                onClick={() => setComposerTab('editor')}
                className={`py-1.5 text-xs font-semibold border-b-2 transition-all ${
                  composerTab === 'editor'
                    ? 'border-violet-500 text-violet-500'
                    : 'border-transparent text-slate-400 hover:text-violet-400'
                }`}
              >
                📝 Nháp & Soạn Thảo (AI)
              </button>
              <button
                onClick={() => setComposerTab('history')}
                className={`py-1.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  composerTab === 'history'
                    ? 'border-violet-500 text-violet-500'
                    : 'border-transparent text-slate-400 hover:text-violet-400'
                }`}
              >
                🕒 Lịch sử tiếp cận {activeProfile?.outreachHistory?.length ? `(${activeProfile.outreachHistory.length})` : ''}
              </button>
            </div>

            {/* Compose Area */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {composerTab === 'editor' ? (
                <div className="p-5 space-y-4">
                  {/* Template Preview */}
                  {selectedTemplate && !activeDraft.body && !isGenerating && (
                    <div className={`rounded-xl border p-4 ${cardBg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                          <span className={`text-xs font-semibold ${textP}`}>Template: {selectedTemplate.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {SECTION_LABELS[selectedTemplate.section]}
                          </span>
                        </div>
                      </div>
                      {selectedTemplate.subject && (
                        <div className={`text-xs mb-2 ${textS}`}>
                          <span className="font-medium">Subject:</span> {selectedTemplate.subject}
                        </div>
                      )}
                      <pre className={`text-xs ${textS} whitespace-pre-wrap font-sans leading-relaxed`}>{selectedTemplate.body}</pre>
                      {selectedTemplate.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {selectedTemplate.variables.map(v => (
                            <span key={v} className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${isDark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}>{v}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generated Content */}
                  {(activeDraft.body || isGenerating) && (
                    <div className={`rounded-xl border p-4 ${cardBg}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className={`h-4 w-4 ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`} />
                          <span className={`text-xs font-semibold ${textP}`}>Nội dung đã generate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={handleGenerate} disabled={isGenerating} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} title="Regenerate">
                            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {isGenerating ? (
                        <div className="flex items-center justify-center py-8 gap-2">
                          <Loader2 className={`h-5 w-5 animate-spin ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                          <span className={`text-sm ${textS}`}>Đang soạn nội dung...</span>
                        </div>
                      ) : (
                        <>
                          {(selectedTemplate?.section === 'email' || activeDraft.subject) && (
                            <div className="mb-3">
                              <label className={`text-[10px] font-medium ${textM} block mb-1`}>Subject</label>
                              <input
                                type="text"
                                value={activeDraft.subject}
                                onChange={(e) => setDraft(activeProfile.id, e.target.value, activeDraft.body)}
                                className={`w-full px-3 py-2 text-sm rounded-lg border ${inputBg}`}
                              />
                            </div>
                          )}
                          <textarea
                            value={activeDraft.body}
                            onChange={(e) => setDraft(activeProfile.id, activeDraft.subject, e.target.value)}
                            rows={12}
                            className={`w-full px-3 py-2 text-sm rounded-xl border resize-none leading-relaxed ${inputBg}`}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {!activeProfile?.outreachHistory || activeProfile.outreachHistory.length === 0 ? (
                    <div className={`text-xs py-12 text-center ${textM}`}>
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Chưa có lịch sử tiếp cận nào được ghi nhận cho KOL này.</p>
                    </div>
                  ) : (
                    [...activeProfile.outreachHistory].reverse().map((history, idx) => (
                      <div key={history.id || idx} className={`rounded-xl border p-4 space-y-2.5 relative group ${cardBg}`}>
                        <div className="flex items-center justify-between border-b pb-1.5 border-white/5">
                          <span className={`text-[10px] font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                            Lần {activeProfile.outreachHistory.length - idx}: {new Date(history.sentAt).toLocaleString('vi-VN')}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                            Sent ✓
                          </span>
                        </div>
                        {history.subject && (
                          <div className={`text-xs font-semibold ${textP}`}>
                            Tiêu đề: {history.subject}
                          </div>
                        )}
                        <pre className={`text-xs ${textS} whitespace-pre-wrap font-sans leading-relaxed`}>{history.body}</pre>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className={`px-5 py-3 border-t ${borderC} flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isBulkGenerating || !activeProfile || !selectedTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/20"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating ? 'Đang soạn...' : activeDraft.body ? 'Regenerate' : 'Generate với AI'}
                </button>

                {profiles.length > 1 && (
                  <button
                    onClick={handleBulkGenerate}
                    disabled={isGenerating || isBulkGenerating || !selectedTemplate}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border rounded-xl disabled:opacity-40 transition-all shadow-sm ${
                      isDark 
                        ? 'border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20' 
                        : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                    }`}
                  >
                    {isBulkGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                        <span>Đang tạo {bulkGenProgress.current}/{bulkGenProgress.total}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-fuchsia-400" />
                        <span>🪄 Tạo hàng loạt ({profiles.length})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeDraft.body && (
                  <>
                    <button
                      onClick={handleMarkSent}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                        isDark ? 'border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Đánh dấu Sent
                    </button>
                    <button
                      onClick={handleCopy}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl transition-colors ${
                        copied
                          ? 'bg-emerald-600 text-white'
                          : isDark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {copied ? <><CheckCircle className="h-3.5 w-3.5" /> Đã copy!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTrainingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${modalBg}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${borderC} shrink-0`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${textP}`}>Huấn luyện Văn phong AI</h3>
                  <p className={`text-[11px] ${textM}`}>Cung cấp 1-5 tin nhắn mẫu để AI học phong cách của bạn</p>
                </div>
              </div>
              <button
                onClick={() => setShowTrainingModal(false)}
                className={`p-2 rounded-xl transition-colors hover:bg-white/10 ${textS}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${isDark ? 'bg-violet-950/20 border-violet-500/10 text-slate-300' : 'bg-violet-50 border-violet-100 text-slate-600'}`}>
                💡 <b>Mẹo nâng tầm văn phong:</b> Hãy cung cấp các đoạn hội thoại hoặc thư mời thực tế mà bạn đã gửi thành công. AI sẽ tự động phân tích:
                <ul className="list-disc pl-5 mt-1 space-y-0.5 font-medium">
                  <li>Đại từ xưng hô (mình - bạn, ad - cậu, em - chị...)</li>
                  <li>Cách sử dụng biểu cảm (emoji)</li>
                  <li>Độ dài, tần suất ngắt dòng, cách đặt câu hỏi gợi mở</li>
                </ul>
              </div>

              <div className="space-y-3">
                {localSamples.map((sample, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border relative group ${cardBg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>MẪU TIN NHẮN #{idx + 1}</span>
                      <button
                        onClick={() => setLocalSamples(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 p-0.5 rounded transition-opacity"
                        title="Xóa mẫu"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={sample}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocalSamples(prev => prev.map((s, i) => i === idx ? val : s));
                      }}
                      rows={4}
                      placeholder="Dán tin nhắn thô hoặc email mẫu đã gửi thành công ở đây..."
                      className={`w-full px-3 py-2 text-xs rounded-lg border resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${inputBg}`}
                    />
                  </div>
                ))}

                {localSamples.length < 5 && (
                  <button
                    onClick={() => setLocalSamples(prev => [...prev, ''])}
                    className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                      isDark 
                        ? 'border-slate-800 text-slate-400 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-950/5' 
                        : 'border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50'
                    }`}
                  >
                    + Thêm mẫu đối thoại mới
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t ${borderC} flex items-center justify-end gap-2 shrink-0`}>
              <button
                onClick={() => setShowTrainingModal(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  isDark ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                Hủy
              </button>
              <button
                onClick={handleSaveSamples}
                className="px-4 py-2 text-xs font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-600/20"
              >
                Lưu cấu hình mẫu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
