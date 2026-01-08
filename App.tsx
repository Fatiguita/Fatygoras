import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import Whiteboard from './components/Whiteboard';
import ChatBot from './components/ChatBot';
import Playground from './components/Playground';
import Button from './components/Button';
import ApiLogPanel from './components/ApiLogPanel';
import SessionManager from './components/SessionManager';
import Syllabus from './components/Syllabus';
import LevelTest from './components/LevelTest';
import { 
  AppTheme, 
  GeminiModel, 
  WhiteboardData, 
  ChatMessage, 
  PlaygroundCode,
  ApiLogEntry,
  SyllabusData,
  CourseLevel,
  TestResult
} from './types';
import { 
  DEFAULT_THEME, 
  DEFAULT_MODEL, 
  STORAGE_KEYS,
  AUTO_SAVE_TAG
} from './constants';
import { 
  analyzeTopic, 
  generateWhiteboardBatch, 
  generatePlayground,
  generateSyllabus,
  generateQuizDatabase,
  generateLevelTestPlayground,
  analyzeImageWithContext 
} from './services/geminiService';
import { saveToDirectory, storeDirectoryHandle, getStoredDirectoryHandle } from './services/autoSaveService';

enum Tab {
  CLASSROOM = 'classroom',
  SYLLABUS = 'syllabus',
  LEVEL_TEST = 'level_test'
}

