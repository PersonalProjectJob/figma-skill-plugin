import { useEffect, useState, useRef, useMemo } from 'react';
import { RecommendationCard } from './components/RecommendationCard';
import { matchPattern, auditDesign } from './utils/matcher';
import type { MatchResult, AuditResult, FigmaContext, Pattern } from './utils/matcher';
import { callLLMAPI, callChatAPI } from './utils/llm';
import type { LLMConfig } from './utils/llm';
import { Search, ListChecks, RefreshCw, MessageSquare, Plus, ShieldCheck, Database, Layers } from 'lucide-react';

type AuditStatus = 'idle' | 'loading' | 'result';
type TabName = 'find' | 'audit' | 'sync' | 'chat';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('find');
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isInserting, setIsInserting] = useState(false);
  
  // Audit State
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('idle');
  const [auditMatch, setAuditMatch] = useState<MatchResult | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  
  // Find State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // Sync State
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'gemini',
    baseUrl: '',
    model: 'gemini-1.5-flash',
    apiKey: ''
  });
  const [lastSynced, setLastSynced] = useState<string>('Never');

  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: 'Hi! I am your Contextual Pattern Assistant. Ask me to explain the Audit Report or how to use a specific pattern.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleProviderChange = (provider: LLMConfig['provider']) => {
    const newConfig = { ...llmConfig, provider };
    if (provider === 'openai') {
      newConfig.baseUrl = 'https://api.openai.com/v1/chat/completions';
      newConfig.model = 'gpt-4o-mini';
    } else if (provider === 'deepseek') {
      newConfig.baseUrl = 'https://api.deepseek.com/chat/completions';
      newConfig.model = 'deepseek-chat';
    } else if (provider === 'anthropic') {
      newConfig.baseUrl = 'https://api.anthropic.com/v1/messages';
      newConfig.model = 'claude-3-haiku-20240307';
    } else if (provider === 'gemini') {
      newConfig.baseUrl = ''; 
      newConfig.model = 'gemini-1.5-flash';
    } else if (provider === 'custom') {
      newConfig.baseUrl = 'http://localhost:11434/v1/chat/completions';
      newConfig.model = 'llama3';
    }
    setLlmConfig(newConfig);
    parent.postMessage({ pluginMessage: { type: 'SAVE_LLM_CONFIG', config: newConfig } }, '*');
  };

  const updateLlmConfig = (updates: Partial<LLMConfig>) => {
    const newConfig = { ...llmConfig, ...updates };
    setLlmConfig(newConfig);
    parent.postMessage({ pluginMessage: { type: 'SAVE_LLM_CONFIG', config: newConfig } }, '*');
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'INSERT_DONE') {
        setIsInserting(false);
      } else if (msg.type === 'DATABASE_LOADED') {
        setPatterns(msg.database || []);
        setLastSynced(new Date().toLocaleTimeString());
      } else if (msg.type === 'INIT_LLM_CONFIG') {
        setLlmConfig(msg.config);
      } else if (msg.type === 'SELECTION_EMPTY') {
        setAuditStatus('idle');
        setAuditMatch(null);
        setAuditResult(null);
      } else if (msg.type === 'CONTEXT_EXTRACTED') {
        // Auto-switch to Audit Tab when user selects something
        setActiveTab('audit');
        const context = msg.payload as FigmaContext;
        setAuditStatus('loading');
        
        let match: MatchResult | null = null;

        if (llmConfig.apiKey.trim() !== '') {
          match = await callLLMAPI(context, llmConfig);
          if (!match) {
            match = matchPattern(context, patterns);
          } else {
            // LLM generated a match, but it lacks componentKey. Try to map it to a local pattern.
            const realPattern = patterns.find(p => p.name.toLowerCase() === match!.name.toLowerCase() || p.patternId === match!.patternId);
            if (realPattern) {
              match.componentKey = realPattern.componentKey;
              match.componentId = realPattern.componentId;
            } else {
              // Fallback to local matcher just to get the componentKey
              const localMatch = matchPattern(context, patterns);
              if (localMatch) {
                match.componentKey = localMatch.componentKey;
                match.componentId = localMatch.componentId;
              }
            }
          }
        } else {
          // Simulate latency
          await new Promise(r => setTimeout(r, 1000));
          match = matchPattern(context, patterns);
        }

        if (match) {
          const audit = auditDesign(context, match);
          setAuditMatch(match);
          setAuditResult(audit);
        } else {
          setAuditMatch(null);
          setAuditResult(null);
        }
        setAuditStatus('result');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [llmConfig, patterns]);

  // Send UI_READY only once on mount
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'UI_READY' } }, '*');
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    
    if (!llmConfig.apiKey) {
      alert("Please configure your API Key in the Sync tab first.");
      return;
    }

    const newMessages = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    const apiMessages = [
      { role: 'system', content: 'You are an expert UX/UI Design System Assistant helping a designer in Figma. Keep answers concise and helpful. DO NOT use Markdown formatting (no **, no ##). Use simple plain text with line breaks and plain dashes (-) for lists to make it easy to read.' },
      ...newMessages
    ];
    
    const result = await callChatAPI(apiMessages, llmConfig);
    
    setIsChatLoading(false);
    if (result.text) {
      setChatMessages([...newMessages, { role: 'assistant', content: result.text }]);
    } else {
      setChatMessages([...newMessages, { role: 'assistant', content: `⚠️ Connection Error: ${result.error}` }]);
    }
  };

  const handleSync = () => {
    parent.postMessage({ pluginMessage: { type: 'SYNC_LIBRARY' } }, '*');
  };

  const insertPattern = (key: string, id?: string) => {
    setIsInserting(true);
    parent.postMessage({ pluginMessage: { type: 'INSERT_COMPONENT', componentKey: key, componentId: id } }, '*');
  };

  // Group patterns for Find Tab
  const groupedPatterns = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();
    const filtered = patterns.filter(p => p.name.toLowerCase().includes(q) || p.patternId.toLowerCase().includes(q));
    
    const groups: Record<string, Pattern[]> = {};
    filtered.forEach(p => {
      // Assuming patternId format: "org/atoms/..."
      const parts = p.patternId.split('/');
      const category = parts.length > 1 ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Others';
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  }, [patterns, debouncedSearchQuery]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 overflow-hidden text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/90 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-brand-400 w-5 h-5" />
          <h1 className="font-semibold text-gray-100 tracking-tight text-sm">Pattern Advisor</h1>
        </div>
      </header>

      {/* Main Tabs */}
      <div className="flex border-b border-gray-800 shrink-0 bg-gray-900">
        {[
          { id: 'find', label: 'Find', icon: Search },
          { id: 'audit', label: 'Audit', icon: ListChecks },
          { id: 'sync', label: 'Sync', icon: RefreshCw },
          { id: 'chat', label: 'Chat', icon: MessageSquare }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabName)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors border-b-2 ${
                isActive ? 'border-brand-500 text-brand-400 bg-gray-800/30' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto min-h-0">
        
        {/* --- FIND TAB --- */}
        {activeTab === 'find' && (
          <div className="p-4 flex flex-col h-full animate-in fade-in duration-300">
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patterns (e.g. Form, Modal)..."
                className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-lg py-2 pl-9 pr-4 text-sm outline-none transition-colors"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-1 custom-scrollbar">
              {Object.keys(groupedPatterns).length === 0 ? (
                <div className="text-center text-gray-500 mt-10 text-sm">No patterns found.</div>
              ) : (
                Object.entries(groupedPatterns).map(([category, items]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3 sticky top-0 bg-gray-900/90 py-1 z-10 backdrop-blur-sm">
                      <Layers className="w-4 h-4 text-gray-400" />
                      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</h2>
                      <div className="h-px bg-gray-800 flex-1 ml-2"></div>
                    </div>
                    <div className="space-y-3">
                      {items.map(pattern => (
                        <div key={pattern.patternId} className="bg-gray-800 rounded-lg border border-gray-700 p-3 hover:border-gray-600 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-sm font-medium text-gray-200">{pattern.name}</h3>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pattern.description || pattern.explanation}</p>
                            </div>
                            <button 
                              onClick={() => insertPattern(pattern.componentKey, pattern.componentId)}
                              disabled={isInserting}
                              className="w-7 h-7 rounded bg-brand-500/10 text-brand-400 hover:bg-brand-500 hover:text-white flex items-center justify-center transition-colors flex-shrink-0 ml-3"
                              title="Insert Component"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- AUDIT TAB --- */}
        {activeTab === 'audit' && (
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            {auditStatus === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-4"></div>
                <p className="text-sm text-gray-400">Extracting context & analyzing...</p>
              </div>
            )}

            {auditStatus === 'result' && (
              <div className="p-4 pb-8 overflow-y-auto h-full custom-scrollbar">
                {auditMatch && auditResult ? (
                  <>
                    <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-brand-400 shrink-0" />
                      <div className="text-sm">
                        <span className="text-gray-300">Auditing against: </span>
                        <span className="font-semibold text-brand-400">{auditMatch.name}</span>
                      </div>
                    </div>
                    <RecommendationCard 
                      match={auditMatch} 
                      audit={auditResult}
                      isInserting={isInserting} 
                      onInsert={() => insertPattern(auditMatch.componentKey, auditMatch.componentId)} 
                    />
                  </>
                ) : (
                  <div className="p-5 rounded-xl bg-gray-800 border border-gray-700 text-center shadow-lg mt-10">
                    <h3 className="text-gray-200 font-medium mb-2">No Matching Pattern</h3>
                    <p className="text-sm text-gray-400">
                      Could not confidently match a pattern for this selection. Try selecting more specific elements or verify your Design System sync.
                    </p>
                  </div>
                )}
              </div>
            )}

            {auditStatus === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center text-gray-500">
                  <ListChecks className="w-6 h-6" />
                </div>
                <h3 className="text-gray-200 font-medium mb-2">Select to Audit</h3>
                <p className="text-sm text-gray-400 max-w-[200px]">
                  Select any layer in Figma to run an automatic design audit against your patterns.
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- SYNC TAB --- */}
        {activeTab === 'sync' && (
          <div className="p-4 animate-in fade-in duration-300 pb-10">
            
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-400" /> Pattern Database
              </h2>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Sync definitions, anatomy, and rules from your Figma Design System into the Plugin Database.
              </p>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Status</span>
                  <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Online
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-gray-300">Total Patterns</span>
                  <span className="text-lg font-semibold text-gray-100">{patterns.length}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-gray-300">Last Synced</span>
                  <span className="text-sm font-mono text-gray-400">{lastSynced}</span>
                </div>
              </div>

              <button 
                onClick={handleSync}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Sync Local Components
              </button>
              
              <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-[11px] text-blue-300/80 leading-tight">
                  <strong className="text-blue-300 block mb-1">Optimization Note:</strong>
                  The sync process uses <span className="font-semibold text-blue-200">Differential Sync</span> (only syncing nodes modified since last sync) and allows <span className="font-semibold text-blue-200">Selective Pagination</span> to handle massive enterprise files without crashing Figma.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800">
              <h2 className="text-sm font-semibold text-gray-200 mb-3">AI Engine Configuration</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">LLM Provider</label>
                  <select 
                    value={llmConfig.provider}
                    onChange={(e) => handleProviderChange(e.target.value as LLMConfig['provider'])}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-500 outline-none"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="deepseek">Deepseek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                  <input 
                    type="password" 
                    value={llmConfig.apiKey}
                    onChange={(e) => updateLlmConfig({ apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CHAT TAB --- */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-500 text-white rounded-br-none' 
                      : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900 p-3 pt-0">
              <form onSubmit={handleSendMessage} className="relative flex items-end bg-gray-800 border border-gray-700 rounded-xl overflow-hidden focus-within:border-brand-500 transition-all">
                <textarea 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask about the Audit report..."
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none text-sm text-gray-200 py-3 pl-3 pr-10 resize-none outline-none"
                  rows={1}
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="absolute right-2 bottom-2 p-1.5 text-brand-400 hover:bg-brand-500/20 rounded-md transition-colors disabled:opacity-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
