import { useState, useRef } from 'react';
import { AppTheme, GeminiModel, WhiteboardData, ChatMessage, PlaygroundCode, ApiLogEntry, SyllabusData, TestResult } from '../types';
import { DEFAULT_THEME, DEFAULT_MODEL, STORAGE_KEYS } from '../constants';
import { Tab } from '../appConstants';

const getInitialSettings = () => {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return s ? JSON.parse(s) : {};
    } catch (e) { return {}; }
};

export const useAppState = () => {
    const settings = getInitialSettings();

    // --- SETTINGS STATE ---
    const [theme, setTheme] = useState<AppTheme>(() => settings.theme || DEFAULT_THEME);
    const [model, setModel] = useState<GeminiModel>(() => settings.model || DEFAULT_MODEL);
    const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.API_KEY) || '');
    const [saveToLocal, setSaveToLocal] = useState(() => settings.saveToLocal || false);

    // --- AUTO SAVE STATE ---
    const [autoSaveName, setAutoSaveName] = useState(() => settings.autoSaveName || 'MySession');
    const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => settings.autoSaveInterval || 5);
    const [autoSaveHandle, setAutoSaveHandle] = useState<any>(null);
    const [pendingResumeHandle, setPendingResumeHandle] = useState<any>(null);
    const autoSaveTimerRef = useRef<number | null>(null);

    // --- DOCUMENT CONTEXT STATE ---
    // Option: Store this locally. 
    // Alternative: Kept inside component state in sync with IndexedDB storage handlers for reliable scaling.
    const [activeDocText, setActiveDocText] = useState<string>('');
    const [activeDocName, setActiveDocName] = useState<string>('');

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<Tab>(Tab.CLASSROOM);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // --- CONTENT STATE ---
    const [input, setInput] = useState('');
    const [whiteboards, setWhiteboards] = useState<WhiteboardData[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    // --- CHAT STATE ---
    const [isChatOpen, setIsChatOpen] = useState(false);

    // --- PLAYGROUND STATE ---
    const [playgrounds, setPlaygrounds] = useState<PlaygroundCode[]>([]);
    const [activePlaygroundId, setActivePlaygroundId] = useState<string | null>(null);
    const [playgroundPanelOpen, setPlaygroundPanelOpen] = useState(false);
    const [playgroundWidth, setPlaygroundWidth] = useState(500);
    const [activePlaygroundTab, setActivePlaygroundTab] = useState<'practice' | 'test'>('practice');

    // --- LEVEL TEST STATE ---
    const [testResults, setTestResults] = useState<TestResult[]>(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEYS.TEST_RESULTS);
            return s ? JSON.parse(s) : [];
        } catch (e) { return []; }
    });
    const [isGeneratingTest, setIsGeneratingTest] = useState(false);

    // --- REMEDIATION STATE ---
    const [remediationQueue, setRemediationQueue] = useState<string[]>([]);
    const [showRemediationToast, setShowRemediationToast] = useState(false);

    // --- SYLLABUS STATE ---
    const [syllabus, setSyllabus] = useState<SyllabusData | null>(null);
    const [syllabusGallery, setSyllabusGallery] = useState<SyllabusData[]>(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEYS.SYLLABUS_GALLERY);
            return s ? JSON.parse(s) : [];
        } catch (e) { return {}; }
    });

    // --- LOADING STATE ---
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // --- ADVANCED MODE STATE ---
    const [isAdvancedModeOpen, setIsAdvancedModeOpen] = useState(false);
    const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
    const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);

    return {
        // Settings
        theme, setTheme, model, setModel, apiKey, setApiKey, saveToLocal, setSaveToLocal,
        // Auto Save
        autoSaveName, setAutoSaveName, autoSaveInterval, setAutoSaveInterval,
        autoSaveHandle, setAutoSaveHandle, pendingResumeHandle, setPendingResumeHandle,
        autoSaveTimerRef,
        // Document context
        activeDocText, setActiveDocText, activeDocName, setActiveDocName,
        // UI
        activeTab, setActiveTab, isNavVisible, setIsNavVisible, isFullscreen, setIsFullscreen,
        // Content
        input, setInput, whiteboards, setWhiteboards, chatHistory, setChatHistory,
        // Chat
        isChatOpen, setIsChatOpen,
        // Playground
        playgrounds, setPlaygrounds, activePlaygroundId, setActivePlaygroundId,
        playgroundPanelOpen, setPlaygroundPanelOpen, playgroundWidth, setPlaygroundWidth,
        activePlaygroundTab, setActivePlaygroundTab,
        // Level Test
        testResults, setTestResults, isGeneratingTest, setIsGeneratingTest,
        // Remediation
        remediationQueue, setRemediationQueue, showRemediationToast, setShowRemediationToast,
        // Syllabus
        syllabus, setSyllabus, syllabusGallery, setSyllabusGallery,
        // Loading
        isGenerating, setIsGenerating, isGeneratingSyllabus, setIsGeneratingSyllabus,
        isRefining, setIsRefining, isResizing, setIsResizing,
        // Advanced Mode
        isAdvancedModeOpen, setIsAdvancedModeOpen, apiLogs, setApiLogs, isSessionManagerOpen, setIsSessionManagerOpen
    };
};