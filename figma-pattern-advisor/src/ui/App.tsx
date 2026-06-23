import { useEffect, useState, useRef } from 'react';
import { RecommendationCard } from './components/RecommendationCard';
import { matchPattern, MatchResult, FigmaContext, Pattern } from './utils/matcher';
import { callLLMAPI, callChatAPI, LLMConfig } from './utils/llm';

type Status = 'idle' | 'loading' | 'result';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [isInserting, setIsInserting] = useState(false);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'gemini',
    baseUrl: '',
    model: 'gemini-1.5-flash',
    apiKey: ''
  });

  const [activeTab, setActiveTab] = useState<'inspect' | 'chat'>('inspect');
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: 'Hi! I am your AI Pattern Advisor. Ask me anything about UI/UX or Design Systems.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle LLM Config Input changes
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
      } else if (msg.type === 'INIT_LLM_CONFIG') {
        setLlmConfig(msg.config);
      } else if (msg.type === 'SELECTION_EMPTY') {
        setStatus('idle');
        setResult(null);
      } else if (msg.type === 'CONTEXT_EXTRACTED') {
        const context = msg.payload as FigmaContext;
        setStatus('loading');
        
        if (llmConfig.apiKey.trim() !== '') {
          // Use Real LLM API
          const match = await callLLMAPI(context, llmConfig);
          if (match) {
            setResult(match);
            setStatus('result');
          } else {
            // Fallback to mock if API fails
            const mockMatch = matchPattern(context, patterns);
            setResult(mockMatch);
            setStatus('result');
          }
        } else {
          // Use Mock Logic with simulation delay
          setTimeout(() => {
            const match = matchPattern(context, patterns);
            setResult(match);
            setStatus('result');
          }, 2000);
        }
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
      alert("Please configure your API Key in Settings first.");
      return;
    }

    const newMessages = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    const apiMessages = [
      { role: 'system', content: 'You are an expert UX/UI Design System Assistant helping a designer in Figma. Keep answers concise, helpful, and use markdown formatting.' },
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

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 className="font-semibold text-gray-100 tracking-tight">Pattern Advisor</h1>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`p-2 rounded-lg transition-colors ${isSettingsOpen ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
        {isSettingsOpen ? (
          <div className="flex-1 flex flex-col animate-in fade-in duration-300">
            <h2 className="text-gray-200 font-medium text-base mb-4">Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">LLM Provider</label>
                <select 
                  value={llmConfig.provider}
                  onChange={(e) => handleProviderChange(e.target.value as LLMConfig['provider'])}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="deepseek">Deepseek</option>
                  <option value="custom">Custom (OpenAI Compatible)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Base URL</label>
                <input 
                  type="text" 
                  value={llmConfig.baseUrl}
                  onChange={(e) => updateLlmConfig({ baseUrl: e.target.value })}
                  placeholder="Leave empty for default"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Model Name</label>
                <input 
                  type="text" 
                  value={llmConfig.model}
                  onChange={(e) => updateLlmConfig({ model: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                <input 
                  type="password" 
                  value={llmConfig.apiKey}
                  onChange={(e) => updateLlmConfig({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors placeholder:text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                  If provided, the plugin will call this API. If empty, it falls back to the local mock algorithm.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Pattern Database</h3>
              <p className="text-xs text-gray-500 mb-3">
                Open your Design System file and sync all components to the database.
              </p>
              <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
                <span className="text-sm text-gray-300">Currently synced:</span>
                <span className="text-sm font-semibold text-brand-400">{patterns.length} patterns</span>
              </div>
              <button 
                onClick={() => parent.postMessage({ pluginMessage: { type: 'SYNC_LIBRARY' } }, '*')}
                className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors border border-gray-600 shadow-sm"
              >
                Sync Local Components
              </button>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-800">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors border border-gray-700"
              >
                Close Settings
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col animate-in fade-in duration-300">
            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-4 shrink-0">
              <button 
                onClick={() => setActiveTab('inspect')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'inspect' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                Inspect
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                Chat
              </button>
            </div>

            {activeTab === 'inspect' ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search Bar */}
                <div className="relative mb-6 shrink-0">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patterns (e.g. Form, Modal)..."
                    className="w-full bg-gray-900 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg py-2.5 px-4 text-sm text-gray-200 placeholder:text-gray-500 transition-all outline-none"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>

                {/* Status Views */}
                {status === 'loading' && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 rounded-full border-2 border-gray-800"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-t-brand-500 animate-spin"></div>
                    </div>
                    <p className="text-sm text-gray-400 animate-pulse">
                      {llmConfig.apiKey.trim() !== '' ? `Querying ${llmConfig.provider.toUpperCase()}...` : 'Analyzing context...'}
                    </p>
                  </div>
                )}

                {status === 'result' && (
                  <div className="flex-1 animate-in slide-in-from-bottom-4 duration-500 min-h-0 pb-4">
                    {debouncedSearchQuery.trim().length > 0 ? (
                      (() => {
                        const query = debouncedSearchQuery.toLowerCase();
                        const searchMatches: MatchResult[] = patterns.filter(p => 
                          p.name.toLowerCase().includes(query) || 
                          p.patternId.toLowerCase().includes(query)
                        ).map(p => ({
                          ...p,
                          confidence: 100,
                          explanation: `Auto-synced component: ${p.name}`
                        }));

                        return searchMatches.length > 0 ? (
                          <div className="space-y-4">
                            {searchMatches.map((match, i) => (
                              <RecommendationCard key={i} match={match} isInserting={isInserting} onInsert={() => {
                                setIsInserting(true);
                                parent.postMessage({ pluginMessage: { type: 'INSERT_COMPONENT', componentKey: match.componentKey, componentId: match.componentId } }, '*');
                              }} />
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-gray-500">No patterns found for "{debouncedSearchQuery}"</div>
                        );
                      })()
                    ) : (
                      <>
                        {result ? (
                          <RecommendationCard match={result} isInserting={isInserting} onInsert={() => {
                            setIsInserting(true);
                            parent.postMessage({ pluginMessage: { type: 'INSERT_COMPONENT', componentKey: result.componentKey, componentId: result.componentId } }, '*');
                          }} />
                        ) : (
                          <div className="p-5 rounded-xl bg-gray-800 border border-gray-700 text-center shadow-lg">
                            <h3 className="text-gray-200 font-medium mb-2">No Matching Pattern</h3>
                            <p className="text-sm text-gray-400">
                              Could not confidently recommend a pattern for this selection. Try selecting more specific elements.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {status === 'idle' && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                    <div className="w-16 h-16 mb-4 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center text-gray-500">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
                      </svg>
                    </div>
                    <h3 className="text-gray-200 font-medium mb-2">Select elements to analyze</h3>
                    <p className="text-sm text-gray-400 max-w-[200px]">
                      Select one or more layers on the canvas and I'll recommend the right pattern.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Chat Tab */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <div className="flex-1 overflow-y-auto pr-2 pb-24 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user' 
                          ? 'bg-brand-500 text-white rounded-br-none' 
                          : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
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
                
                {/* Chat Input */}
                <div className="absolute bottom-0 left-0 right-0 bg-gray-900 pt-2 pb-1">
                  <form onSubmit={handleSendMessage} className="relative flex items-end bg-gray-800 border border-gray-700 rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
                    <textarea 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask anything..."
                      className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 text-sm text-gray-200 py-3 pl-3 pr-10 resize-none outline-none"
                      rows={1}
                    />
                    <button 
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute right-2 bottom-2 p-1.5 text-brand-400 hover:text-brand-300 hover:bg-brand-500/20 rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-400"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
