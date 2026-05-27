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
  const [generatedDrafts, setGeneratedDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [copied, setCopied] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSection, setNewTemplateSection] = useState<OutreachTemplate['section']>('email');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Project brief state
  const [brand, setBrand] = useState('');
  const [projectBrief, setProjectBrief] = useState(projectName);
  const [sowBrief, setSowBrief] = useState('');
  const [deadline, setDeadline] = useState('');
  const [briefNotes, setBriefNotes] = useState('');
  const [conversationContext, setConversationContext] = useState('');

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

    const prompt = `Bạn là chuyên gia viết email/tin nhắn outreach cho agency làm việc với KOLs/Influencers.

TEMPLATE MẪU (để nắm giọng văn và cấu trúc):
"""
${selectedTemplate.body}
"""

THÔNG TIN DỰ ÁN:
- Brand: ${brand || '(chưa điền)'}
- Tên dự án: ${projectBrief || projectName || '(chưa điền)'}
- SOW: ${sowBrief || '(chưa điền)'}
- Deadline: ${deadline || '(chưa điền)'}
- Ghi chú bổ sung: ${briefNotes || '(không có)'}
${conversationContext ? `- TIN NHẮN CŨ / CONTEXT MẪU ĐÃ FEED (hãy viết văn phong giống như thế này):\n"""\n${conversationContext}\n"""` : ''}

THÔNG TIN PROFILE:
- Tên KOL: ${activeProfile.nickname || '(không rõ)'}
- Platform: ${activeProfile.platform || 'TikTok'}
- Followers: ${formatFollowers(activeProfile.followers)}
- Niche: ${activeProfile.profileNiche || '(chưa phân loại)'}
- Bio: ${bioTruncated || '(không có)'}
- Link: ${activeProfile.url || ''}

YÊU CẦU:
1. Viết nội dung ${sectionTypeLabel} mời hợp tác, giọng chuyên nghiệp, thân thiện, tự nhiên
2. Adapt nội dung theo phong cách/niche của KOL (nếu biết)
3. Mention cụ thể lý do vì sao KOL phù hợp với dự án (dựa trên bio, niche, followers)
4. Ngắn gọn, súc tích, dễ đọc, không quá 200 từ
5. Giữ format tương tự template mẫu (đoạn văn, emoji nếu có)${conversationContext ? ' và mô phỏng chính xác đại từ xưng hô, văn phong của TIN NHẮN CŨ / CONTEXT MẪU đã cung cấp' : ''}
6. Ngôn ngữ: Tiếng Việt
${selectedTemplate.section === 'email' ? '7. Thêm dòng Subject line phù hợp ở đầu, format: Subject: [nội dung]' : ''}

Chỉ trả về nội dung tin nhắn/email hoàn chỉnh, không giải thích gì thêm.`;

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
          temperature: 0.7,
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
        onUpdateProfile(activeProfile.id, { outreachStatus: 'Drafted' });
      }
    } catch (e: any) {
      setDraft(activeProfile.id, '', `⚠️ Lỗi: ${e.message}`);
    }
    setIsGenerating(false);
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
      onUpdateProfile(activeProfile.id, { outreachStatus: 'Sent' });
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
              <div className="flex items-center gap-1.5 mb-1">
                <Briefcase className={`h-3.5 w-3.5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                <span className={`text-[11px] font-semibold ${textP}`}>Project Brief & Style Feed</span>
              </div>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand / Nhãn hàng" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
              <input type="text" value={projectBrief} onChange={(e) => setProjectBrief(e.target.value)} placeholder="Tên dự án" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
              <input type="text" value={sowBrief} onChange={(e) => setSowBrief(e.target.value)} placeholder="SOW (VD: 1 Video + 1 Photo)" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
              <input type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Deadline (VD: 15/06)" className={`w-full px-2 py-1.5 text-xs rounded-lg border ${inputBg}`} />
              <textarea value={briefNotes} onChange={(e) => setBriefNotes(e.target.value)} placeholder="Ghi chú thêm..." rows={2} className={`w-full px-2 py-1.5 text-xs rounded-lg border resize-none ${inputBg}`} />
              <textarea value={conversationContext} onChange={(e) => setConversationContext(e.target.value)} placeholder="Feed tin nhắn cũ để AI học văn phong..." rows={3} className={`w-full px-2 py-1.5 text-[10px] rounded-lg border resize-none leading-relaxed ${inputBg}`} />
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

            {/* Compose Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

            {/* Action Bar */}
            <div className={`px-5 py-3 border-t ${borderC} flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !activeProfile || !selectedTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/20"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating ? 'Đang soạn...' : activeDraft.body ? 'Regenerate' : 'Generate với AI'}
                </button>
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
    </div>
  );
};