const App: React.FC = () => {
  // Helper for lazy loading settings
  const getInitialSettings = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return s ? JSON.parse(s) : {};
    } catch (e) { return {}; }
  };
  
  const settings = getInitialSettings();

  // --- STATE ---
  // Initialize state lazily from localStorage to ensure persistence overrides defaults
  const [theme, setTheme] = useState<AppTheme>(() => settings.theme || DEFAULT_THEME);
  const [model, setModel] = useState<GeminiModel>(() => settings.model || DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '');
  const [saveToLocal, setSaveToLocal] = useState(() => settings.saveToLocal || false);
  
  // Auto Save Settings (Lazy Load)
  const [autoSaveName, setAutoSaveName] = useState(() => settings.autoSaveName || 'MySession');
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => settings.autoSaveInterval || 5);
  const [autoSaveHandle, setAutoSaveHandle] = useState<any>(null);
  const [pendingResumeHandle, setPendingResumeHandle] = useState<any>(null); // Handle recovered from DB needing permission
  const autoSaveTimerRef = useRef<number | null>(null);

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
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<'practice' | 'test'>('practice');
  
  // Level Test State (Lazy Load)
  const [testResults, setTestResults] = useState<TestResult[]>(() => {
      try {
          const s = localStorage.getItem(STORAGE_KEYS.TEST_RESULTS);
          return s ? JSON.parse(s) : [];
      } catch (e) { return []; }
  });
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  // Syllabus State (Lazy Load)
  const [syllabus, setSyllabus] = useState<SyllabusData | null>(null);
  const [syllabusGallery, setSyllabusGallery] = useState<SyllabusData[]>(() => {
      try {
          const s = localStorage.getItem(STORAGE_KEYS.SYLLABUS_GALLERY);
          return s ? JSON.parse(s) : [];
      } catch (e) { return []; }
  });

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

  // Context construction
  const chatContext = useMemo(() => {
    const pg = playgrounds.find(p => p.id === activePlaygroundId);
    let pgContext = "[No Active Playground]";
    if (pg) pgContext = `[Active ${pg.type === 'test' ? 'Level Test' : 'Playground'}]: ${pg.description} (${pg.status})`;
    
    const wbContext = whiteboards.slice(0, 3).map(w => `[Whiteboard - ${w.topic}]: ${w.explanation.substring(0, 150)}...`).join('\n');
    return `USER SCREEN CONTEXT:\n${pgContext}\n\n${wbContext || "[No Whiteboards Visible]"}`;
  }, [whiteboards, playgrounds, activePlaygroundId]);

  // --- AUTO SAVE LOGIC ---
  // Use a Ref to hold latest state to avoid clearing the interval when state changes
  const sessionStateRef = useRef({
      whiteboards,
      chatHistory,
      playgrounds,
      theme,
      model,
      testResults
  });

  useEffect(() => {
      sessionStateRef.current = {
          whiteboards,
          chatHistory,
          playgrounds,
          theme,
          model,
          testResults
      };
  }, [whiteboards, chatHistory, playgrounds, theme, model, testResults]);

  const performAutoSave = async () => {
      if (!autoSaveHandle) return;
      
      const now = new Date();
      const timestamp = now.getTime();
      // Format: YYYY-MM-DD-HH-mm-ss
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      
      const filename = `${autoSaveName}_${dateStr}_${AUTO_SAVE_TAG}.json`;
      const currentData = sessionStateRef.current; // Read from ref

      const data = JSON.stringify({
          ...currentData,
          timestamp
      }, null, 2);

      try {
          await saveToDirectory(autoSaveHandle, filename, data);
          addLog({ type: 'info', source: 'AutoSave', summary: `Saved session to ${filename}` });
      } catch (e) {
          console.error("Auto save failed", e);
          addLog({ type: 'error', source: 'AutoSave', summary: 'Failed to write file' });
      }
  };

  useEffect(() => {
      if (autoSaveHandle) {
          if (autoSaveTimerRef.current) window.clearInterval(autoSaveTimerRef.current);
          
          addLog({ type: 'info', source: 'AutoSave', summary: `Timer started: ${autoSaveInterval} mins` });
          
          // Initial Save Immediately when timer starts? No, wait for interval.
          // Or saves immediately? Let's stick to interval.
          autoSaveTimerRef.current = window.setInterval(() => {
              performAutoSave();
          }, autoSaveInterval * 60 * 1000); // Minutes to MS
      }
      return () => {
          if (autoSaveTimerRef.current) window.clearInterval(autoSaveTimerRef.current);
      };
  }, [autoSaveHandle, autoSaveInterval]);

  // Restore Auto Save Handle from IndexedDB
  useEffect(() => {
      const restoreAutoSaveHandle = async () => {
          try {
              const handle = await getStoredDirectoryHandle();
              if (handle) {
                  // Check existing permission
                  const permission = await handle.queryPermission({ mode: 'readwrite' });
                  if (permission === 'granted') {
                      setAutoSaveHandle(handle);
                      addLog({ type: 'info', source: 'AutoSave', summary: 'Restored previous folder connection automatically' });
                  } else {
                      // Permission needs to be re-requested (requires user gesture)
                      setPendingResumeHandle(handle);
                      addLog({ type: 'info', source: 'AutoSave', summary: 'Previous folder found. Waiting for resume permission.' });
                  }
              }
          } catch (e) {
              console.error("Error restoring handle", e);
          }
      };
      restoreAutoSaveHandle();
  }, []);

  const handleResumeAutoSave = async () => {
      if (!pendingResumeHandle) return;
      try {
          const permission = await pendingResumeHandle.requestPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
              setAutoSaveHandle(pendingResumeHandle);
              setPendingResumeHandle(null);
              addLog({ type: 'info', source: 'AutoSave', summary: 'Auto-save resumed successfully' });
          }
      } catch (e) {
          console.error("Permission request failed", e);
      }
  };

  // --- EFFECTS ---

  // Load Session Content on Mount if enabled
  // We use a useEffect with empty deps because saveToLocal is initialized correctly from lazy storage
  useEffect(() => {
    if (saveToLocal) {
        try {
          const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed.whiteboards) setWhiteboards(parsed.whiteboards);
            if (parsed.chatHistory) setChatHistory(parsed.chatHistory);
            if (parsed.playgrounds) setPlaygrounds(parsed.playgrounds);
          }
        } catch (e) { console.error("Failed to load session", e); }
    }
  }, []);

  // Persistence Effects
  useEffect(() => { if (apiKey) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SYLLABUS_GALLERY, JSON.stringify(syllabusGallery)); }, [syllabusGallery]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TEST_RESULTS, JSON.stringify(testResults)); }, [testResults]);
  
  // Consolidated Settings Persistence
  useEffect(() => { 
    const currentSettings = { 
        saveToLocal, 
        theme, 
        model, 
        autoSaveName, 
        autoSaveInterval 
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings)); 
  }, [saveToLocal, theme, model, autoSaveName, autoSaveInterval]);

  useEffect(() => {
    if (saveToLocal) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ whiteboards, chatHistory, playgrounds }));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  }, [saveToLocal, whiteboards, chatHistory, playgrounds]);

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

  const handleUpdateAutoSaveSettings = (interval: number, name: string) => {
      setAutoSaveInterval(interval);
      setAutoSaveName(name);
  };

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

  const handleGenerate = async (topicOverride?: string, mainTopicContext?: string) => {
    const topicToUse = topicOverride || input;
    const effectiveMainTopic = mainTopicContext || topicToUse;

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
        // We now pass effectiveMainTopic as the main topic context
        // If coming from Syllabus, mainTopicContext preserves the original Syllabus topic.
        const batchResults = await generateWhiteboardBatch(apiKey, chunk, previousContext, model, effectiveMainTopic, addLog);
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
    if (!apiKey) { alert("Please enter API Key"); return; }

    setPlaygroundPanelOpen(true);
    setActivePlaygroundTab('practice');
    
    const existing = playgrounds.find(p => p.description.includes(topic) && p.type === 'practice');
    if (existing) {
        setActivePlaygroundId(existing.id);
        return;
    }

    const tempId = Date.now().toString();
    const placeholder: PlaygroundCode = {
        id: tempId,
        html: '',
        description: topic,
        timestamp: Date.now(),
        status: 'loading',
        type: 'practice',
        model: model // Track model
    };
    
    setPlaygrounds(prev => [...prev, placeholder]);
    setActivePlaygroundId(tempId);

    try {
      const codeData = await generatePlayground(apiKey, topic, model, addLog);
      setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...codeData, status: 'ready', id: tempId, type: 'practice', model: model } : p));
    } catch (error) {
      setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error' } : p));
    }
  };

  const handleCreateLevelTest = async (topic: string, selectedModel: GeminiModel) => {
      if (!apiKey) { alert("Please enter API Key"); return; }
      setIsGeneratingTest(true);
      setPlaygroundPanelOpen(true);
      setActivePlaygroundTab('test');
      
      const tempId = Date.now().toString();
      const placeholder: PlaygroundCode = {
          id: tempId,
          html: '',
          description: `Test: ${topic}`,
          timestamp: Date.now(),
          status: 'loading',
          type: 'test',
          relatedTopic: topic,
          model: selectedModel 
      };

      setPlaygrounds(prev => [...prev, placeholder]);
      setActivePlaygroundId(tempId);

      try {
          const levels: CourseLevel[] = ['Introduction', 'Beginner', 'Intermediate', 'Advanced', 'Master'];
          let accumulatedSyllabusContext = "";

          for (const level of levels) {
              // OPTIMIZATION: Check if we already have this specific topic+level in the gallery
              const existingSyllabus = syllabusGallery.find(s => 
                  s.topic.trim().toLowerCase() === topic.trim().toLowerCase() && 
                  s.level === level
              );

              if (existingSyllabus) {
                  accumulatedSyllabusContext += JSON.stringify(existingSyllabus) + "\n";
                  addLog({ type: 'info', source: 'LevelTest', summary: `Using existing syllabus for ${level}`, details: existingSyllabus });
              } else {
                  // If not found, generate it and Add to gallery
                  const s = await generateSyllabus(apiKey, topic, level, selectedModel, addLog, accumulatedSyllabusContext);
                  accumulatedSyllabusContext += JSON.stringify(s) + "\n";
                  setSyllabusGallery(prev => [{...s, id: Date.now().toString() + Math.random()}, ...prev]);
              }
          }

          const quizDbJson = await generateQuizDatabase(apiKey, topic, accumulatedSyllabusContext, selectedModel, addLog);
          const testApp = await generateLevelTestPlayground(apiKey, topic, quizDbJson, selectedModel, addLog);
          
          setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...testApp, status: 'ready', id: tempId, type: 'test', relatedTopic: topic, model: selectedModel } : p));

          // Init pending result
          setTestResults(prev => [...prev, {
              id: tempId, 
              topic: topic,
              levelAssigned: 'Pending',
              score: 0,
              maxScore: 0,
              timestamp: Date.now()
          }]);

      } catch (error) {
          console.error(error);
          setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error' } : p));
          alert("Failed to generate level test. Please try again.");
      } finally {
          setIsGeneratingTest(false);
      }
  };

  const handleTestComplete = (data: any) => {
      setTestResults(prev => prev.map(res => {
          if (res.id === data.testId) {
              return {
                  ...res,
                  levelAssigned: data.level || 'Unknown',
                  score: data.score || 0,
                  maxScore: data.maxScore || 0
              };
          }
          return res;
      }));
      addLog({ type: 'info', source: 'LevelTest', summary: 'Received test results', details: data });
  };

  const handleRetryPlayground = async () => {
     if(!activePlaygroundId || !apiKey) return;
     const pg = playgrounds.find(p => p.id === activePlaygroundId);
     if(!pg) return;

     const modelToUse = pg.model || model;

     if (pg.type === 'test') {
         const topic = pg.relatedTopic || pg.description.replace('Test: ', '');
         closePlayground(pg.id);
         handleCreateLevelTest(topic, modelToUse);
         return;
     }

     setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...p, status: 'loading' } : p));
     try {
         const topic = pg.description.replace('Playground: ', '');
         const codeData = await generatePlayground(apiKey, topic, modelToUse, addLog);
         setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...codeData, status: 'ready', id: pg.id, type: 'practice', model: modelToUse } : p));
     } catch(e) {
         setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...p, status: 'error' } : p));
     }
  };

  const handleGenerateSyllabus = async (topic: string, level: CourseLevel) => {
      if (!apiKey) { alert("Please enter API Key"); return; }
      setIsGeneratingSyllabus(true);
      const normalizedTopic = topic.trim().toLowerCase();
      const relatedSyllabi = syllabusGallery.filter(s => s.topic.toLowerCase().includes(normalizedTopic));
      let context = '';
      if (relatedSyllabi.length > 0) {
          // Changed to include concepts (subtopics) in context
          context = `Existing courses:\n` + relatedSyllabi.map(s => `- ${s.level} (${s.topic}): ${s.concepts.join(', ')}`).join('\n');
      }

      try {
          const result = await generateSyllabus(apiKey, topic, level, model, addLog, context);
          const newSyllabus: SyllabusData = { ...result, id: Date.now().toString(), timestamp: Date.now() };
          setSyllabus(newSyllabus);
          setSyllabusGallery(prev => [newSyllabus, ...prev]);
      } catch (e) { console.error(e); } finally { setIsGeneratingSyllabus(false); }
  };

  const handleWhiteboardRefine = async (base64Image: string, prompt: string) => {
      setIsRefining(true);
      setIsChatOpen(true);
      try {
          const response = await analyzeImageWithContext(apiKey, base64Image, prompt, model, addLog);
          setChatHistory(prev => [...prev, 
              { id: Date.now().toString(), role: 'user', content: `[Image Analysis]: ${prompt}`, timestamp: Date.now() },
              { id: (Date.now()+1).toString(), role: 'model', content: response, timestamp: Date.now() }
          ]);
      } catch (e) { console.error(e); } finally { setIsRefining(false); }
  };

  const closePlayground = (id: string) => {
      setPlaygrounds(prev => prev.filter(p => p.id !== id));
      if (activePlaygroundId === id) setActivePlaygroundId(null);
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
        onResumeAutoSave={pendingResumeHandle ? handleResumeAutoSave : undefined}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto w-full scroll-smooth flex flex-col ${playgroundPanelOpen ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex-shrink-0 flex w-full border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab(Tab.CLASSROOM)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === Tab.CLASSROOM ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}>Classroom</button>
                <button onClick={() => setActiveTab(Tab.SYLLABUS)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === Tab.SYLLABUS ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700'}`}>Syllabus Architect</button>
                <button onClick={() => setActiveTab(Tab.LEVEL_TEST)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === Tab.LEVEL_TEST ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400' : 'text-gray-500 hover:text-gray-700'}`}>Level Test</button>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8 pb-32 w-full flex-grow">
                {activeTab === Tab.CLASSROOM && (
                    <>
                        <div className="mb-12">
                            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">What would you like to learn today?</label>
                            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="flex flex-col relative bg-white dark:bg-gray-900 transition-shadow shadow-inner">
                                    <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Explain Quantum Physics..." className="w-full h-32 p-4 bg-transparent border-none focus:ring-0 resize-none text-base sm:text-lg outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400" disabled={isGenerating} />
                                    <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                                        <Button onClick={() => handleGenerate()} disabled={isGenerating || !input.trim()} size="md">{isGenerating ? "Thinking..." : "Create Lesson"}</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-16">
                            {whiteboards.length === 0 && !isGenerating && <div className="text-center py-20 opacity-50"><p className="text-xl font-medium">Classroom is empty.</p></div>}
                            {whiteboards.map((wb) => (
                                <div key={wb.id} className="relative">
                                    <Whiteboard topic={wb.topic} svgContent={wb.svgContent} explanation={wb.explanation} onRefine={handleWhiteboardRefine} isRefining={isRefining} />
                                    <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => handleLaunchPlayground(wb.topic)}>Practice this Topic</Button></div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {activeTab === Tab.SYLLABUS && <Syllabus data={syllabus} gallery={syllabusGallery} onGenerate={handleGenerateSyllabus} isLoading={isGeneratingSyllabus} onImportLevel={(topics, mainTopic) => handleGenerate(topics.join(", "), mainTopic)} onDelete={(id) => setSyllabusGallery(prev => prev.filter(s => s.id !== id))} onSelect={setSyllabus} />}
                {activeTab === Tab.LEVEL_TEST && <LevelTest onStartTest={handleCreateLevelTest} isGenerating={isGeneratingTest} results={testResults} />}
            </div>
        </main>

        {playgroundPanelOpen && (
           <>
            <div className={`hidden md:flex flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative transition-[width] ease-in-out flex-col shadow-2xl z-20 ${isResizing ? 'duration-0 select-none' : 'duration-300'}`} style={{ width: playgroundWidth }}>
               <div className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }} />
               <PlaygroundContent 
                  playgrounds={playgrounds} 
                  activePlaygroundId={activePlaygroundId} 
                  setActivePlaygroundId={setActivePlaygroundId} 
                  activePlaygroundTab={activePlaygroundTab}
                  setActivePlaygroundTab={setActivePlaygroundTab}
                  activePlayground={activePlayground}
                  onClose={() => setPlaygroundPanelOpen(false)}
                  onCloseItem={closePlayground}
                  onRetry={handleRetryPlayground}
                  onTestComplete={handleTestComplete}
               />
            </div>
            <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-gray-900 flex flex-col">
               <PlaygroundContent 
                  playgrounds={playgrounds} 
                  activePlaygroundId={activePlaygroundId} 
                  setActivePlaygroundId={setActivePlaygroundId} 
                  activePlaygroundTab={activePlaygroundTab}
                  setActivePlaygroundTab={setActivePlaygroundTab}
                  activePlayground={activePlayground}
                  onClose={() => setPlaygroundPanelOpen(false)}
                  onCloseItem={closePlayground}
                  onRetry={handleRetryPlayground}
                  onTestComplete={handleTestComplete}
               />
            </div>
           </>
        )}
      </div>

      <ChatBot isOpen={isChatOpen} toggleOpen={() => setIsChatOpen(!isChatOpen)} apiKey={apiKey} model={model} history={chatHistory} setHistory={setChatHistory} logger={addLog} context={chatContext} />
      <ApiLogPanel logs={apiLogs} isOpen={isAdvancedModeOpen} onClose={() => setIsAdvancedModeOpen(false)} onClear={() => setApiLogs([])} />
      
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
        autoSaveActive={!!autoSaveHandle}
        onConfigureAutoSave={async (handle, interval, name) => {
            // Intercept to store in DB
            await storeDirectoryHandle(handle);
            setAutoSaveHandle(handle);
            setAutoSaveInterval(interval);
            setAutoSaveName(name);
        }}
        onUpdateAutoSaveSettings={handleUpdateAutoSaveSettings}
        initialAutoSaveName={autoSaveName}
        initialAutoSaveInterval={autoSaveInterval}
      />
    </div>
  );
};

const PlaygroundContent: React.FC<{
    playgrounds: PlaygroundCode[],
    activePlaygroundId: string | null,
    setActivePlaygroundId: (id: string) => void,
    activePlaygroundTab: 'practice' | 'test',
    setActivePlaygroundTab: (t: 'practice' | 'test') => void,
    activePlayground: PlaygroundCode | undefined,
    onClose: () => void,
    onCloseItem: (id: string) => void,
    onRetry: () => void,
    onTestComplete: (res: any) => void
}> = ({ playgrounds, activePlaygroundId, setActivePlaygroundId, activePlaygroundTab, setActivePlaygroundTab, activePlayground, onClose, onCloseItem, onRetry, onTestComplete }) => {
    
    // Filter playgrounds by tab type
    const visiblePlaygrounds = playgrounds.filter(p => p.type === activePlaygroundTab);

    return (
    <div className="flex-1 overflow-hidden min-w-[300px] h-full flex flex-col">
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
             <button onClick={() => setActivePlaygroundTab('practice')} className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider ${activePlaygroundTab === 'practice' ? 'bg-white dark:bg-gray-900 border-t-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>Practice Apps</button>
             <button onClick={() => setActivePlaygroundTab('test')} className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider ${activePlaygroundTab === 'test' ? 'bg-white dark:bg-gray-900 border-t-2 border-orange-500 text-orange-600' : 'text-gray-500'}`}>Level Tests</button>
        </div>

        {visiblePlaygrounds.length > 0 && (
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 no-scrollbar">
                {visiblePlaygrounds.map(pg => (
                    <div key={pg.id} className={`flex items-center group max-w-[160px] border-r border-gray-200 dark:border-gray-700 ${activePlaygroundId === pg.id ? 'bg-white dark:bg-gray-900' : 'opacity-80 hover:opacity-100'}`}>
                        <button
                            onClick={() => setActivePlaygroundId(pg.id)}
                            className={`px-3 py-2 text-xs truncate flex-1 text-left flex items-center gap-2 ${activePlaygroundId === pg.id ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
                        >
                            {pg.status === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                            {pg.description}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCloseItem(pg.id); }}
                            className="p-1 mx-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >×</button>
                    </div>
                ))}
            </div>
        )}

        {activePlayground ? (
            <Playground code={activePlayground} onClose={onClose} onRetry={onRetry} onTestComplete={onTestComplete} />
        ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-gray-400 mb-4">No active app selected.</p>
                <Button variant="ghost" size="sm" onClick={onClose}>Close Panel</Button>
            </div>
        )}
    </div>
)};

export default App;
