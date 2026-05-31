import React, { useState, useEffect } from 'react';
import { UniversalExtractor } from './components/UniversalExtractor';
import { ScoutCRM } from './components/ScoutCRM';
import CampaignManager from './components/execution/CampaignManager';
import ExecutionKanban from './components/execution/ExecutionKanban';
import { RestoredData, Campaign, ExecutionProfile, WorkflowStatus, OutreachStatus, ConnectingStatus } from './types';
import { Radar, Database, Menu, X, Sun, Moon, Settings, Briefcase, Sparkles, Key, Layers, BookOpen, ExternalLink, Check, Copy, HelpCircle, Cpu, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, RefreshCw, Rocket } from 'lucide-react';
import { fetchFromSheet } from './lib/api';
import { hydrateRestoredProfile, mergeProfileBatch } from './lib/profileChangeDetection';
import { ToastContainer } from './components/ui/Toast';

type ExtractorPrefillRequest = {
  id: string;
  urls: string[];
  forceRefresh: boolean;
};

function isSupportedIntakeUrl(url: string) {
  return /^(https?:\/\/)?([^/]+\.)?(tiktok\.com|facebook\.com|fb\.com|fb\.watch)(\/|$)/i.test(url.trim());
}

function parseExtractorIntakeUrls(search: string) {
  const params = new URLSearchParams(search);
  const rawValues = [...params.getAll('addUrl'), ...params.getAll('addUrls')];

  return [
    ...new Set(
      rawValues
        .flatMap(value => value.split(/[\n\r]+/))
        .map(url => url.trim())
        .filter(url => url && isSupportedIntakeUrl(url)),
    ),
  ];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'extractor' | 'crm' | 'execution' | 'settings'>('extractor');
  const [restoredData, setRestoredData] = useState<RestoredData[]>([]);
  const [hasLoadedRestoredData, setHasLoadedRestoredData] = useState(false);
  const [extractorPrefillRequest, setExtractorPrefillRequest] = useState<ExtractorPrefillRequest | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('scout_hub_theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('scout_hub_webhook_url') || '';
  });
  const [projectName, setProjectName] = useState(() => {
    return localStorage.getItem('scout_hub_active_project') || '';
  });

  // Campaign State and Persistence
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scout_hub_campaigns');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [executionProfiles, setExecutionProfiles] = useState<ExecutionProfile[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scout_hub_execution_profiles');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('scout_hub_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem('scout_hub_execution_profiles', JSON.stringify(executionProfiles));
  }, [executionProfiles]);

  // Sync CRM Campaign tags in restoredData to Execution Profiles automatically
  useEffect(() => {
    if (!hasLoadedRestoredData || campaigns.length === 0) return;

    let needsUpdate = false;
    const updatedExecutionProfiles = [...executionProfiles];

    campaigns.forEach(camp => {
      // 1. Find all CRM profiles that have this campaign tag in CRM
      const crmProfilesWithTag = restoredData.filter(p => p.campaign && p.campaign.includes(camp.name));
      
      // 2. Ensure they exist in updatedExecutionProfiles
      crmProfilesWithTag.forEach(crmP => {
        const epIndex = updatedExecutionProfiles.findIndex(ep => ep.campaignId === camp.id && ep.profileId === crmP.id);
        if (epIndex === -1) {
          // Initialize status based on crmP.outreachStatus / workflowStatus
          let phase: 'connecting' | 'launching' | 'wrapping' = 'connecting';
          let connectingStatus: ConnectingStatus = 'pending_quote';
          
          if (crmP.outreachStatus === 'Confirmed') {
            phase = 'launching';
            connectingStatus = 'confirmed';
          } else if (crmP.outreachStatus === 'Negotiating') {
            connectingStatus = 'dealing';
          } else if (crmP.outreachStatus === 'Declined') {
            connectingStatus = 'cancelled';
          }

          updatedExecutionProfiles.push({
            id: `ep_${Math.random().toString(36).substring(7)}`,
            campaignId: camp.id,
            profileId: crmP.id,
            phase,
            connectingStatus,
            confirmedSOW: [],
            totalCost: 0,
            currency: 'VND',
            paymentTerm: '',
            confirmMessageRaw: '',
            launchingStatus: 'preparing',
            contractNotes: '',
            publishedLinks: [],
            wrappingStatus: 'pending_payment',
            acceptanceNotes: '',
            followUpItems: [],
            notes: '',
            assignedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          needsUpdate = true;
        } else {
          // Execution profile already exists! Let's check if CRM status has been updated and sync it back.
          const ep = updatedExecutionProfiles[epIndex];
          let changed = false;
          
          if (crmP.outreachStatus === 'Confirmed' && ep.phase === 'connecting' && ep.connectingStatus !== 'confirmed') {
            ep.connectingStatus = 'confirmed';
            ep.phase = 'launching';
            ep.launchingStatus = 'preparing';
            changed = true;
          } else if (crmP.outreachStatus === 'Negotiating' && ep.phase === 'connecting' && ep.connectingStatus !== 'dealing') {
            ep.connectingStatus = 'dealing';
            changed = true;
          } else if (crmP.outreachStatus === 'Declined') {
            // Set status to cancelled in current phase
            if (ep.phase === 'connecting' && ep.connectingStatus !== 'cancelled') {
              ep.connectingStatus = 'cancelled';
              changed = true;
            } else if (ep.phase === 'launching' && ep.launchingStatus !== 'cancelled') {
              ep.launchingStatus = 'cancelled';
              changed = true;
            } else if (ep.phase === 'wrapping' && ep.wrappingStatus !== 'cancelled') {
              ep.wrappingStatus = 'cancelled';
              changed = true;
            }
          } else if (crmP.outreachStatus === 'Sent' && ep.phase === 'connecting' && ep.connectingStatus !== 'pending_quote') {
            ep.connectingStatus = 'pending_quote';
            changed = true;
          }
          
          if (changed) {
            ep.updatedAt = new Date().toISOString();
            needsUpdate = true;
          }
        }
      });

      // 3. Remove execution profiles whose CRM profile no longer has the campaign tag
      const currentCampEps = updatedExecutionProfiles.filter(ep => ep.campaignId === camp.id);
      currentCampEps.forEach(ep => {
        const crmP = restoredData.find(p => p.id === ep.profileId);
        if (!crmP || !crmP.campaign || !crmP.campaign.includes(camp.name)) {
          const idx = updatedExecutionProfiles.findIndex(item => item.id === ep.id);
          if (idx !== -1) {
            updatedExecutionProfiles.splice(idx, 1);
            needsUpdate = true;
          }
        }
      });
    });

    if (needsUpdate) {
      setExecutionProfiles(updatedExecutionProfiles);
    }
  }, [restoredData, campaigns, hasLoadedRestoredData]);

  // Handler to update CRM profiles directly from Kanban Detail Panel
  const handleUpdateCRMProfile = (profileId: string, field: keyof RestoredData, value: any) => {
    setRestoredData(prev => prev.map(p => {
      if (p.id === profileId) {
        return {
          ...p,
          [field]: value,
          lastChangedAt: new Date().toISOString()
        };
      }
      return p;
    }));
  };

  // Persist project name
  useEffect(() => {
    localStorage.setItem('scout_hub_active_project', projectName);
  }, [projectName]);

  // Apply theme class
  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'theme-light' : '';
    localStorage.setItem('scout_hub_theme', theme);
  }, [theme]);

  // Load from localStorage on mount & Fetch from Webhook
  useEffect(() => {
    // 0. Intercept and decode addProfileData from Bookmarklet
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const encodedData = params.get('addProfileData');
      if (encodedData) {
        try {
          // Safe base64 decode supporting unicode/utf-8 characters
          const decodedString = decodeURIComponent(
            Array.prototype.map.call(
              atob(encodedData.replace(/ /g, '+')),
              (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
          );
          
          const profile = JSON.parse(decodedString);
          if (profile && profile.url) {
            const queueKey = 'scout_hub_extractor_queue_v1';
            let currentQueue: any[] = [];
            const savedQueue = localStorage.getItem(queueKey);
            if (savedQueue) {
              try { currentQueue = JSON.parse(savedQueue); } catch (e) {}
            }
            if (!Array.isArray(currentQueue)) currentQueue = [];

            const cleanUrl = profile.url.trim();
            const existingIdx = currentQueue.findIndex((item: any) => item.url.toLowerCase() === cleanUrl.toLowerCase());
            
            const newProfileData = {
              id: profile.id || Math.random().toString(36).substring(7),
              status: 'success',
              platform: profile.platform || (/tiktok\.com/i.test(cleanUrl) ? 'TikTok' : 'Facebook'),
              retryCount: 0,
              scrapedAt: new Date().toISOString(),
              ...profile,
              url: cleanUrl,
            };

            if (existingIdx !== -1) {
              currentQueue[existingIdx] = {
                ...currentQueue[existingIdx],
                ...newProfileData,
                status: 'success',
              };
            } else {
              currentQueue.push(newProfileData);
            }

            localStorage.setItem(queueKey, JSON.stringify(currentQueue));
            console.log('✓ Successfully imported profile from bookmarklet:', newProfileData.nickname);
            
            // Redirect to activeTab = 'extractor'
            setActiveTab('extractor');
          }
        } catch (e) {
          console.error('Failed to parse addProfileData from bookmarklet:', e);
        }
      }
    }

    // 1. Load stable cache from LocalStorage immediately
    const saved = localStorage.getItem('scout_hub_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((r: any) => hydrateRestoredProfile(r));
        setRestoredData(migrated);
      } catch (e) {
        console.error('Failed to parse saved data', e);
      }
    }

    // 2. Fetch fresh data from Google Sheet if configured
    const currentWebhook = localStorage.getItem('scout_hub_webhook_url');
    if (currentWebhook) {
      fetchFromSheet(currentWebhook).then(freshData => {
        if (freshData && freshData.length > 0) {
          setRestoredData(current => mergeProfileBatch(current, freshData, 'sheet').data);
          console.log("Synced fresh data from Google Sheet:", freshData.length, "profiles");
        }
      });
    }
    setHasLoadedRestoredData(true);
  }, []);

  // Save to localStorage when data changes with 500ms debounce
  useEffect(() => {
    if (!hasLoadedRestoredData) return;
    const timer = setTimeout(() => {
      localStorage.setItem('scout_hub_data', JSON.stringify(restoredData));
    }, 500);
    return () => clearTimeout(timer);
  }, [hasLoadedRestoredData, restoredData]);

  const handleSaveToRestored = (newData: RestoredData[]) => {
    setRestoredData(prev => mergeProfileBatch(prev, newData, 'extractor').data);
  };

  const queueExtractorUrls = (urls: string[], forceRefresh = false) => {
    const cleanUrls = [...new Set(urls.map(url => url.trim()).filter(Boolean))];
    if (cleanUrls.length === 0) return;

    setExtractorPrefillRequest({
      id: `${Date.now()}`,
      urls: cleanUrls,
      forceRefresh,
    });
    setActiveTab('extractor');
    setSidebarOpen(false);
  };

  const handleRefreshProfiles = (urls: string[]) => {
    queueExtractorUrls(urls, true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const intakeUrls = parseExtractorIntakeUrls(window.location.search);
    if (intakeUrls.length === 0) return;

    queueExtractorUrls(intakeUrls, false);
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const saveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem('scout_hub_webhook_url', url);
  };

  // Dynamic theme classes
  const isDark = theme === 'dark';
  const bgPrimary = isDark ? 'bg-[#0a0a0f]' : 'bg-[#f8fafc]';
  const bgSidebar = isDark ? 'bg-[#0d0d14]' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-500' : 'text-slate-400';
  const textTiny = isDark ? 'text-slate-600' : 'text-slate-300';
  const borderColor = isDark ? 'border-white/[0.06]' : 'border-slate-200';
  const navActive = isDark 
    ? 'bg-violet-600/15 text-violet-400 border-violet-500/20' 
    : 'bg-violet-50 text-violet-700 border-violet-200';
  const navInactive = isDark 
    ? 'text-slate-400 hover:text-white hover:bg-white/[0.04]' 
    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50';
  const navIconActive = isDark ? 'text-violet-400' : 'text-violet-600';
  const navIconInactive = isDark ? 'text-slate-500 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900';
  const topBarBg = isDark ? 'bg-[#0a0a0f]/80' : 'bg-white/80';
  const gradientBrand = 'bg-gradient-to-br from-violet-600 to-fuchsia-600';
  const mobileBtn = isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-700';
  const themeToggleBg = isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200';
  const themeToggleText = isDark ? 'text-amber-400' : 'text-slate-600';

  const navItems = [
    { id: 'extractor' as const, label: 'Extractor', icon: Radar, desc: 'Trích xuất profile' },
    { id: 'crm' as const, label: 'Scout CRM', icon: Database, desc: `${restoredData.length} profiles` },
    { id: 'execution' as const, label: 'Execution Hub', icon: Rocket, desc: `${campaigns.length} campaigns` },
    { id: 'settings' as const, label: 'Cài đặt', icon: Settings, desc: 'Webhook & API' },
  ];

  return (
    <div className={`min-h-screen ${bgPrimary} font-sans ${textPrimary} flex`}>
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg border ${mobileBtn}`}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        sidebar fixed lg:sticky top-0 left-0 z-40 h-screen w-64 
        ${bgSidebar} border-r ${borderColor}
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className={`px-6 py-6 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${gradientBrand} flex items-center justify-center`}>
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-bold ${textPrimary} tracking-tight`}>Scout Hub</h1>
              <p className={`text-[10px] ${textMuted} font-medium tracking-wider uppercase`}>Profile Intelligence</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group border ${
                activeTab === item.id ? navActive : `${navInactive} border-transparent`
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${
                activeTab === item.id ? navIconActive : navIconInactive
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-[10px] ${textMuted}`}>{item.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Theme Toggle + Footer */}
        <div className={`px-4 py-4 border-t ${borderColor} space-y-3`}>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl ${themeToggleBg} transition-all`}
          >
            {isDark ? <Sun className={`h-4 w-4 ${themeToggleText}`} /> : <Moon className={`h-4 w-4 ${themeToggleText}`} />}
            <span className={`text-sm ${textSecondary}`}>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>
          <p className={`text-[10px] ${textTiny} text-center`}>
            Scout Hub v2.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <div className={`topbar sticky top-0 z-20 ${topBarBg} backdrop-blur-xl border-b ${borderColor} px-6 lg:px-8 py-4`}>
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <div className="pl-10 lg:pl-0">
              <div className="flex items-center gap-3">
                <h2 className={`text-lg font-semibold ${textPrimary}`}>
                  {activeTab === 'extractor' 
                    ? 'Universal Extractor' 
                    : activeTab === 'crm' 
                    ? 'Scout CRM' 
                    : activeTab === 'execution'
                    ? 'Execution Hub'
                    : 'Cài đặt'}
                </h2>
                {projectName && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                    isDark ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'bg-violet-50 text-violet-700 border border-violet-200'
                  }`}>
                    <Briefcase className="h-3 w-3" />
                    {projectName}
                  </span>
                )}
              </div>
              <p className={`text-xs ${textMuted} mt-0.5`}>
                {activeTab === 'extractor' 
                  ? 'Paste link TikTok / Facebook → Auto-extract profile data' 
                  : activeTab === 'crm'
                  ? `Quản lý ${restoredData.length} profiles đã lưu trữ`
                  : activeTab === 'execution'
                  ? 'Quản lý chiến dịch và quy trình KOL Execution'
                  : 'Cấu hình Webhook, Google Sheet và các API'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6">
          {activeTab === 'extractor' && (
            <UniversalExtractor 
              onSaveToRestored={handleSaveToRestored} 
              webhookUrl={webhookUrl}
              theme={theme}
              prefillRequest={extractorPrefillRequest}
              projectName={projectName}
              onProjectNameChange={setProjectName}
            />
          )}
          {activeTab === 'crm' && (
            <ScoutCRM 
              data={restoredData} 
              onUpdateData={setRestoredData} 
              webhookUrl={webhookUrl}
              theme={theme}
              onRefreshProfiles={handleRefreshProfiles}
              projectName={projectName}
            />
          )}
          {activeTab === 'execution' && !selectedCampaignId && (
            <CampaignManager
              campaigns={campaigns}
              executionProfiles={executionProfiles}
              crmProfiles={restoredData}
              onSelectCampaign={setSelectedCampaignId}
              onAddCampaign={(newCamp) => {
                const camp: Campaign = {
                  ...newCamp,
                  id: `camp_${Math.random().toString(36).substring(7)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setCampaigns(prev => [...prev, camp]);
              }}
              onUpdateCampaign={(updatedCamp) => {
                setCampaigns(prev => prev.map(c => c.id === updatedCamp.id ? updatedCamp : c));
              }}
              onDeleteCampaign={(campId) => {
                setCampaigns(prev => prev.filter(c => c.id !== campId));
                setExecutionProfiles(prev => prev.filter(ep => ep.campaignId !== campId));
              }}
              onUpdateCampaignProfiles={(campId, profileIds) => {
                const camp = campaigns.find(c => c.id === campId);
                if (!camp) return;

                // 1. Dual-sync CRM campaign tags in restoredData!
                setRestoredData(prevCRM => prevCRM.map(p => {
                  const isAssigned = profileIds.includes(p.id);
                  const hasCRMTag = p.campaign && p.campaign.includes(camp.name);
                  
                  if (isAssigned && !hasCRMTag) {
                    return { ...p, campaign: [...(p.campaign || []), camp.name] };
                  } else if (!isAssigned && hasCRMTag) {
                    return { ...p, campaign: (p.campaign || []).filter(cName => cName !== camp.name) };
                  }
                  return p;
                }));

                // 2. Update executionProfiles list
                setExecutionProfiles(prev => {
                  const filtered = prev.filter(ep => ep.campaignId !== campId);
                  const newProfiles = profileIds.map(pId => {
                    const existing = prev.find(ep => ep.campaignId === campId && ep.profileId === pId);
                    if (existing) return existing;
                    return {
                      id: `ep_${Math.random().toString(36).substring(7)}`,
                      campaignId: campId,
                      profileId: pId,
                      phase: 'connecting' as const,
                      connectingStatus: 'pending_quote' as const,
                      confirmedSOW: [],
                      totalCost: 0,
                      currency: 'VND',
                      paymentTerm: '',
                      confirmMessageRaw: '',
                      launchingStatus: 'preparing' as const,
                      contractNotes: '',
                      publishedLinks: [],
                      wrappingStatus: 'pending_payment' as const,
                      acceptanceNotes: '',
                      followUpItems: [],
                      notes: '',
                      assignedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                  });
                  return [...filtered, ...newProfiles];
                });
              }}
              theme={theme}
            />
          )}
          {activeTab === 'execution' && selectedCampaignId && (() => {
            const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
            if (!selectedCampaign) return null;
            return (
              <ExecutionKanban
                campaign={selectedCampaign}
                executionProfiles={executionProfiles}
                crmProfiles={restoredData}
                onUpdateExecutionProfile={(updatedProfile) => {
                  setExecutionProfiles(prev => prev.map(ep => ep.id === updatedProfile.id ? updatedProfile : ep));

                  // Map and reconcile status back to CRM (ScoutCRM)
                  const campaign = campaigns.find(c => c.id === updatedProfile.campaignId);
                  const brandName = campaign ? campaign.brand : '';
                  const campaignTag = campaign ? campaign.name : '';

                  const currentStatus = updatedProfile.phase === 'connecting' 
                    ? updatedProfile.connectingStatus 
                    : updatedProfile.phase === 'launching' 
                    ? updatedProfile.launchingStatus 
                    : updatedProfile.wrappingStatus;

                  const getCRMStatusesFromExecution = (
                    phase: 'connecting' | 'launching' | 'wrapping',
                    status: string
                  ): { workflowStatus: WorkflowStatus; outreachStatus: OutreachStatus } => {
                    if (phase === 'connecting') {
                      switch (status) {
                        case 'pending_quote':
                          return { workflowStatus: 'Contacted', outreachStatus: 'Sent' };
                        case 'dealing':
                          return { workflowStatus: 'Negotiating', outreachStatus: 'Negotiating' };
                        case 'confirmed':
                          return { workflowStatus: 'Closed', outreachStatus: 'Confirmed' };
                        case 'cancelled':
                          return { workflowStatus: 'Closed', outreachStatus: 'Declined' };
                        default:
                          return { workflowStatus: 'Contacted', outreachStatus: 'Sent' };
                      }
                    } else if (phase === 'launching') {
                      switch (status) {
                        case 'cancelled':
                          return { workflowStatus: 'Closed', outreachStatus: 'Declined' };
                        default:
                          return { workflowStatus: 'Closed', outreachStatus: 'Confirmed' };
                      }
                    } else {
                      // wrapping
                      switch (status) {
                        case 'cancelled':
                          return { workflowStatus: 'Closed', outreachStatus: 'Declined' };
                        default:
                          return { workflowStatus: 'Closed', outreachStatus: 'Confirmed' };
                      }
                    }
                  };

                  const { workflowStatus, outreachStatus } = getCRMStatusesFromExecution(updatedProfile.phase, currentStatus);

                  setRestoredData(prevCRM => prevCRM.map(p => {
                    if (p.id === updatedProfile.profileId) {
                      let updatedCampaigns = p.campaign || [];
                      if (campaignTag && currentStatus !== 'cancelled') {
                        if (!updatedCampaigns.includes(campaignTag)) {
                          updatedCampaigns = [...updatedCampaigns, campaignTag];
                        }
                      } else if (campaignTag && currentStatus === 'cancelled') {
                        updatedCampaigns = updatedCampaigns.filter(c => c !== campaignTag);
                      }

                      return {
                        ...p,
                        workflowStatus,
                        outreachStatus,
                        projectName: brandName || p.projectName,
                        campaign: updatedCampaigns,
                        lastChangedAt: new Date().toISOString()
                      };
                    }
                    return p;
                  }));
                }}
                onUpdateCRMProfile={handleUpdateCRMProfile}
                onBack={() => setSelectedCampaignId(null)}
                theme={theme}
              />
            );
          })()}
          {activeTab === 'settings' && (
            <SettingsPanel 
              webhookUrl={webhookUrl} 
              onSaveWebhookUrl={saveWebhookUrl}
              theme={theme}
            />
          )}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}

