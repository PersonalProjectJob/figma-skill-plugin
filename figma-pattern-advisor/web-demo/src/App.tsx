import { useState, useEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { MousePointer2, Type, Square, Triangle, Hexagon, LayoutGrid, Plug2, ShieldCheck, Play } from 'lucide-react';
import PluginApp from './plugin-ui/App';
import './App.css';
import { PatternRenderer } from './canvas-components/PatternRenderer';

// Mock data
import { mockPatterns } from './mockData';

interface CanvasNode {
  id: string;
  x: number;
  y: number;
  type: 'faulty' | 'inserted';
  patternId?: string;
  faultyType?: 'login' | 'pricing' | 'navbar' | 'table' | 'modal';
}

function App() {
  const [showPluginMenu, setShowPluginMenu] = useState(false);
  const [isPluginOpen, setIsPluginOpen] = useState(false);
  const [selectedAtomic, setSelectedAtomic] = useState<string | null>('login');
  const selectedAtomicRef = useRef(selectedAtomic);
  useEffect(() => {
    selectedAtomicRef.current = selectedAtomic;
  }, [selectedAtomic]);
  
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([
    { id: 'faulty-login', x: 200, y: 120, type: 'faulty', faultyType: 'login' },
    { id: 'faulty-pricing', x: 650, y: 120, type: 'faulty', faultyType: 'pricing' },
    { id: 'faulty-navbar', x: 200, y: 550, type: 'faulty', faultyType: 'navbar' },
    { id: 'faulty-table', x: 750, y: 550, type: 'faulty', faultyType: 'table' },
    { id: 'faulty-modal', x: 200, y: 700, type: 'faulty', faultyType: 'modal' },
  ]);

  // ── Canvas Pan & Zoom ──
  const canvasRef = useRef<HTMLDivElement>(null);
  // Canvas Zoom state
  const scaleRef = useRef(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoomLabel, setZoomLabel] = useState(100);
  
  const applyTransform = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = `scale(${scaleRef.current})`;
    }
  }, []);

  // Wheel: Ctrl = zoom, plain = native scroll
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.06 : 0.06;
        scaleRef.current = Math.min(3, Math.max(0.1, scaleRef.current + delta));
        setZoomLabel(Math.round(scaleRef.current * 100));
        applyTransform();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyTransform]);

  // Node dragging state
  const draggingNodeRef = useRef<string | null>(null);
  const nodeDragStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // Node drag logic
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      if (draggingNodeRef.current) {
        const dx = (e.clientX - nodeDragStartRef.current.x) / scaleRef.current;
        const dy = (e.clientY - nodeDragStartRef.current.y) / scaleRef.current;
        nodeDragStartRef.current = { x: e.clientX, y: e.clientY };

        setCanvasNodes(prev => prev.map(n => {
          if (n.id === draggingNodeRef.current) {
            return { ...n, x: n.x + dx, y: n.y + dy };
          }
          return n;
        }));
      }
    };
    
    const onUp = () => {
      if (draggingNodeRef.current) {
        draggingNodeRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === 'UI_READY') {
        window.postMessage({
          pluginMessage: { type: 'DATABASE_LOADED', database: mockPatterns }
        }, '*');
        
        // Mock init llm config
        const savedLLM = localStorage.getItem('mock_llm_config');
        if (savedLLM) {
          window.postMessage({
            pluginMessage: { type: 'INIT_LLM_CONFIG', config: JSON.parse(savedLLM) }
          }, '*');
        }
      } else if (msg.type === 'SYNC_LIBRARY') {
        setTimeout(() => {
          window.postMessage({
            pluginMessage: { type: 'DATABASE_LOADED', database: mockPatterns }
          }, '*');
        }, 1500);
      } else if (msg.type === 'INSERT_COMPONENT') {
        console.log('Figma Mock: Inserting component', msg.componentKey);
        
        // Find pattern to insert
        const patternToInsert = mockPatterns.find(p => p.componentKey === msg.componentKey);
        if (patternToInsert) {
          setCanvasNodes(prev => {
            // Find currently selected node to position next to it
            const selectedNode = prev.find(n => 
              (n.type === 'faulty' && n.faultyType === selectedAtomicRef.current) || 
              (n.type === 'inserted' && `inserted-${n.id}` === selectedAtomicRef.current)
            );
            
            // Default position if nothing selected
            let newX = 200;
            let newY = 120;
            
            if (selectedNode) {
              // Estimate width based on type
              let width = 360;
              if (selectedNode.faultyType === 'pricing') width = 320;
              if (selectedNode.faultyType === 'navbar') width = 500;
              if (selectedNode.faultyType === 'table') width = 500;
              if (selectedNode.faultyType === 'modal') width = 280;
              
              newX = selectedNode.x + width + 100;
              newY = selectedNode.y;
            }
            
            return [...prev, {
              id: Date.now().toString(),
              x: newX,
              y: newY,
              type: 'inserted',
              patternId: patternToInsert.patternId
            }];
          });
        }
        
        setTimeout(() => {
          window.postMessage({ pluginMessage: { type: 'INSERT_DONE' } }, '*');
        }, 800);
      } else if (msg.type === 'SAVE_LLM_CONFIG') {
        localStorage.setItem('mock_llm_config', JSON.stringify(msg.config));
      } else if (msg.type === 'GET_SELECTION_CONTEXT') {
        setTimeout(() => {
          window.postMessage({
            pluginMessage: {
              type: 'CONTEXT_EXTRACTED',
              context: {
                nodeNames: ['Login Form v2.0', 'Input Field', 'Submit Button'],
                textContents: ['Email Address', 'Password', 'Sign In'],
                componentNames: ['Input/Default', 'Button/Primary'],
                frameNames: ['Auth Flow', 'Desktop']
              }
            }
          }, '*');
        }, 500);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="figma-header">
        <div className="header-left">
          <div className="icon-button" style={{ color: '#F24E1E' }}><Hexagon size={16} fill="currentColor" /></div>
          <div className="filename">
            Organization Design System
            <span className="badge-private">Enterprise</span>
          </div>
        </div>
        <div className="header-center">
          <button className="icon-button active"><MousePointer2 size={16} /></button>
          <button className="icon-button"><Square size={16} /></button>
          <button className="icon-button"><Type size={16} /></button>
          <div className="h-4 w-px bg-[#222] mx-2"></div>
          <div className="relative">
            <button 
              className={`icon-button ${showPluginMenu ? 'active' : ''}`}
              onClick={() => setShowPluginMenu(!showPluginMenu)}
            >
              <Plug2 size={16} />
            </button>
            {showPluginMenu && (
              <div className="plugin-dropdown animate-in">
                <div className="px-4 py-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider">In Your Organization</div>
                <div 
                  className="plugin-dropdown-item"
                  onClick={() => {
                    setIsPluginOpen(true);
                    setShowPluginMenu(false);
                  }}
                >
                  <div className="icon"><ShieldCheck size={16} /></div>
                  <div className="flex-1">
                    <div className="font-medium text-white">AI Pattern Advisor</div>
                    <div className="text-[11px] text-gray-500">Private org plugin</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="header-right">
          <button className="icon-button"><Play size={16} /></button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors">
            Share
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* Left Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">Atomic Core</div>
          <div className="layer-tree">
            <div className={`layer-item level-1 ${selectedAtomic === 'atoms' ? 'active' : ''}`} onClick={() => setSelectedAtomic('atoms')}>
              <Triangle size={14} className="opacity-50" /> Atoms
            </div>
            <div className="layer-item level-2">Colors</div>
            <div className="layer-item level-2">Typography</div>
            <div className="layer-item level-2">Icons</div>
            
            <div className={`layer-item level-1 ${selectedAtomic === 'molecules' ? 'active' : ''}`} onClick={() => setSelectedAtomic('molecules')}>
              <Square size={14} className="opacity-50" /> Molecules
            </div>
            <div className="layer-item level-2">Buttons</div>
            <div className="layer-item level-2">Inputs</div>
            
            <div className={`layer-item level-1 ${selectedAtomic === 'organisms' ? 'active' : ''}`} onClick={() => setSelectedAtomic('organisms')}>
              <LayoutGrid size={14} className="opacity-50" /> Organisms (Patterns)
            </div>
            <div className="layer-item level-2 active">Authentication</div>
            <div className="layer-item level-2">Data Display</div>
            <div className="layer-item level-2">Navigation</div>
            <div className="layer-item level-2">Feedback</div>
            
            <div className={`layer-item level-1 ${selectedAtomic === 'templates' ? 'active' : ''}`} onClick={() => setSelectedAtomic('templates')}>
              <LayoutGrid size={14} className="opacity-50" /> Templates
            </div>
          </div>
        </div>


        {/* Canvas — Infinite Pan & Zoom */}
        <div
          ref={canvasRef}
          className="canvas"
        >
          {/* Zoom indicator */}
          <div className="absolute top-3 right-3 z-10 bg-[#111]/80 backdrop-blur-sm border border-[#222] rounded-md px-2.5 py-1 text-[11px] font-mono text-gray-400 select-none">
            {zoomLabel}%
          </div>
          <div
            ref={contentRef}
            className="canvas-content animate-in"
            style={{ gap: '32px' }}
          >
          
            {canvasNodes.map(node => {
              const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
                e.stopPropagation();
                draggingNodeRef.current = id;
                nodeDragStartRef.current = { x: e.clientX, y: e.clientY };
              };

              if (node.type === 'inserted') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all animate-in fade-in zoom-in duration-300 ${selectedAtomic === `inserted-${node.id}` ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic(`inserted-${node.id}`);
                      const p = mockPatterns.find(x => x.patternId === node.patternId);
                      if (p) {
                        window.postMessage({
                          pluginMessage: {
                            type: 'CONTEXT_EXTRACTED',
                            payload: {
                              nodeNames: [p.name, ...p.requiredAnatomy],
                              textContents: [p.name, ...(Array.isArray(p.signals) ? p.signals : [])],
                              componentNames: [],
                              frameNames: []
                            }
                          }
                        }, '*');
                      }
                    }}
                  >
                    <div className="node-tag !bg-brand-500/20 !text-brand-400 !border-brand-500">{node.patternId} (Perfected)</div>
                    <PatternRenderer patternId={node.patternId!} />
                  </div>
                );
              }

              if (node.type === 'faulty' && node.faultyType === 'login') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all ${selectedAtomic === 'login' ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic('login');
                      window.postMessage({
                        pluginMessage: {
                          type: 'CONTEXT_EXTRACTED',
                          payload: {
                            nodeNames: ['Login Form', 'Email Input', 'Password Input', 'Submit Button'],
                            textContents: ['Work Email', 'Password', 'Sign in to Enterprise', 'Continue with SAML'],
                            componentNames: ['Input/Default', 'Button/Primary'],
                            frameNames: ['Auth Flow', 'Desktop']
                          }
                        }
                      }, '*');
                    }}
                  >
                    <div className="bg-[#0F0F11] border border-[#222] p-6 rounded-xl relative">
                      <div className="node-tag">organisms/auth/login-form</div>
                      <div className="flex flex-col gap-4 w-[360px]">
                        <div className="text-xl font-medium font-ui tracking-tight mb-2 text-white">Sign in to Enterprise</div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-400">Work Email</label>
                          <div className="h-10 bg-[#1A1A1E] border border-[#333] rounded flex items-center px-3 text-sm text-gray-500">name@company.com</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-400">Password</label>
                          <div className="h-10 bg-[#1A1A1E] border border-[#333] rounded flex items-center px-3 text-sm text-gray-500">••••••••</div>
                        </div>
                        <button className="h-10 bg-[#00F0FF] text-black font-medium rounded hover:bg-[#00D0DD] transition-colors mt-2 pointer-events-none">
                          Continue with SAML
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (node.type === 'faulty' && node.faultyType === 'pricing') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all ${selectedAtomic === 'pricing' ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic('pricing');
                      window.postMessage({
                        pluginMessage: {
                          type: 'CONTEXT_EXTRACTED',
                          payload: {
                            nodeNames: ['Pricing Card', 'Feature List', 'Plan Name Label', 'Price Tag'],
                            textContents: ['Organization', '$45/mo', 'Org-wide libraries', 'SSO & Advanced security', 'Design system analytics', 'Centralized billing', 'Plugin management', 'Activity logs', 'Dedicated support', 'Custom onboarding', 'Too many features listed here makes design cluttered'],
                            componentNames: ['Card/Pricing', 'List/Checkmark'],
                            frameNames: ['Pricing Page']
                          }
                        }
                      }, '*');
                    }}
                  >
                    <div className="bg-[#0F0F11] border border-[#222] p-6 rounded-xl relative">
                      <div className="node-tag">organisms/data/pricing-tier</div>
                      <div className="flex flex-col gap-4 w-[320px]">
                        <div className="flex justify-between items-start">
                          <div className="text-xl font-medium font-ui tracking-tight text-white">Organization</div>
                          <div className="badge-private bg-[#1A1A1E] text-white border border-[#333]">Current</div>
                        </div>
                        <div className="text-3xl font-light font-ui text-white">$45<span className="text-sm text-gray-500">/mo</span></div>
                        <div className="h-px w-full bg-[#222] my-2"></div>
                        <ul className="text-sm text-gray-400 flex flex-col gap-2">
                          <li className="flex gap-2 items-center"><ShieldCheck size={14} className="text-[#00F0FF]"/> Org-wide libraries</li>
                          <li className="flex gap-2 items-center"><ShieldCheck size={14} className="text-[#00F0FF]"/> Design system analytics</li>
                          <li className="flex gap-2 items-center"><ShieldCheck size={14} className="text-[#00F0FF]"/> SSO & Advanced security</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }

              if (node.type === 'faulty' && node.faultyType === 'navbar') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all ${selectedAtomic === 'navbar' ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic('navbar');
                      window.postMessage({
                        pluginMessage: {
                          type: 'CONTEXT_EXTRACTED',
                          payload: {
                            nodeNames: ['Top Bar', 'Logo Container', 'Search Box', 'User Avatar Circle'],
                            textContents: ['Acme Corp', 'Search...', 'Dashboard', 'Projects', 'Teams', 'Reports', 'Analytics', 'Integrations', 'Settings', 'Billing', 'top-level items exceeding 7'],
                            componentNames: ['Avatar/32', 'Search/Default'],
                            frameNames: ['Navigation', 'Header']
                          }
                        }
                      }, '*');
                    }}
                  >
                    <div className="bg-[#0F0F11] border border-[#222] p-6 rounded-xl relative" style={{ minWidth: '500px' }}>
                      <div className="node-tag">organisms/nav/top-navbar</div>
                      <div className="flex items-center gap-4 w-full mt-4">
                        <div className="flex items-center gap-2">
                          <Hexagon size={20} className="text-[#00F0FF]" fill="#00F0FF" />
                          <span className="text-white font-semibold font-ui">Acme Corp</span>
                        </div>
                        <div className="flex-1 h-8 bg-[#1A1A1E] border border-[#333] rounded flex items-center px-3 text-xs text-gray-500">Search...</div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">AD</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (node.type === 'faulty' && node.faultyType === 'table') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all ${selectedAtomic === 'table' ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic('table');
                      window.postMessage({
                        pluginMessage: {
                          type: 'CONTEXT_EXTRACTED',
                          payload: {
                            nodeNames: ['Data Table', 'Column Header Row', 'Table Row', 'Sort Arrow'],
                            textContents: ['Name', 'Status', 'Role', 'Last Active', 'John Doe', 'Active', 'Admin', 'empty state missing from this table design'],
                            componentNames: ['Table/Header', 'Table/Row', 'Sort/Indicator'],
                            frameNames: ['Admin Panel', 'User Management']
                          }
                        }
                      }, '*');
                    }}
                  >
                    <div className="bg-[#0F0F11] border border-[#222] p-6 rounded-xl relative" style={{ minWidth: '500px' }}>
                      <div className="node-tag">organisms/data/data-table</div>
                      <div className="w-full mt-6">
                        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-[#222] pb-2 mb-2">
                          <span className="flex items-center gap-1">Name <Triangle size={8} className="opacity-40" /></span>
                          <span>Status</span>
                          <span>Role</span>
                          <span>Last Active</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm text-gray-300 py-2 border-b border-[#111]">
                          <span>John Doe</span>
                          <span className="text-green-400 text-xs font-medium">Active</span>
                          <span className="text-gray-500">Admin</span>
                          <span className="text-gray-500 font-mono text-xs">2m ago</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm text-gray-300 py-2 border-b border-[#111]">
                          <span>Jane Smith</span>
                          <span className="text-yellow-400 text-xs font-medium">Pending</span>
                          <span className="text-gray-500">Editor</span>
                          <span className="text-gray-500 font-mono text-xs">1h ago</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-sm text-gray-300 py-2">
                          <span>Bob Wilson</span>
                          <span className="text-red-400 text-xs font-medium">Inactive</span>
                          <span className="text-gray-500">Viewer</span>
                          <span className="text-gray-500 font-mono text-xs">3d ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (node.type === 'faulty' && node.faultyType === 'modal') {
                return (
                  <div 
                    key={node.id}
                    className={`mock-node group cursor-pointer transition-all ${selectedAtomic === 'modal' ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'border-transparent'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => {
                      setSelectedAtomic('modal');
                      window.postMessage({
                        pluginMessage: {
                          type: 'CONTEXT_EXTRACTED',
                          payload: {
                            nodeNames: ['Modal Container', 'Overlay Backdrop', 'Dialog Title', 'Body Content Area'],
                            textContents: ['Delete Project', 'Are you sure you want to delete this project? This action cannot be undone.', 'Cancel', 'Confirm'],
                            componentNames: ['Button/Danger', 'Button/Secondary'],
                            frameNames: ['Modal Flow', 'Confirmation']
                          }
                        }
                      }, '*');
                    }}
                  >
                    <div className="bg-[#0F0F11] border border-[#222] p-6 rounded-xl relative" style={{ minWidth: '280px' }}>
                      <div className="node-tag">organisms/feedback/modal-dialog</div>
                      <div className="flex flex-col gap-3 mt-4">
                        <div className="text-lg font-semibold font-ui text-white">Delete Project</div>
                        <p className="text-sm text-gray-400 leading-relaxed">Are you sure you want to delete this project? This action cannot be undone.</p>
                        <div className="flex gap-2 mt-2">
                          <button className="flex-1 h-9 bg-[#1A1A1E] border border-[#333] text-gray-300 rounded text-sm font-medium pointer-events-none">Cancel</button>
                          <button className="flex-1 h-9 bg-red-600 text-white rounded text-sm font-medium pointer-events-none">Confirm</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}

          </div>
        </div>

        {/* Right Sidebar */}
        <div className="sidebar right w-[240px]">
          <div className="sidebar-header border-b border-[#222]">Design Properties</div>
          <div className="p-4 text-sm text-gray-500 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span>W</span> <span className="font-mono text-white">1920</span>
            </div>
            <div className="flex justify-between items-center">
              <span>H</span> <span className="font-mono text-white">1080</span>
            </div>
            <div className="h-px w-full bg-[#222]"></div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider">Fill</div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#050505] border border-[#333]"></div>
                <span className="font-mono text-white">#050505</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin Window */}
      {isPluginOpen && (
        <Rnd
          default={{
            x: window.innerWidth / 2 - 180,
            y: window.innerHeight / 2 - 250,
            width: 360,
            height: 500,
          }}
          minWidth={320}
          minHeight={400}
          bounds="window"
          dragHandleClassName="plugin-window-header"
          style={{ zIndex: 100 }}
        >
          <div className="plugin-window">
            <div className="plugin-window-header">
              <div className="plugin-window-title">
                <ShieldCheck size={16} className="text-[#00F0FF]" />
                AI Pattern Advisor
              </div>
              <div className="flex gap-2">
                <button className="icon-button w-6 h-6 p-0" onClick={() => setIsPluginOpen(false)}>&times;</button>
              </div>
            </div>
            <div className="plugin-iframe-container" style={{ overflowY: 'auto' }}>
              <PluginApp />
            </div>
          </div>
        </Rnd>
      )}
    </div>
  );
}

export default App;
