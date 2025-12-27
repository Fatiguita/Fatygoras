import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Whiteboard from './components/Whiteboard';
import ChatBot from './components/ChatBot';
import Playground from './components/Playground';
import Button from './components/Button';
import ApiLogPanel from './components/ApiLogPanel';
import SessionManager from './components/SessionManager';
import Syllabus from './components/Syllabus';
import { 
  AppTheme, 
  GeminiModel, 
  WhiteboardData, 
  ChatMessage, 
  PlaygroundCode,
  ApiLogEntry,
  SyllabusData,
  CourseLevel
} from './types';
import { 
  DEFAULT_THEME, 
  DEFAULT_MODEL, 
  STORAGE_KEYS 
} from './constants';
import { 
  analyzeTopic, 
  generateWhiteboardBatch, 
  generatePlayground,
  generateSyllabus,
  analyzeImageWithContext 
} from './services/geminiService';

enum Tab {
  CLASSROOM = 'classroom',
  SYLLABUS = 'syllabus'
}

const App: React.FC = () => {
  // --- STATE ---
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);
  const [model, setModel] = useState<GeminiModel>(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState<string>('');
  const [saveToLocal, setSaveToLocal] = useState(false);
  
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CLASSROOM);
  
  // Content
  const [input, setInput] = useState('');
  const [whiteboards, setWhiteboards] = useState<WhiteboardData[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Playground State
  const [playgrounds, setPlaygrounds] = useState<PlaygroundCode[]>([]);
  const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
  const [playgroundPanelOpen, setPlaygroundPanelOpen] = useState(false);
  const [playgroundWidth, setPlaygroundWidth] = useState(500);

  // Syllabus State
  const [syllabus, setSyllabus] = useState<SyllabusData | null>(null);
  const [syllabusGallery, setSyllabusGallery] = useState<SyllabusData[]>([]);

  // Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Advanced Mode (Logging)
  const [isAdvancedModeOpen, setIsAdvancedModeOpen] = useState(false);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);

  // --- HELPERS ---

  const addLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => {
    const newLog: ApiLogEntry = {
      ...entry,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    setApiLogs(prev => [...prev, newLog]);
  }, []);

  // Context construction for ChatBot - includes active items
  const chatContext = useMemo(() => {
    // We prioritize the active playground and the last few whiteboards for context
    const pg = playgrounds.find(p => p.id === activePlaygroundId);
    const pgContext = pg ? `[Active Playground]: ${pg.description} (${pg.status})` : "[No Active Playground]";
    
    // Get visible whiteboards (assume last 2 are most relevant)
    const wbContext = whiteboards.slice(0, 3).map(w => `[Whiteboard - ${w.topic}]: ${w.explanation.substring(0, 150)}...`).join('\n');
    
    return `USER SCREEN CONTEXT:\n${pgContext}\n\n${wbContext || "[No Whiteboards Visible]"}`;
  }, [whiteboards, playgrounds, activePlaygroundId]);

  // --- EFFECTS ---

  // 1. Load Everything on Mount
  useEffect(() => {
    // Load API Key (Always persistent if it was saved)
    const savedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (savedKey) setApiKey(savedKey);

    // Load Syllabus Gallery (Always persistent)
    const savedGallery = localStorage.getItem(STORAGE_KEYS.SYLLABUS_GALLERY);
    if (savedGallery) {
      try {
        setSyllabusGallery(JSON.parse(savedGallery));
      } catch (e) {
        console.error("Failed to load syllabus gallery", e);
      }
    }

    // Load Settings (Theme, Model, Storage Preference)
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    let shouldLoadSession = false;

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSaveToLocal(parsed.saveToLocal ?? false);
        setTheme(parsed.theme || DEFAULT_THEME);
        setModel(parsed.model || DEFAULT_MODEL);
        shouldLoadSession = parsed.saveToLocal;
      } catch (e) {
        console.error("Error parsing settings", e);
      }
    }

    // Load Session (Only if preference says so)
    if (shouldLoadSession) {
      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          setWhiteboards(parsed.whiteboards || []);
          setChatHistory(parsed.chatHistory || []);
          setPlaygrounds(parsed.playgrounds || []);
        } catch (e) {
          console.error("Error parsing session", e);
        }
      }
    }
  }, []);

  // 2. Save API Key (Always)
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    }
  }, [apiKey]);

  // 3. Save Syllabus Gallery (Always)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SYLLABUS_GALLERY, JSON.stringify(syllabusGallery));
  }, [syllabusGallery]);

  // 4. Save Settings (Always)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
      saveToLocal,
      theme,
      model
    }));
  }, [saveToLocal, theme, model]);

  // 5. Save Session (Conditional)
  useEffect(() => {
    if (saveToLocal) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
        whiteboards,
        chatHistory,
        playgrounds
      }));
    } else {
      // If toggled OFF, clear the session data from local storage to respect privacy
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  }, [saveToLocal, whiteboards, chatHistory, playgrounds]);

  // Theme application
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'chalkboard', 'blueprint');
    if (theme === AppTheme.DARK) root.classList.add('dark');
    else if (theme === AppTheme.CHALKBOARD) { root.classList.add('dark', 'chalkboard'); }
    else if (theme === AppTheme.BLUEPRINT) { root.classList.add('blueprint', 'dark'); }
    else root.classList.add('light');
  }, [theme]);

  // Resizing Logic
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
        const newWidth = document.body.clientWidth - e.clientX;
        if (newWidth > 300 && newWidth < document.body.clientWidth - 100) {
            setPlaygroundWidth(newWidth);
        }
    }
  }, [isResizing]);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (isResizing) {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
    }
    return () => {
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // --- HANDLERS ---

  const handleClearSession = () => {
    setWhiteboards([]);
    setChatHistory([]);
    setPlaygrounds([]);
    setActivePlaygroundId(null);
    setSyllabus(null);
    setInput('');
    setApiLogs([]);
    setPlaygroundPanelOpen(false);
  };

  const handleGenerate = async (topicOverride?: string) => {
    const topicToUse = topicOverride || input;
    if (!topicToUse.trim() || !apiKey) {
      if (!apiKey) alert("Please enter a Gemini API Key.");
      return;
    }

    setIsGenerating(true);
    setActiveTab(Tab.CLASSROOM);

    try {
      const analysis = await analyzeTopic(apiKey, topicToUse, model, addLog);
      const topicsToCover = analysis.isAbstract ? analysis.topics : [topicToUse];
      
      const CHUNK_SIZE = 4;
      let previousContext = whiteboards.slice(0, 2).map(w => w.topic).join(", "); 

      for (let i = 0; i < topicsToCover.length; i += CHUNK_SIZE) {
        const chunk = topicsToCover.slice(i, i + CHUNK_SIZE);
        const batchResults = await generateWhiteboardBatch(apiKey, chunk, previousContext, model, addLog);
        
        previousContext = batchResults.map(b => b.topic).join(", ");

        const newWhiteboards: WhiteboardData[] = batchResults.map(item => ({
          id: Date.now().toString() + Math.random(),
          topic: item.topic,
          svgContent: item.svg,
          explanation: item.explanation,
          timestamp: Date.now()
        }));

        setWhiteboards(prev => [...newWhiteboards.reverse(), ...prev]);
      }
      
      if(!topicOverride) setInput(''); 
    } catch (error) {
      console.error(error);
      alert("Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunchPlayground = async (topic: string) => {
    if (!apiKey) {
        alert("Please enter API Key");
        return;
    }

    setPlaygroundPanelOpen(true);
    
    // Check if exists
    const existing = playgrounds.find(p => p.description.includes(topic));
    if (existing) {
        setActivePlaygroundId(existing.id);
        return;
    }

    // 1. Create Placeholder for Loading
    const tempId = Date.now().toString();
    const placeholder: PlaygroundCode = {
        id: tempId,
        html: '',
        description: topic,
        timestamp: Date.now(),
        status: 'loading'
    };
    
    setPlaygrounds(prev => [...prev, placeholder]);
    setActivePlaygroundId(tempId);

    // 2. Fetch in background
    try {
      const codeData = await generatePlayground(apiKey, topic, model, addLog);
      setPlaygrounds(prev => prev.map(p => {
          if (p.id === tempId) {
              return { ...codeData, status: 'ready' as const, id: tempId };
          }
          return p;
      }));
    } catch (error) {
      console.error(error);
      setPlaygrounds(prev => prev.map(p => {
        if (p.id === tempId) {
            return { ...p, status: 'error' as const };
        }
        return p;
    }));
    }
  };

  const handleGenerateSyllabus = async (topic: string, level: CourseLevel) => {
      if (!apiKey) {
          alert("Please enter API Key");
          return;
      }
      setIsGeneratingSyllabus(true);
      
      const normalizedTopic = topic.trim().toLowerCase();
      
      // Find previous context from our saved gallery
      const relatedSyllabi = syllabusGallery.filter(s => 
          s.topic.toLowerCase().includes(normalizedTopic) || normalizedTopic.includes(s.topic.toLowerCase())
      );
      
      let context = '';
      if (relatedSyllabi.length > 0) {
          context = `Existing courses in database for similar topics:\n`;
          relatedSyllabi.forEach((s) => {
              context += `- Level ${s.level} (${s.topic}): ${s.description}\n`;
              context += `  Concepts covered: ${s.concepts.join(', ')}\n`;
          });
          context += `\nEnsure the new syllabus for Level "${level}" is distinct, progressive, and complementary to the above.`;
      }

      try {
          const result = await generateSyllabus(apiKey, topic, level, model, addLog, context);
          const newSyllabus: SyllabusData = {
              ...result,
              id: Date.now().toString(),
              timestamp: Date.now()
          };
          
          setSyllabus(newSyllabus);
          setSyllabusGallery(prev => [newSyllabus, ...prev]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingSyllabus(false);
      }
  };

  const handleDeleteSyllabus = (id: string) => {
      if (confirm("Remove this course from your gallery?")) {
          setSyllabusGallery(prev => prev.filter(s => s.id !== id));
          if (syllabus?.id === id) setSyllabus(null);
      }
  };

  const handleWhiteboardRefine = async (base64Image: string, prompt: string) => {
      setIsRefining(true);
      // Auto open chat to show result
      setIsChatOpen(true);
      try {
          const response = await analyzeImageWithContext(apiKey, base64Image, prompt, model, addLog);
          setChatHistory(prev => [...prev, 
              { id: Date.now().toString(), role: 'user', content: `[Sent Image Analysis Request]: ${prompt}`, timestamp: Date.now() },
              { id: (Date.now()+1).toString(), role: 'model', content: response, timestamp: Date.now() }
          ]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsRefining(false);
      }
  };

  const getBackgroundStyle = () => {
    switch (theme) {
      case AppTheme.CHALKBOARD: return 'bg-[#2b2b2b] text-gray-100';
      case AppTheme.BLUEPRINT: return 'bg-[#1e3a8a] text-blue-100';
      case AppTheme.DARK: return 'bg-gray-900 text-gray-100';
      default: return 'bg-[#fdfbf7] text-gray-900';
    }
  };

  const activePlayground = playgrounds.find(p => p.id === activePlaygroundId);

  return (
    <div className={`h-[100dvh] flex flex-col font-sans transition-colors duration-300 overflow-hidden ${getBackgroundStyle()}`}>
      <Header 
        theme={theme} setTheme={setTheme}
        model={model} setModel={setModel}
        apiKey={apiKey} setApiKey={setApiKey}
        onClearSession={handleClearSession}
        saveToLocal={saveToLocal} setSaveToLocal={setSaveToLocal}
        toggleAdvancedMode={() => setIsAdvancedModeOpen(!isAdvancedModeOpen)}
        onOpenSessionManager={() => setIsSessionManagerOpen(true)}
        playgroundOpen={playgroundPanelOpen}
        togglePlayground={() => setPlaygroundPanelOpen(!playgroundPanelOpen)}
        hasPlaygroundCode={playgrounds.length > 0}
      />

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Workspace */}
        <main className={`flex-1 overflow-y-auto w-full scroll-smooth flex flex-col ${playgroundPanelOpen ? 'hidden md:flex' : 'flex'}`}>
            {/* Tabs - Fixed shrink-0 to prevent disappearance on mobile */}
            <div className="flex-shrink-0 flex w-full border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab(Tab.CLASSROOM)}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === Tab.CLASSROOM ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Classroom
                </button>
                <button 
                    onClick={() => setActiveTab(Tab.SYLLABUS)}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === Tab.SYLLABUS ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Syllabus Architect
                </button>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8 pb-32 w-full flex-grow">
                
                {activeTab === Tab.CLASSROOM && (
                    <>
                        <div className="mb-12">
                            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                What would you like to learn today?
                            </label>
                            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="flex flex-col relative bg-white dark:bg-gray-900 transition-shadow shadow-inner">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Explain Quantum Physics, Calculus derivatives, or History of Rome..."
                                        className="w-full h-32 p-4 bg-transparent border-none focus:ring-0 resize-none text-base sm:text-lg outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                                        disabled={isGenerating}
                                    />
                                    <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                                        <Button onClick={() => handleGenerate()} disabled={isGenerating || !input.trim()} size="md">
                                            {isGenerating ? "Thinking..." : "Create Lesson"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-16">
                            {whiteboards.length === 0 && !isGenerating && (
                                <div className="text-center py-20 opacity-50">
                                    <p className="text-xl font-medium">Classroom is empty.</p>
                                </div>
                            )}

                            {whiteboards.map((wb) => (
                                <div key={wb.id} className="relative">
                                    <Whiteboard 
                                        topic={wb.topic} 
                                        svgContent={wb.svgContent} 
                                        explanation={wb.explanation}
                                        onRefine={handleWhiteboardRefine}
                                        isRefining={isRefining}
                                    />
                                    <div className="mt-4 flex justify-end">
                                        <Button variant="secondary" onClick={() => handleLaunchPlayground(wb.topic)}>
                                            Practice this Topic
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === Tab.SYLLABUS && (
                    <Syllabus 
                        data={syllabus} 
                        gallery={syllabusGallery}
                        onGenerate={handleGenerateSyllabus} 
                        isLoading={isGeneratingSyllabus}
                        onImportLevel={(topics) => handleGenerate(topics.join(", "))}
                        onDelete={handleDeleteSyllabus}
                        onSelect={setSyllabus}
                    />
                )}
            </div>
        </main>

        {/* Playground Panel (Split Pane for Desktop / Overlay for Mobile) */}
        {playgroundPanelOpen && (
           <>
            {/* Desktop Resizer */}
            <div 
              className={`hidden md:flex flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative transition-[width] ease-in-out flex-col shadow-2xl z-20 ${isResizing ? 'duration-0 select-none' : 'duration-300'}`}
              style={{ width: playgroundWidth }}
            >
               <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30"
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
               />
               <PlaygroundContent 
                  playgrounds={playgrounds} 
                  activePlaygroundId={activePlaygroundId} 
                  setActivePlaygroundId={setActivePlaygroundId} 
                  activePlayground={activePlayground}
                  onClose={() => setPlaygroundPanelOpen(false)}
               />
            </div>

            {/* Mobile Overlay */}
            <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-gray-900 flex flex-col">
               <PlaygroundContent 
                  playgrounds={playgrounds} 
                  activePlaygroundId={activePlaygroundId} 
                  setActivePlaygroundId={setActivePlaygroundId} 
                  activePlayground={activePlayground}
                  onClose={() => setPlaygroundPanelOpen(false)}
               />
            </div>
           </>
        )}
      </div>

      <ChatBot 
        isOpen={isChatOpen}
        toggleOpen={() => setIsChatOpen(!isChatOpen)}
        apiKey={apiKey} 
        model={model}
        history={chatHistory} 
        setHistory={setChatHistory}
        logger={addLog}
        context={chatContext} 
      />
      
      <ApiLogPanel 
        logs={apiLogs}
        isOpen={isAdvancedModeOpen}
        onClose={() => setIsAdvancedModeOpen(false)}
        onClear={() => setApiLogs([])}
      />

      <SessionManager 
        isOpen={isSessionManagerOpen}
        onClose={() => setIsSessionManagerOpen(false)}
        whiteboards={whiteboards}
        chatHistory={chatHistory}
        playgrounds={playgrounds}
        theme={theme}
        model={model}
        onImport={(data) => {
          setWhiteboards(data.whiteboards);
          setChatHistory(data.chatHistory);
          setPlaygrounds(data.playgrounds);
          setTheme(data.theme);
          setModel(data.model);
        }}
      />
    </div>
  );
};

// Extracted Content for Reusability between desktop split and mobile overlay
const PlaygroundContent: React.FC<{
    playgrounds: PlaygroundCode[],
    activePlaygroundId: string | null,
    setActivePlaygroundId: (id: string) => void,
    activePlayground: PlaygroundCode | undefined,
    onClose: () => void
}> = ({ playgrounds, activePlaygroundId, setActivePlaygroundId, activePlayground, onClose }) => (
    <div className="flex-1 overflow-hidden min-w-[300px] h-full flex flex-col">
        {playgrounds.length > 0 && (
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {playgrounds.map(pg => (
                    <button
                        key={pg.id}
                        onClick={() => setActivePlaygroundId(pg.id)}
                        className={`px-3 py-2 text-xs truncate max-w-[150px] flex items-center gap-2 ${activePlaygroundId === pg.id ? 'bg-white dark:bg-gray-900 border-t-2 border-blue-500 text-blue-600' : 'opacity-70 hover:opacity-100'}`}
                    >
                        {pg.status === 'loading' && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                        {pg.description}
                    </button>
                ))}
            </div>
        )}

        {activePlayground ? (
            <Playground code={activePlayground} onClose={onClose} />
        ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-gray-400 mb-4">No active playground.</p>
                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
        )}
    </div>
);

export default App;