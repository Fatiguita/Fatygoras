import { useEffect, useRef, useCallback } from 'react';
import { WhiteboardData, ChatMessage, PlaygroundCode, AppTheme, GeminiModel, SyllabusData, TestResult } from '../types';
import { AUTO_SAVE_TAG } from '../constants';
import { saveToDirectory, getStoredDirectoryHandle, clearStoredDirectoryHandle } from '../services/autoSaveService';
import { exportSessionToZip } from '../services/sessionService';

interface SessionState {
    whiteboards: WhiteboardData[];
    chatHistory: ChatMessage[];
    playgrounds: PlaygroundCode[];
    theme: AppTheme;
    model: GeminiModel;
    testResults: TestResult[];
    syllabus: SyllabusData | null;
    syllabusGallery: SyllabusData[];
}

export const useAutoSave = (
    sessionState: SessionState,
    autoSaveHandle: any,
    autoSaveInterval: number,
    autoSaveName: string,
    setAutoSaveHandle: (handle: any) => void,
    setPendingResumeHandle: (handle: any) => void,
    autoSaveTimerRef: React.MutableRefObject<number | null>,
    addLog: (entry: any) => void
) => {
    const sessionStateRef = useRef(sessionState);

    // Update ref when sessionState changes
    useEffect(() => {
        sessionStateRef.current = sessionState;
    }, [sessionState]);

    // Perform auto-save
    const performAutoSave = useCallback(async () => {
        if (!autoSaveHandle) return;

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

        const filename = `${autoSaveName}_${dateStr}_${AUTO_SAVE_TAG}.zip`;
        const currentData = sessionStateRef.current;

        try {
            const blob = await exportSessionToZip(
                currentData.whiteboards,
                currentData.chatHistory,
                currentData.playgrounds,
                currentData.theme,
                currentData.model,
                currentData.syllabus,
                currentData.syllabusGallery
            );

            await saveToDirectory(autoSaveHandle, filename, blob);
            addLog({ type: 'info', source: 'AutoSave', summary: `Saved session ZIP to ${filename}` });
        } catch (e) {
            console.error("Auto save failed", e);
            addLog({ type: 'error', source: 'AutoSave', summary: 'Failed to write file' });
        }
    }, [autoSaveHandle, autoSaveName, addLog]);

    // Handle stopping auto-save
    const handleStopAutoSave = useCallback(async () => {
        if (autoSaveTimerRef.current) {
            window.clearInterval(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        setAutoSaveHandle(null);
        await clearStoredDirectoryHandle();
        addLog({ type: 'info', source: 'AutoSave', summary: 'Auto-save stopped' });
    }, [autoSaveTimerRef, setAutoSaveHandle, addLog]);

    // Setup auto-save interval
    useEffect(() => {
        if (autoSaveHandle) {
            if (autoSaveTimerRef.current) window.clearInterval(autoSaveTimerRef.current);

            addLog({ type: 'info', source: 'AutoSave', summary: `Timer started: ${autoSaveInterval} mins` });

            autoSaveTimerRef.current = window.setInterval(() => {
                performAutoSave();
            }, autoSaveInterval * 60 * 1000);
        }
        return () => {
            if (autoSaveTimerRef.current) window.clearInterval(autoSaveTimerRef.current);
        };
    }, [autoSaveHandle, autoSaveInterval, performAutoSave, addLog, autoSaveTimerRef]);

    // Restore auto-save handle on mount
    useEffect(() => {
        const restoreAutoSaveHandle = async () => {
            try {
                const handle = await getStoredDirectoryHandle();
                if (handle) {
                    const permission = await handle.queryPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        setAutoSaveHandle(handle);
                        addLog({ type: 'info', source: 'AutoSave', summary: 'Restored previous folder connection automatically' });
                    } else {
                        setPendingResumeHandle(handle);
                        addLog({ type: 'info', source: 'AutoSave', summary: 'Previous folder found. Waiting for resume permission.' });
                    }
                }
            } catch (e) {
                console.error("Error restoring handle", e);
            }
        };
        restoreAutoSaveHandle();
    }, [setAutoSaveHandle, setPendingResumeHandle, addLog]);

    return { performAutoSave, handleStopAutoSave };
};