// ============ Settings Panel ============
function parseRapidApiKeyPool(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,;]+/)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  ];
}

function SettingsPanel({ webhookUrl, onSaveWebhookUrl, theme }: { webhookUrl: string; onSaveWebhookUrl: (url: string) => void; theme: string }) {
  const [url, setUrl] = useState(webhookUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showBookmarkletGuide, setShowBookmarkletGuide] = useState(false);
  const [showGeminiGuide, setShowGeminiGuide] = useState(false);
  const [showRapidApiGuide, setShowRapidApiGuide] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('scout_hub_gemini_key') || '');
  const [aiBaseUrl, setAiBaseUrl] = useState(() => localStorage.getItem('scout_hub_ai_base_url') || 'https://generativelanguage.googleapis.com/v1beta/openai/');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('scout_hub_ai_model') || 'gemini-2.5-flash');
  const [rapidApiKey, setRapidApiKey] = useState(() => localStorage.getItem('scout_hub_rapidapi_key') || '');
  const [keysSaved, setKeysSaved] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  const isDark = theme === 'dark';
  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  const cardBg = isDark ? 'bg-white/[0.02] border-white/[0.06] shadow-xl backdrop-blur-md hover:border-white/[0.1] transition-all duration-300' : 'bg-white border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300';
  const inputBg = isDark ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-500 focus:border-violet-500/80 focus:bg-white/[0.06]' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500/80 focus:bg-white';
  const textP = isDark ? 'text-white' : 'text-slate-900';
  const textS = isDark ? 'text-slate-400' : 'text-slate-500';
  const textM = isDark ? 'text-slate-500' : 'text-slate-400';
  const codeBg = isDark ? 'bg-black/40 border-white/[0.06]' : 'bg-slate-100 border-slate-200';
  const codeText = isDark ? 'text-violet-400' : 'text-violet-700';

  const parsedRapidApiKeys = parseRapidApiKeyPool(rapidApiKey);
  
  const bookmarkletCode = `javascript:(function(){try{var url=window.location.href;var host=window.location.hostname;var isTikTok=/tiktok\\.com/i.test(host);var isFacebook=/(facebook\\.com|fb\\.com|fb\\.watch)/i.test(host);if(!isTikTok&&!isFacebook){alert('Scout Hub chỉ hỗ trợ TikTok hoặc Facebook profile!');return;}var data={url:url,scrapedAt:new Date().toISOString()};if(isTikTok){data.platform='TikTok';var nickEl=document.querySelector('[data-e2e="user-title"]')||document.querySelector('h1');data.nickname=nickEl?nickEl.textContent.trim():'';var subEl=document.querySelector('[data-e2e="user-subtitle"]')||document.querySelector('h2');if(subEl){data.channelId=subEl.textContent.trim().replace(/^@/,'');}else{var match=url.match(/@([^/?#]+)/);data.channelId=match?match[1]:'';}var followersEl=document.querySelector('[data-e2e="followers-count"]');data.followers=followersEl?followersEl.textContent.trim():'';var followingEl=document.querySelector('[data-e2e="following-count"]');data.following=followingEl?followingEl.textContent.trim():'';var likesEl=document.querySelector('[data-e2e="likes-count"]');data.likes=likesEl?likesEl.textContent.trim():'';var bioEl=document.querySelector('[data-e2e="user-desc"]');data.bio=bioEl?bioEl.textContent.trim():'';var imgEl=document.querySelector('[class*="Avatar"] img')||document.querySelector('img[src*="avatar"]');data.profilePic=imgEl?imgEl.src:'';var linkEl=document.querySelector('[data-e2e="user-link"] a')||document.querySelector('[data-e2e="user-link"]');data.bioLink=linkEl?linkEl.textContent.trim()||linkEl.href:'';}else if(isFacebook){data.platform='Facebook';var h1El=document.querySelector('h1');data.nickname=h1El?h1El.textContent.trim():'';var foundFollowers='';var bodyText=document.body.innerText;var pattern=/(\\d[\\d,.]*\\s*(?:triệu|nghìn|ngàn|[KkMm])?)\\s*(?:người theo dõi|followers|thành viên|members|lượt thích|likes)/i;var match=bodyText.match(pattern);if(match&&match[1]){foundFollowers=match[1].trim();}else{var els=document.querySelectorAll('a[href*="followers"],span');for(var i=0;i<els.length;i++){var text=els[i].textContent||'';if(/followers|người theo dõi|likes|thành viên/i.test(text)){var m=text.match(/[\\d,.]+\\s*[KkMm]?/);if(m){foundFollowers=m[0].trim();break;}}}}data.followers=foundFollowers;var spans=document.querySelectorAll('span');var introEl=document.querySelector('div[class*="x193iq5w"]')||document.querySelector('span[class*="x193iq5w"]');if(!introEl){for(var i=0;i<spans.length;i++){if(spans[i].textContent.includes('Giới thiệu')||spans[i].textContent.includes('Intro')){introEl=spans[i];break;}}}data.bio=introEl?introEl.textContent.trim():'';var avatarImg=document.querySelector('svg[role="img"] image')||document.querySelector('g image')||document.querySelector('img[src*="profile"]');data.profilePic=avatarImg?(avatarImg.getAttribute('xlink:href')||avatarImg.src):'';}var textToScan=[data.nickname,data.bio,document.body.innerText].join(' ');var emailMatch=textToScan.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);data.email=emailMatch?emailMatch[0]:'';var phoneMatch=textToScan.match(/(?:\\+84|0)(?:\\s*\\d){9,10}/);data.phone=phoneMatch?phoneMatch[0].replace(/\\s+/g,''):'';var jsonStr=JSON.stringify(data);var base64=btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g,function(match,p1){return String.fromCharCode(parseInt(p1,16));}));var target='${hostOrigin}/?addProfileData='+encodeURIComponent(base64);var win=window.open(target,'_blank');if(win){win.focus();}else{window.location.href=target;}}catch(err){alert('Lỗi trích xuất: '+err.message);}})();`;

  const handleSave = () => {
    const normalizedRapidApiKeys = parsedRapidApiKeys.join('\n');
    onSaveWebhookUrl(url.trim());
    localStorage.setItem('scout_hub_gemini_key', geminiKey.trim());
    localStorage.setItem('scout_hub_ai_base_url', aiBaseUrl.trim());
    localStorage.setItem('scout_hub_ai_model', aiModel.trim());
    localStorage.setItem('scout_hub_rapidapi_key', normalizedRapidApiKeys);
    setRapidApiKey(normalizedRapidApiKeys);
    setTestStatus('idle');
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleTest = async () => {
    if (!url.trim()) return;
    setTestStatus('testing');
    try {
      const response = await fetch(url.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'test_connection',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const text = await response.text();
        setTestStatus('success');
        setTestMsg(`Kết nối Apps Script Webhook thành công! Phản hồi từ server: ${text.slice(0, 100)}`);
      } else {
        setTestStatus('error');
        setTestMsg(`Lỗi kết nối (HTTP ${response.status}). Vui lòng kiểm tra lại URL Apps Script.`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMsg(`Không thể kết nối đến Webhook: ${e.message}. Hãy chắc chắn URL bắt đầu bằng https:// và Web App đã được chọn quyền Anyone.`);
    }
  };

  const copyToClipboard = (text: string, setCopied: (b: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const appsScriptCode = `const COLUMNS = [
  "Ngày lưu trữ", "Platform", "Tên", "ID", "Followers", "Avg View", "Avg Engagement",
  "SĐT", "Email", "Zalo", "Link Bio", "Link", "Bio", "Avatar", "Profile",
  "Tier", "Vị trí", "Nhóm", "Campaign", "SOW", "Notes", "Rate History", "Rating", "Workflow",
  "Project Name", "Outreach Status", "Last Quoted At"
];

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
  }
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action || 'upsert';
  
  var existingData = sheet.getDataRange().getValues();
  var headers = existingData[0] || COLUMNS;
  
  if (action === 'delete') {
    var linksToDelete = data.links || [];
    var urlIdx = headers.indexOf("Link");
    if (urlIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No Link column' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    for (var i = existingData.length - 1; i > 0; i--) {
      var rowLink = existingData[i][urlIdx];
      if (linksToDelete.indexOf(rowLink) !== -1) {
        sheet.deleteRow(i + 1);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', deleted: true })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var profiles = data.profiles || [];
  
  profiles.forEach(function(p) {
    // Generate a row matching the current headers in Google Sheets
    var rowToUpsert = headers.map(function(header) {
      switch(header) {
        case "Ngày lưu trữ": return p.saveDate || new Date().toLocaleDateString('vi-VN');
        case "Platform": return p.platform || '';
        case "Tên": return p.nickname || '';
        case "ID": return p.channelId || '';
        case "Followers": return p.followers || '';
        case "Avg View": return p.averageView || '';
        case "Avg Engagement": return p.averageEngagement || '';
        case "SĐT": return p.phone || '';
        case "Email": return p.email || '';
        case "Zalo": 
          // Automatically construct standard Zalo link if phone exists
          var digits = (p.phone || '').replace(/\\D/g, '');
          if (digits.startsWith('84')) {
            digits = '0' + digits.substring(2);
          }
          return digits ? 'https://zalo.me/' + digits : '';
        case "Link Bio": return p.bioLink || '';
        case "Link": return p.url || '';
        case "Bio": return p.bio || '';
        case "Avatar": return p.profilePic || '';
        case "Profile": return p.profileType || 'Individual';
        case "Tier": return (p.tier || []).join(', ');
        case "Vị trí": return (p.location || []).join(', ');
        case "Nhóm": return (p.group || []).join(', ');
        case "Campaign": return (p.campaign || []).join(', ');
        case "SOW": return (p.sow || []).join(', ');
        case "Notes": return JSON.stringify(p.notes || []);
        case "Rate History": return JSON.stringify(p.rateHistory || []);
        case "Rating": return p.rating || 0;
        case "Workflow": return p.workflowStatus || 'New';
        case "Project Name": return p.projectName || '';
        case "Outreach Status": return p.outreachStatus || 'Not Started';
        case "Last Quoted At": return p.lastQuotedAt || '';
        default: return '';
      }
    });
    
    var urlIdx = headers.indexOf("Link");
    var foundIdx = -1;
    if (urlIdx !== -1) {
      for (var i = 1; i < existingData.length; i++) {
        if (existingData[i][urlIdx] === p.url) {
          foundIdx = i;
          break;
        }
      }
    }
    
    if (foundIdx !== -1) {
      sheet.getRange(foundIdx + 1, 1, 1, rowToUpsert.length).setValues([rowToUpsert]);
    } else {
      sheet.appendRow(rowToUpsert);
      existingData.push(rowToUpsert);
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    setupSheet();
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var getIndex = function(name) {
    return headers.indexOf(name);
  };
  
  var rows = [];
  var parseJSON = function(val, def) {
    try { return JSON.parse(val); } catch(err) { return def; }
  };
  
  var urlIdx = getIndex("Link");
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (urlIdx === -1 || !row[urlIdx]) continue;
    
    var getVal = function(name, def) {
      var idx = getIndex(name);
      return (idx !== -1 && row[idx] !== undefined) ? row[idx] : (def || '');
    };
    
    rows.push({
      id: "row_" + i + "_" + new Date().getTime(),
      saveDate: getVal("Ngày lưu trữ") || getVal("Ngày") || '',
      platform: getVal("Platform") || 'TikTok',
      nickname: getVal("Tên") || '',
      channelId: getVal("ID") || '',
      followers: getVal("Followers") || '',
      averageView: Number(getVal("Avg View")) || 0,
      averageEngagement: Number(getVal("Avg Engagement")) || 0,
      phone: getVal("SĐT") || '',
      email: getVal("Email") || '',
      zalo: getVal("Zalo") || '',
      bioLink: getVal("Link Bio") || '',
      url: getVal("Link") || '',
      bio: getVal("Bio") || '',
      profilePic: getVal("Avatar") || getVal("Link ảnh") || '',
      profileType: getVal("Profile") || 'Individual',
      tier: getVal("Tier") ? String(getVal("Tier")).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      location: getVal("Vị trí") ? String(getVal("Vị trí")).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      group: getVal("Nhóm") ? String(getVal("Nhóm")).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      campaign: getVal("Campaign") ? String(getVal("Campaign")).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      sow: getVal("SOW") ? String(getVal("SOW")).split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
      notes: parseJSON(getVal("Notes"), []),
      rateHistory: parseJSON(getVal("Rate History"), []),
      rating: Number(getVal("Rating")) || 0,
      workflowStatus: getVal("Workflow") || 'New',
      projectName: getVal("Project Name") || '',
      outreachStatus: getVal("Outreach Status") || 'Not Started',
      lastQuotedAt: getVal("Last Quoted At") || '',
      status: 'success'
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}`;

  return (
    <div className="space-y-8 max-w-4xl pb-32 animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-1.5 border-b border-white/[0.06] pb-4 mb-6">
        <h2 className={`text-xl font-bold ${textP} flex items-center gap-2`}>
          <Settings className="w-6 h-6 text-violet-500 animate-spin-slow" />
          Cài đặt & Cấu hình Hệ thống
        </h2>
        <p className={`text-sm ${textS}`}>
          Quản lý kết nối Cơ sở dữ liệu Google Sheets, Gemini AI Engine, các kho khóa RapidAPI và Tiện ích Bookmarklet đồng bộ nhanh.
        </p>
      </div>

      {/* 1. GOOGLE SHEETS WEBHOOK CARD */}
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${cardBg}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textP}`}>Đồng bộ Google Sheets (CRM Sync)</h3>
              <p className={`text-xs md:text-sm ${textS} mt-0.5`}>
                Kết nối ScoutHub với bảng tính Google Sheets qua Apps Script để lưu trữ và quản lý tập trung dữ liệu.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${textS}`}>Apps Script Web App URL</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/xxxxx/exec"
                className={`flex-1 px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all ${inputBg}`}
              />
              <button
                onClick={handleTest}
                disabled={!url.trim() || testStatus === 'testing'}
                className={`px-5 py-2.5 text-sm font-bold border rounded-xl transition-all duration-200 disabled:opacity-40 whitespace-nowrap active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {testStatus === 'testing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Kiểm tra kết nối</span>
                  </>
                )}
              </button>
            </div>
            {testMsg && (
              <div className={`mt-2 p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                testStatus === 'success' 
                  ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                  : 'bg-rose-500/5 border-rose-500/10 text-rose-400'
              }`}>
                {testStatus === 'success' ? (
                  <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{testMsg}</span>
              </div>
            )}
          </div>

          {/* Apps Script Guide Collapsible */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
            isDark ? 'bg-slate-900/40 border-white/[0.05]' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-slate-500/5"
            >
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-violet-500">
                <BookOpen className="w-4.5 h-4.5" />
                <span>📖 Hướng dẫn liên kết Google Sheets & Webhook chi tiết</span>
              </div>
              {showGuide ? <ChevronUp className="w-4.5 h-4.5 text-violet-500" /> : <ChevronDown className="w-4.5 h-4.5 text-violet-500" />}
            </button>

            {showGuide && (
              <div className="px-5 pb-5 pt-2 space-y-4 text-xs md:text-sm border-t border-white/[0.05] leading-relaxed text-slate-300">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 font-bold text-xs">1</span>
                    <h4 className={`font-bold ${textP}`}>Khởi tạo Google Sheet và đặt tên cột</h4>
                  </div>
                  <p className={textS}>
                    Truy cập <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300 font-semibold underline inline-flex items-center gap-0.5">Google Sheets <ExternalLink className="w-3 h-3 inline" /></a> và tạo một bảng tính mới. Nếu chưa có header ở dòng đầu tiên, Apps Script sẽ tự động tạo cấu trúc tiêu chuẩn cho bạn khi chạy lần đầu.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 font-bold text-xs">2</span>
                    <h4 className={`font-bold ${textP}`}>Dán mã nguồn Apps Script</h4>
                  </div>
                  <p className={textS}>
                    Trong trang Google Sheet, chọn menu <b>Extensions (Tiện ích mở rộng) ➔ Apps Script</b>. Xóa sạch mọi mã nguồn mặc định và dán toàn bộ đoạn code dưới đây:
                  </p>
                  
                  <div className="relative rounded-xl border overflow-hidden bg-black/30 border-white/[0.06] mt-2.5">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-black/25">
                      <span className="text-[10px] font-mono text-slate-500">Google Apps Script Code (Code.gs)</span>
                      <button
                        onClick={() => copyToClipboard(appsScriptCode, setCopiedScript)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-all active:scale-95 flex items-center gap-1"
                      >
                        {copiedScript ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Đã copy!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Sao chép mã</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-xs text-slate-400 p-4 max-h-56 overflow-y-auto overflow-x-auto leading-relaxed font-mono whitespace-pre">{appsScriptCode}</pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 font-bold text-xs">3</span>
                    <h4 className={`font-bold ${textP}`}>Deploy dưới dạng Web App (Quyết định khả năng đồng bộ)</h4>
                  </div>
                  <p className={textS}>
                    Thực hiện cấu hình deployment theo các bước chuẩn xác sau:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400 mt-1">
                    <li>Nhấp nút <b>Deploy (Triển khai)</b> ở góc phải màn hình chọn <b>New Deployment (Triển khai mới)</b>.</li>
                    <li>Bấm vào biểu tượng bánh răng cài đặt và chọn loại triển khai là <b>Web App (Ứng dụng web)</b>.</li>
                    <li>Mục <b>Execute as (Thực thi dưới dạng)</b>: Chọn tài khoản của bạn (<b>Me / Tôi</b>).</li>
                    <li>Mục <b>Who has access (Ai có quyền truy cập)</b>: Bắt buộc chọn <b>Anyone (Mọi người)</b> để ứng dụng kết nối từ xa.</li>
                    <li>Bấm <b>Deploy</b>. Google sẽ yêu cầu phê duyệt bảo mật tài khoản, hãy cấp quyền đầy đủ cho ứng dụng.</li>
                    <li>Sau khi deploy thành công, hãy copy đường dẫn <b>Web App URL</b> (kết thúc bằng `/exec`) dán vào ô URL phía trên.</li>
                  </ul>
                </div>

                <div className={`p-3.5 rounded-xl border leading-relaxed flex gap-2.5 ${
                  isDark ? 'bg-amber-500/5 border-amber-500/15 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <span className="font-bold block mb-0.5">⚠️ Lưu ý cực kỳ quan trọng:</span>
                    Mỗi lần bạn chỉnh sửa mã nguồn Apps Script, bạn bắt buộc phải tạo <b>New Deployment mới</b> (hoặc chỉnh sửa phiên bản đang hoạt động và tăng số Version lên) thì thay đổi mới có hiệu lực trên URL Webhook.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. AI CONFIGURATION CARD */}
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${cardBg}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textP}`}>Trí tuệ Nhân tạo (Gemini AI Engine)</h3>
              <p className={`text-xs md:text-sm ${textS} mt-0.5`}>
                Cấu hình API Key và tên model AI để tự động soạn thư mời đối tác, tin nhắn và bóc tách báo giá KOLs.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${textS}`}>Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy... hoặc sk-or-v1-..."
                className={`px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${inputBg}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${textS}`}>AI Base URL (Tương thích OpenAI)</label>
              <input
                type="text"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                className={`px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${inputBg}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${textS}`}>AI Model Name</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="gemini-2.5-flash"
                className={`px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${inputBg}`}
              />
            </div>
          </div>

          {/* Gemini Guide Collapsible */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
            isDark ? 'bg-slate-900/40 border-white/[0.05]' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <button
              onClick={() => setShowGeminiGuide(!showGeminiGuide)}
              className="flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-slate-500/5"
            >
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-indigo-500">
                <Key className="w-4.5 h-4.5" />
                <span>🔑 Hướng dẫn lấy Gemini API Key và cấu hình AI chi tiết</span>
              </div>
              {showGeminiGuide ? <ChevronUp className="w-4.5 h-4.5 text-indigo-500" /> : <ChevronDown className="w-4.5 h-4.5 text-indigo-500" />}
            </button>

            {showGeminiGuide && (
              <div className="px-5 pb-5 pt-2 space-y-4 text-xs md:text-sm border-t border-white/[0.05] leading-relaxed text-slate-300">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">1</span>
                    <h4 className={`font-bold ${textP}`}>Đăng ký tại Google AI Studio</h4>
                  </div>
                  <p className={textS}>
                    Truy cập cổng thông tin phát triển AI chính thức của Google tại địa chỉ: <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-3.5 h-3.5 inline" /></a>. Đăng nhập bằng tài khoản Google/Gmail bất kỳ của bạn. Hoàn toàn miễn phí và không cần nhập thẻ Visa/Mastercard.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">2</span>
                    <h4 className={`font-bold ${textP}`}>Khởi tạo API Key mới</h4>
                  </div>
                  <p className={textS}>
                    Tại trang quản trị, nhấp nút màu xanh dương <b>"Get API Key"</b> ở thanh menu bên trái. Tiếp tục chọn <b>"Create API Key"</b>, hệ thống sẽ mở ra một popup.
                  </p>
                  <p className={textS}>
                    Chọn một dự án Google Cloud hiện có hoặc nhấn tạo dự án mới, sau đó click chọn <b>"Create API Key in existing project"</b>. Quá trình tạo diễn ra tự động chỉ trong vòng 2 giây.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs">3</span>
                    <h4 className={`font-bold ${textP}`}>Sao chép và cấu hình trên ScoutHub</h4>
                  </div>
                  <p className={textS}>
                    Copy chuỗi khóa vừa nhận được (bắt đầu bằng tiền tố <code>AIzaSy...</code>) và dán trực tiếp vào trường <b>Gemini API Key</b> ở trên.
                  </p>
                  
                  <div className="mt-3.5 space-y-3">
                    <h5 className={`font-bold text-xs ${textP}`}>📊 Bảng Model khuyên dùng:</h5>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/5 font-semibold text-slate-300">
                            <th className="px-3 py-2">Model</th>
                            <th className="px-3 py-2">Tốc độ</th>
                            <th className="px-3 py-2">Chất lượng</th>
                            <th className="px-3 py-2">Free Tier</th>
                            <th className="px-3 py-2">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-400">
                          <tr>
                            <td className="px-3 py-2 font-mono text-indigo-400">gemini-2.5-flash</td>
                            <td className="px-3 py-2">⚡⚡⚡</td>
                            <td className="px-3 py-2">★★★</td>
                            <td className="px-3 py-2">✅ Không giới hạn</td>
                            <td className="px-3 py-2"><b>Mặc định.</b> Tốt cho cào profile, phân loại nhanh</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-mono text-indigo-400">gemini-2.5-pro</td>
                            <td className="px-3 py-2">⚡⚡</td>
                            <td className="px-3 py-2">★★★★★</td>
                            <td className="px-3 py-2">✅ 25 req/ngày</td>
                            <td className="px-3 py-2">Tốt cho soạn email, parse báo giá phức tạp</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-mono text-indigo-400">gemini-2.0-flash</td>
                            <td className="px-3 py-2">⚡⚡⚡</td>
                            <td className="px-3 py-2">★★★</td>
                            <td className="px-3 py-2">✅ Không giới hạn</td>
                            <td className="px-3 py-2">Backup nếu 2.5-flash quá tải</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <h5 className={`font-bold text-xs ${textP}`}>🌐 Hướng dẫn đổi sang provider khác (OpenRouter, Groq, v.v.):</h5>
                    <ul className="list-decimal pl-5 space-y-1.5 text-slate-400">
                      <li><b>Bước 1:</b> Đăng ký tài khoản tại provider (VD: <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-indigo-400 underline">openrouter.ai</a>)</li>
                      <li><b>Bước 2:</b> Lấy API Key từ provider của bạn</li>
                      <li><b>Bước 3:</b> Đổi <b>AI Base URL</b> sang endpoint của provider (VD: <code>https://openrouter.ai/api/v1/</code>)</li>
                      <li><b>Bước 4:</b> Đổi <b>AI Model Name</b> sang model mong muốn (VD: <code>google/gemini-2.5-pro-preview</code>)</li>
                      <li><b>Bước 5:</b> Dán API Key của provider vào trường <b>Gemini API Key</b></li>
                    </ul>
                    <p className={`text-xs ${textM} italic mt-1.5`}>
                      * Lưu ý quan trọng: ScoutHub sử dụng chuẩn OpenAI-compatible API, nên bất kỳ provider nào hỗ trợ endpoint <code>/chat/completions</code> đều có thể hoạt động hoàn hảo.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. EXTRACTOR CONFIGURATION CARD */}
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${cardBg}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textP}`}>Bộ Cào Profile (Extractor API Engine)</h3>
              <p className={`text-xs md:text-sm ${textS} mt-0.5`}>
                Thiết lập bể chứa khóa (Key Pool) của RapidAPI để cào hàng trăm profile TikTok và Facebook an toàn, vượt qua giới hạn chặn IP.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${textS}`}>RapidAPI Key Pool (Mỗi dòng nhập 1 Key riêng biệt)</label>
            <textarea
              value={rapidApiKey}
              onChange={(e) => setRapidApiKey(e.target.value)}
              rows={Math.max(3, Math.min(6, parsedRapidApiKeys.length || 3))}
              spellCheck={false}
              placeholder={'key_example_1\nkey_example_2\nkey_example_3'}
              className={`w-full px-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono resize-y leading-relaxed transition-all ${inputBg}`}
            />
            {parsedRapidApiKeys.length > 0 && (
              <div className="mt-2.5 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Hệ thống nhận diện {parsedRapidApiKeys.length} khóa RapidAPI hoạt động. Cơ chế Xoay vòng Round-Robin, tự ngắt key quá hạn mức (429 Cool-down) và chuyển đổi dự phòng thông minh đã được kích hoạt ngầm!</span>
              </div>
            )}
          </div>

          {/* RapidAPI Guide Collapsible */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
            isDark ? 'bg-slate-900/40 border-white/[0.05]' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <button
              onClick={() => setShowRapidApiGuide(!showRapidApiGuide)}
              className="flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-slate-500/5"
            >
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-emerald-500">
                <HelpCircle className="w-4.5 h-4.5" />
                <span>🔑 Hướng dẫn lấy RapidAPI Key & Cách đăng ký các Scraper cần thiết</span>
              </div>
              {showRapidApiGuide ? <ChevronUp className="w-4.5 h-4.5 text-emerald-500" /> : <ChevronDown className="w-4.5 h-4.5 text-emerald-500" />}
            </button>

            {showRapidApiGuide && (
              <div className="px-5 pb-5 pt-2 space-y-4 text-xs md:text-sm border-t border-white/[0.05] leading-relaxed text-slate-300">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">1</span>
                    <h4 className={`font-bold ${textP}`}>Đăng ký tài khoản RapidAPI (Miễn phí)</h4>
                  </div>
                  <p className={textS}>
                    Khi hệ thống báo lỗi hết hạn mức cào (<b>limit quota</b> / 429), bất kỳ thành viên nào trong team cũng có thể tự đăng ký một tài khoản mới bằng cách truy cập: <a href="https://rapidapi.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline inline-flex items-center gap-0.5 font-semibold">RapidAPI.com <ExternalLink className="w-3.5 h-3.5 inline" /></a>. Đăng ký rất nhanh bằng Gmail hoặc tài khoản Google/GitHub.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">2</span>
                    <h4 className={`font-bold ${textP}`}>Tìm & Đăng ký gói Scraper hiện tại của hệ thống</h4>
                  </div>
                  <p className={textS}>
                    Hệ thống ScoutHub đang sử dụng bộ cào TikTok chuyên nghiệp: <b>TikTok Scraper</b> (API Host: <code>tiktok-scraper7.p.rapidapi.com</code>).
                  </p>
                  <p className={textS}>
                    Hãy làm theo các bước sau để đăng ký:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-400 mt-1">
                    <li>Nhập từ khóa <b>"TikTok Scraper"</b> vào thanh tìm kiếm trên RapidAPI (hoặc truy cập trực tiếp link: <a href="https://rapidapi.com/social-api-t/api/tiktok-scraper7" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">tiktok-scraper7 API</a>).</li>
                    <li>Bấm vào tab <b>Pricing</b> (Bảng giá).</li>
                    <li>Tìm gói <b>BASIC / FREE</b> (Thường có giá <b>$0/tháng</b>, hỗ trợ cào miễn phí hàng trăm lượt mỗi ngày) và nhấp chọn <b>Subscribe</b>.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">3</span>
                    <h4 className={`font-bold ${textP}`}>Lấy khóa X-RapidAPI-Key của bạn</h4>
                  </div>
                  <p className={textS}>
                    Sau khi Subscribe thành công, hãy nhấn vào tab <b>Endpoints</b> (Điểm cuối).
                  </p>
                  <p className={textS}>
                    Tại khung giao diện thử nghiệm API, hãy nhìn sang cột bên phải (hoặc cuộn xuống) phần <b>Header Parameters</b>.
                  </p>
                  <p className={textS}>
                    Tìm dòng chứa tham số <code>X-RapidAPI-Key</code> và sao chép chuỗi mã hóa dài (gồm khoảng 50 ký tự chữ và số).
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">4</span>
                    <h4 className={`font-bold ${textP}`}>Dán vào ScoutHub để tiếp tục cào ngay lập tức</h4>
                  </div>
                  <p className={textS}>
                    Dán key vừa copy vào ô nhập <b>RapidAPI Key Pool</b> ở phía trên. Nếu trong ô đã có sẵn các key khác, bạn chỉ cần nhấn <b>Enter xuống dòng</b> và dán key mới này vào (mỗi key nằm trên một dòng riêng biệt).
                  </p>
                  <p className={textS}>
                    Sau đó cuộn xuống cuối trang nhấp chọn <b>Lưu Cấu Hình Hệ Thống</b>. ScoutHub sẽ lập tức kích hoạt key mới và xoay vòng cào tiếp tục mà không cần khởi động lại máy chủ!
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border leading-relaxed flex gap-2.5 ${
                  isDark ? 'bg-indigo-500/5 border-indigo-500/15 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-500" />
                  <div>
                    <span className="font-bold block mb-0.5">💡 Mẹo dự phòng thông minh cho cả Team:</span>
                    Nhờ cơ chế <b>Xoay vòng Round-Robin & Cooldown thông minh</b> của ScoutHub, bạn có thể xin Key của nhiều thành viên trong team và dán chung vào ô nhập. Hệ thống sẽ tự động sử dụng lần lượt. Nếu một key bị hết hạn mức (quota limit), hệ thống tự động làm mát key đó và chuyển đổi sang key tiếp theo ngay lập tức để công việc cào không bao giờ bị gián đoạn!
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOOKMARKLET UTILITY CARD */}
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${cardBg}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${textP}`}>Tiện ích Trình duyệt Bookmarklet</h3>
              <p className={`text-xs md:text-sm ${textS} mt-0.5`}>
                Công cụ cào dữ liệu nhanh: Nhấp click dấu trang trên thanh trình duyệt khi đang xem TikTok/Facebook để import lập tức.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-4 rounded-xl bg-slate-500/5 border border-white/[0.04]">
            <a
              href={bookmarkletCode}
              onClick={(event) => event.preventDefault()}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200 hover:scale-105 active:scale-[0.98] shadow-md cursor-grab active:cursor-grabbing ${
                isDark 
                  ? 'bg-violet-500/10 border-violet-500/25 text-violet-300 hover:bg-violet-500/15' 
                  : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
              }`}
              title="Kéo nút này lên thanh dấu trang (Bookmarks Bar)"
            >
              <Sparkles className="w-4.5 h-4.5" />
              <span>🚀 Scout Hub Extract</span>
            </a>
            
            <button
              onClick={() => copyToClipboard(bookmarkletCode, setCopiedBookmarklet)}
              className={`px-4 py-2.5 text-xs font-bold border rounded-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {copiedBookmarklet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đã copy Bookmarklet!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Mã Bookmarklet</span>
                </>
              )}
            </button>

            <span className={`text-xs ${textS}`}>
              💡 Bạn có thể kéo nút màu tím lên thanh bookmark của trình duyệt hoặc nhấn Copy Mã rồi tự tạo Bookmarklet thủ công.
            </span>
          </div>

          {/* Bookmarklet Guide Collapsible */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
            isDark ? 'bg-slate-900/40 border-white/[0.05]' : 'bg-slate-50 border-slate-200/60'
          }`}>
            <button
              onClick={() => setShowBookmarkletGuide(!showBookmarkletGuide)}
              className="flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-slate-500/5"
            >
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-cyan-500">
                <BookOpen className="w-4.5 h-4.5" />
                <span>📖 Hướng dẫn cách cài đặt và sử dụng Bookmarklet chi tiết</span>
              </div>
              {showBookmarkletGuide ? <ChevronUp className="w-4.5 h-4.5 text-cyan-500" /> : <ChevronDown className="w-4.5 h-4.5 text-cyan-500" />}
            </button>

            {showBookmarkletGuide && (
              <div className="px-5 pb-5 pt-2 space-y-4 text-xs md:text-sm border-t border-white/[0.05] leading-relaxed text-slate-300">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">1</span>
                    <h4 className={`font-bold ${textP}`}>Hiện thanh dấu trang trên Trình duyệt</h4>
                  </div>
                  <p className={textS}>
                    Đảm bảo thanh bookmark của trình duyệt (Chrome, CocCoc, Safari, Edge) đang hiển thị. Nếu chưa thấy thanh bookmark, bạn hãy nhấn tổ hợp phím sau để mở nhanh:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>Trên Windows: Nhấn tổ hợp phím <b>Ctrl + Shift + B</b>.</li>
                    <li>Trên MacOS: Nhấn tổ hợp phím <b>Cmd + Shift + B</b>.</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">2</span>
                    <h4 className={`font-bold ${textP}`}>Cài đặt bằng cách kéo-thả</h4>
                  </div>
                  <p className={textS}>
                    Nhấp giữ chuột vào nút màu tím <b>"🚀 Scout Hub Extract"</b> phía trên, kéo rê chuột lên vị trí trống bất kỳ trên thanh Bookmark trình duyệt rồi thả chuột ra. Một dấu trang mới tên "🚀 Scout Hub Extract" sẽ được tạo ra trên thanh công cụ.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">3</span>
                    <h4 className={`font-bold ${textP}`}>Sử dụng để cào nhanh khi duyệt web</h4>
                  </div>
                  <p className={textS}>
                    Mỗi lần bạn duyệt tìm KOLs, hãy làm như sau để lấy thông tin tức khắc:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                    <li>Vào trang cá nhân (Profile) của KOL đó trên TikTok hoặc Facebook (ví dụ: <code>https://www.tiktok.com/@halinh.official</code>).</li>
                    <li>Khi trang đã tải xong hoàn toàn, hãy nhấp chuột vào Bookmarklet <b>"🚀 Scout Hub Extract"</b> trên thanh công cụ của bạn.</li>
                    <li>Ứng dụng sẽ tự động trích xuất thông tin như: Tên hiển thị, Followers, Likes, Bio, Email, Số điện thoại, Link Bio, Ảnh đại diện,... sau đó tự động mở tab ScoutHub và nạp trực tiếp data cào vào bộ Extractor của bạn để lưu lại!</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Premium Sticky Bottom Action Bar */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-3xl z-40 flex items-center justify-between px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
        isDark 
          ? 'bg-slate-950/85 border-white/[0.08] shadow-violet-950/20' 
          : 'bg-white/95 border-slate-200 shadow-slate-400/20'
      }`}>
        <div className="flex flex-col gap-0.5">
          <span className={`text-xs font-bold uppercase tracking-wider ${textS} flex items-center gap-1.5`}>
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
            Trạng thái Cấu hình
          </span>
          <span className={`text-xs ${textM}`}>Các thay đổi thiết lập hệ thống sẽ chỉ áp dụng sau khi lưu.</span>
        </div>
        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 shadow-lg shadow-violet-500/25"
        >
          {keysSaved ? (
            <>
              <Check className="w-4 h-4" />
              <span>Đã lưu thành công!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4.5 h-4.5" />
              <span>Lưu Cấu Hình Hệ Thống</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}

