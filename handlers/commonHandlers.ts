import { PlaygroundCode, WhiteboardData, ChatMessage, ApiLogEntry } from '../types';

export const createCommonHandlers = (
    setWhiteboards: (wbs: WhiteboardData[]) => void,
    setChatHistory: (history: ChatMessage[]) => void,
    setPlaygrounds: (pgs: PlaygroundCode[]) => void,
    setActivePlaygroundId: (id: string | null) => void,
    setSyllabus: (syllabus: any | null) => void,
    setInput: (input: string) => void,
    setApiLogs: (logs: ApiLogEntry[]) => void,
    setPlaygroundPanelOpen: (open: boolean) => void,
    setAutoSaveInterval: (interval: number) => void,
    setAutoSaveName: (name: string) => void,
    setAutoSaveHandle: (handle: any) => void,
    setPendingResumeHandle: (handle: any) => void,
    setRemediationQueue: (queue: string[]) => void,
    setShowRemediationToast: (show: boolean) => void,
    addLog: (entry: any) => void
) => {
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

    const handleRunRemediation = (selectedTopics: string[], handleGenerate: (prompt?: string) => Promise<void>) => {
        setShowRemediationToast(false);
        setRemediationQueue([]);
        const prompt = `Fail on this topic, please generate: ${selectedTopics.join(', ')}`;
        handleGenerate(prompt);
    };

    const handleResumeAutoSave = async (pendingResumeHandle: any) => {
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

    const handleUpdateAutoSaveSettings = (interval: number, name: string) => {
        setAutoSaveInterval(interval);
        setAutoSaveName(name);
    };

    return { handleClearSession, handleRunRemediation, handleResumeAutoSave, handleUpdateAutoSaveSettings };
};
