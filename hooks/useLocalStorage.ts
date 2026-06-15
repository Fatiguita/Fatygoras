import { useEffect } from 'react';
import { WhiteboardData, ChatMessage, PlaygroundCode, AppTheme, GeminiModel, SyllabusData, TestResult } from '../types';
import { STORAGE_KEYS } from '../constants';

export const useLocalStorage = (
    apiKey: string,
    syllabusGallery: SyllabusData[],
    testResults: TestResult[],
    saveToLocal: boolean,
    theme: AppTheme,
    model: GeminiModel,
    autoSaveName: string,
    autoSaveInterval: number,
    whiteboards: WhiteboardData[],
    chatHistory: ChatMessage[],
    playgrounds: PlaygroundCode[]
) => {
    // Save API key
    useEffect(() => {
        if (apiKey) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
    }, [apiKey]);

    // Save syllabus gallery
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SYLLABUS_GALLERY, JSON.stringify(syllabusGallery));
    }, [syllabusGallery]);

    // Save test results
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TEST_RESULTS, JSON.stringify(testResults));
    }, [testResults]);

    // Save settings
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

    // Save session if enabled
    useEffect(() => {
        if (saveToLocal) {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ whiteboards, chatHistory, playgrounds }));
        } else {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
    }, [saveToLocal, whiteboards, chatHistory, playgrounds]);

    // Load session on mount
    useEffect(() => {
        if (saveToLocal) {
            try {
                const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
                if (savedSession) {
                    const parsed = JSON.parse(savedSession);
                    // Note: Caller should handle loading whiteboards, chatHistory, playgrounds
                    return parsed;
                }
            } catch (e) { console.error("Failed to load session", e); }
        }
    }, [saveToLocal]);
};

export const loadSessionFromStorage = (): { whiteboards: WhiteboardData[], chatHistory: ChatMessage[], playgrounds: PlaygroundCode[] } | null => {
    try {
        const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (savedSession) {
            return JSON.parse(savedSession);
        }
    } catch (e) { console.error("Failed to load session", e); }
    return null;
};
