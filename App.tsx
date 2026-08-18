import React, { useMemo } from 'react';
import Header from './components/Header';
import ChatBot from './components/ChatBot';
import ApiLogPanel from './components/ApiLogPanel';
import SessionManager from './components/SessionManager';
import Syllabus from './components/Syllabus';
import LevelTest from './components/LevelTest';
import RemediationToast from './components/RemediationToast';
import { PresenterMode } from './components/Presenter/PresenterMode';
import { ClassroomTab } from './components/ClassroomTab';
import { PlaygroundPanel } from './components/PlaygroundPanel';
import { useAppState } from './hooks/useAppState';
import { useAutoSave } from './hooks/useAutoSave';
import { useLocalStorage, loadSessionFromStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { usePlaygroundResize, useFullscreenListener } from './hooks/usePlaygroundResize';
import { useLogger, useChatContext } from './hooks/useLogger';
import { Tab, getBackgroundStyle } from './appConstants';
import { createGenerationHandlers } from './handlers/generationHandlers';
import { createPlaygroundHandlers } from './handlers/playgroundHandlers';
import { createCommonHandlers } from './handlers/commonHandlers';
import { storeDirectoryHandle, getActiveDocument } from './services/autoSaveService';

const App: React.FC = () => {
    // Initialize all state
    const appState = useAppState();

    // Setup all hooks
    useTheme(appState.theme);
    usePlaygroundResize(appState.isResizing, appState.setIsResizing, appState.setPlaygroundWidth);
    useFullscreenListener(appState.setIsFullscreen);

    // Logger hook
    const addLog = useLogger(appState.setApiLogs);

    // Hydrate active document context from IndexedDB on mount
    React.useEffect(() => {
        const hydrateDocumentContext = async () => {
            const doc = await getActiveDocument();
            if (doc) {
                appState.setActiveDocText(doc.text);
                appState.setActiveDocName(doc.name);
            }
        };
        hydrateDocumentContext();
    }, []);

    // Auto-save hook
    useAutoSave(
        {
            whiteboards: appState.whiteboards,
            chatHistory: appState.chatHistory,
            playgrounds: appState.playgrounds,
            theme: appState.theme,
            model: appState.model,
            testResults: appState.testResults,
            syllabus: appState.syllabus,
            syllabusGallery: appState.syllabusGallery
        },
        appState.autoSaveHandle,
        appState.autoSaveInterval,
        appState.autoSaveName,
        appState.setAutoSaveHandle,
        appState.setPendingResumeHandle,
        appState.autoSaveTimerRef,
        addLog
    );

    // Local storage persistence
    useLocalStorage(
        appState.apiKey,
        appState.syllabusGallery,
        appState.testResults,
        appState.saveToLocal,
        appState.theme,
        appState.model,
        appState.autoSaveName,
        appState.autoSaveInterval,
        appState.whiteboards,
        appState.chatHistory,
        appState.playgrounds
    );

    // Load session from storage on mount
    useMemo(() => {
        if (appState.saveToLocal) {
            const savedSession = loadSessionFromStorage();
            if (savedSession) {
                appState.setWhiteboards(savedSession.whiteboards);
                appState.setChatHistory(savedSession.chatHistory);
                appState.setPlaygrounds(savedSession.playgrounds);
            }
        }
    }, []);

    // Chat context
    const chatContext = useChatContext(appState.playgrounds, appState.activePlaygroundId, appState.whiteboards);

    // Create handlers
    const generationHandlers = createGenerationHandlers(
        appState.apiKey,
        appState.model,
        appState.input,
        appState.whiteboards,
        appState.playgrounds,
        appState.syllabusGallery,
        appState.setInput,
        appState.setIsGenerating,
        appState.setActiveTab,
        appState.setWhiteboards,
        appState.setPlaygroundPanelOpen,
        appState.setActivePlaygroundTab,
        appState.setPlaygrounds,
        appState.setActivePlaygroundId,
        appState.setIsGeneratingSyllabus,
        appState.setSyllabusGallery,
        appState.setIsChatOpen,
        appState.setChatHistory,
        appState.setIsRefining,
        addLog,
        appState.activeDocText,
        appState.activeDocName
    );

    const playgroundHandlers = createPlaygroundHandlers(
        appState.apiKey,
        appState.model,
        appState.playgrounds,
        appState.whiteboards,
        appState.input,
        appState.syllabusGallery,
        appState.activePlaygroundId,
        appState.setPlaygrounds,
        appState.setActivePlaygroundId,
        appState.setPlaygroundPanelOpen,
        appState.setActivePlaygroundTab,
        appState.setIsGeneratingTest,
        appState.setSyllabusGallery,
        appState.setTestResults,
        appState.setRemediationQueue,
        appState.setShowRemediationToast,
        addLog
    );

    const commonHandlers = createCommonHandlers(
        appState.setWhiteboards,
        appState.setChatHistory,
        appState.setPlaygrounds,
        appState.setActivePlaygroundId,
        appState.setSyllabus,
        appState.setInput,
        appState.setApiLogs,
        appState.setPlaygroundPanelOpen,
        appState.setAutoSaveInterval,
        appState.setAutoSaveName,
        appState.setAutoSaveHandle,
        appState.setPendingResumeHandle,
        appState.setRemediationQueue,
        appState.setShowRemediationToast,
        addLog
    );

    const handleResumeAutoSave = async () => {
        await commonHandlers.handleResumeAutoSave(appState.pendingResumeHandle);
    };

    // For handleRetryPlayground we need to pass handleGenerate
    const handleRetryPlayground = async () => {
        await playgroundHandlers.handleRetryPlayground();
    };

    const handleRunRemediation = (selectedTopics: string[]) => {
        commonHandlers.handleRunRemediation(selectedTopics, generationHandlers.handleGenerate);
    };

    const handleStopAutoSave = async () => {
        if (appState.autoSaveTimerRef.current) {
            window.clearInterval(appState.autoSaveTimerRef.current);
            appState.autoSaveTimerRef.current = null;
        }
        appState.setAutoSaveHandle(null);
        addLog({ type: 'info', source: 'AutoSave', summary: 'Auto-save stopped' });
    };

    const activePlayground = appState.playgrounds.find(p => p.id === appState.activePlaygroundId);

    return (
        <div className={`h-[100dvh] flex flex-col font-sans transition-colors duration-300 overflow-hidden ${getBackgroundStyle(appState.theme)}`}>
            {appState.isResizing && (
                <div className="fixed inset-0 z-[9999] cursor-ew-resize bg-transparent" />
            )}

            {!appState.isFullscreen && (
                <Header
                    theme={appState.theme} setTheme={appState.setTheme}
                    model={appState.model} setModel={appState.setModel}
                    apiKey={appState.apiKey} setApiKey={appState.setApiKey}
                    onClearSession={commonHandlers.handleClearSession}
                    saveToLocal={appState.saveToLocal} setSaveToLocal={appState.setSaveToLocal}
                    toggleAdvancedMode={() => appState.setIsAdvancedModeOpen(!appState.isAdvancedModeOpen)}
                    onOpenSessionManager={() => appState.setIsSessionManagerOpen(true)}
                    playgroundOpen={appState.playgroundPanelOpen}
                    togglePlayground={() => appState.setPlaygroundPanelOpen(!appState.playgroundPanelOpen)}
                    hasPlaygroundCode={appState.playgrounds.length > 0}
                    onResumeAutoSave={appState.pendingResumeHandle ? handleResumeAutoSave : undefined}
                    isNavVisible={appState.isNavVisible}
                    onToggleNav={() => appState.setIsNavVisible(!appState.isNavVisible)}
                />
            )}

            <div className="flex-1 flex overflow-hidden relative">
                <main className={`flex-1 overflow-y-auto w-full scroll-smooth flex flex-col ${appState.playgroundPanelOpen ? 'hidden md:flex' : 'flex'}`}>
                    {!appState.isFullscreen && (
                        <div className={`flex-shrink-0 w-full bg-white/50 dark:bg-gray-900/50 backdrop-blur sticky top-0 z-10 transition-all duration-300 ease-in-out overflow-hidden ${appState.isNavVisible ? 'max-h-16 opacity-100 border-b border-gray-200 dark:border-gray-700' : 'max-h-0 opacity-0 border-none'}`}>
                            <div className="flex overflow-x-auto no-scrollbar">
                                <button onClick={() => appState.setActiveTab(Tab.CLASSROOM)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${appState.activeTab === Tab.CLASSROOM ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}>Classroom</button>
                                <button onClick={() => appState.setActiveTab(Tab.SYLLABUS)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${appState.activeTab === Tab.SYLLABUS ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700'}`}>Syllabus Architect</button>
                                <button onClick={() => appState.setActiveTab(Tab.LEVEL_TEST)} className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${appState.activeTab === Tab.LEVEL_TEST ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400' : 'text-gray-500 hover:text-gray-700'}`}>Level Test</button>
                                <button
                                    onClick={() => appState.setActiveTab(Tab.PRESENTATION)}
                                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${appState.activeTab === Tab.PRESENTATION ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Theater Mode
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`${(appState.activeTab === Tab.PRESENTATION && appState.isFullscreen) ? 'w-full h-full p-0 max-w-none' : 'max-w-5xl mx-auto px-4 py-8 pb-32 w-full'} flex-grow relative transition-all duration-300`}>
                        {appState.activeTab === Tab.CLASSROOM && (
                            <ClassroomTab
                                input={appState.input}
                                setInput={appState.setInput}
                                isGenerating={appState.isGenerating}
                                whiteboards={appState.whiteboards}
                                isRefining={appState.isRefining}
                                onGenerate={generationHandlers.handleGenerate}
                                onLaunchPlayground={generationHandlers.handleLaunchPlayground}
                                onWhiteboardRefine={generationHandlers.handleWhiteboardRefine}
                            />
                        )}
                        {appState.activeTab === Tab.SYLLABUS && (
                            <Syllabus
                                data={appState.syllabus}
                                gallery={appState.syllabusGallery}
                                onGenerate={generationHandlers.handleGenerateSyllabus}
                                onGenerateProject={generationHandlers.handleGenerateProjectRoadmap}
                                isLoading={appState.isGeneratingSyllabus}
                                onImportLevel={(topics, mainTopic) => generationHandlers.handleGenerate(topics.join(", "), mainTopic)}
                                onDelete={(id) => appState.setSyllabusGallery(prev => prev.filter(s => s.id !== id))}
                                onSelect={appState.setSyllabus}
                                activeDocText={appState.activeDocText}
                                setActiveDocText={appState.setActiveDocText}
                                activeDocName={appState.activeDocName}
                                setActiveDocName={appState.setActiveDocName}
                            />
                        )}
                        {appState.activeTab === Tab.LEVEL_TEST && <LevelTest onStartTest={playgroundHandlers.handleCreateLevelTest} isGenerating={appState.isGeneratingTest} results={appState.testResults} />}

                        {appState.activeTab === Tab.PRESENTATION && (
                            <div className="absolute inset-0 z-20 overflow-hidden">
                                <PresenterMode initialWhiteboards={appState.whiteboards} />
                            </div>
                        )}
                    </div>
                </main>

                {appState.playgroundPanelOpen && (
                    <>
                        <div className={`hidden md:flex flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative transition-[width] ease-in-out flex-col shadow-2xl z-20 ${appState.isResizing ? 'duration-0 select-none' : 'duration-300'}`} style={{ width: appState.playgroundWidth }}>
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30" onMouseDown={(e) => { e.preventDefault(); appState.setIsResizing(true); }} />
                            <PlaygroundPanel
                                playgrounds={appState.playgrounds}
                                activePlaygroundId={appState.activePlaygroundId}
                                setActivePlaygroundId={appState.setActivePlaygroundId}
                                activePlaygroundTab={appState.activePlaygroundTab}
                                setActivePlaygroundTab={appState.setActivePlaygroundTab}
                                activePlayground={activePlayground}
                                onClose={() => appState.setPlaygroundPanelOpen(false)}
                                onCloseItem={playgroundHandlers.closePlayground}
                                onRetry={handleRetryPlayground}
                                onTestComplete={playgroundHandlers.handleTestComplete}
                            />
                        </div>
                        <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-gray-900 flex flex-col">
                            <PlaygroundPanel
                                playgrounds={appState.playgrounds}
                                activePlaygroundId={appState.activePlaygroundId}
                                setActivePlaygroundId={appState.setActivePlaygroundId}
                                activePlaygroundTab={appState.activePlaygroundTab}
                                setActivePlaygroundTab={appState.setActivePlaygroundTab}
                                activePlayground={activePlayground}
                                onClose={() => appState.setPlaygroundPanelOpen(false)}
                                onCloseItem={playgroundHandlers.closePlayground}
                                onRetry={handleRetryPlayground}
                                onTestComplete={playgroundHandlers.handleTestComplete}
                            />
                        </div>
                    </>
                )}
            </div>

            {appState.activeTab !== Tab.PRESENTATION && (
                <ChatBot isOpen={appState.isChatOpen} toggleOpen={() => appState.setIsChatOpen(!appState.isChatOpen)} apiKey={appState.apiKey} model={appState.model} history={appState.chatHistory} setHistory={appState.setChatHistory} logger={addLog} context={chatContext} />
            )}

            <RemediationToast 
                isVisible={appState.showRemediationToast} 
                concepts={appState.remediationQueue} 
                onDismiss={() => { appState.setShowRemediationToast(false); appState.setRemediationQueue([]); }}
                onFixGaps={handleRunRemediation}
            />

            <ApiLogPanel
                logs={appState.apiLogs}
                isOpen={appState.isAdvancedModeOpen}
                onClose={() => appState.setIsAdvancedModeOpen(false)}
                onClear={() => appState.setApiLogs([])}
            />

            <SessionManager
                isOpen={appState.isSessionManagerOpen}
                onClose={() => appState.setIsSessionManagerOpen(false)}
                whiteboards={appState.whiteboards}
                chatHistory={appState.chatHistory}
                playgrounds={appState.playgrounds}
                syllabus={appState.syllabus}
                syllabusGallery={appState.syllabusGallery}
                theme={appState.theme}
                model={appState.model}
                onImport={(data) => {
                    appState.setWhiteboards(data.whiteboards);
                    appState.setChatHistory(data.chatHistory);
                    appState.setPlaygrounds(data.playgrounds);
                    appState.setTheme(data.theme);
                    appState.setModel(data.model);
                    if (data.syllabus) appState.setSyllabus(data.syllabus);
                    if (data.syllabusGallery) appState.setSyllabusGallery(data.syllabusGallery);
                }}
                autoSaveActive={!!appState.autoSaveHandle}
                onConfigureAutoSave={async (handle, interval, name) => {
                    await storeDirectoryHandle(handle);
                    appState.setAutoSaveHandle(handle);
                    appState.setAutoSaveInterval(interval);
                    appState.setAutoSaveName(name);
                }}
                onUpdateAutoSaveSettings={commonHandlers.handleUpdateAutoSaveSettings}
                onStopAutoSave={handleStopAutoSave}
                initialAutoSaveName={appState.autoSaveName}
                initialAutoSaveInterval={appState.autoSaveInterval}
            />
        </div>
    );
};

export default App;