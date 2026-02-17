import React, { useState, useEffect } from 'react';
import {
    Play, LayoutGrid, RotateCcw,
    FileVideo, FileText
} from 'lucide-react';
import { SlideData, WhiteboardData, PlayerSettings } from '../../types';
import { DEFAULT_PLAYER_SETTINGS } from '../../constants';
import { SlideGrid } from './SlideGrid';
import { PresentationSession } from './PresentationSession';
import { PresentationSetupModal } from './PresentationSetupModal';
import { convertWhiteboardsToSlides, generateId } from '../../utils/presentationUtils';

interface PresenterModeProps {
    initialWhiteboards: WhiteboardData[];
}

export const PresenterMode: React.FC<PresenterModeProps> = ({ initialWhiteboards }) => {
    // --- STATE ---
    const [slides, setSlides] = useState<SlideData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'present' | 'grid'>('grid');
    const [playbackOrder, setPlaybackOrder] = useState<'first' | 'last'>('last');
    
    // Setup Modal State
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [pendingStartIndex, setPendingStartIndex] = useState(0);
    const [sessionSettings, setSessionSettings] = useState<PlayerSettings>(DEFAULT_PLAYER_SETTINGS);

    // --- INITIALIZATION ---
    useEffect(() => {
        if (slides.length === 0 && initialWhiteboards.length > 0) {
            const converted = convertWhiteboardsToSlides(initialWhiteboards);
            setSlides(converted);
            if (viewMode === 'present' && currentIndex >= converted.length) {
                setCurrentIndex(0);
            }
        } else if (initialWhiteboards.length === 0) {
            setSlides([]);
            setCurrentIndex(0);
            setViewMode('grid');
        }
    }, [initialWhiteboards]);

    // --- HANDLERS ---
    
    // Trigger the setup flow instead of immediate start
    const initiatePresentation = (index: number) => {
        if (slides.length === 0) return;
        setPendingStartIndex(index);
        setShowSetupModal(true);
    };

    const startSession = (configuredSettings: PlayerSettings) => {
        setShowSetupModal(false);
        setSessionSettings(configuredSettings);
        
        const clamped = Math.max(0, Math.min(pendingStartIndex, slides.length - 1));
        const startIndex = playbackOrder === 'first' ? clamped : (slides.length - 1 - clamped);
        
        setCurrentIndex(startIndex);
        setViewMode('present');
    };

    const handleExitPresentation = (updatedSlides: SlideData[]) => {
        // Update slides with any annotations made during presentation
        setSlides(updatedSlides);
        setViewMode('grid');
    };

    const handleDelete = (index: number) => {
        const originalIndex = playbackOrder === 'first' ? index : (slides.length - 1 - index);
        const newSlides = slides.filter((_, i) => i !== originalIndex);
        setSlides(newSlides);
        if (newSlides.length === 0) {
            setViewMode('grid');
        }
    };

    const handleAddTitleCard = () => {
        const title = prompt("Enter Title for new card:");
        if (!title) return;
        
        const newSlide: SlideData = {
            id: generateId(),
            type: 'title',
            name: title,
            svgContent: `
                <svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" style="background:#1e1b4b; width:100%; height:100%;">
                    <rect width="100%" height="100%" fill="#1e1b4b"/>
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="120" fill="white">
                        ${title}
                    </text>
                </svg>
            `,
            narrativeSegments: [{ id: 'title-seg', text: title }],
            fullNarrative: title
        };
        
        setSlides(prev => [...prev, newSlide]);
    };

    const handleExportVideo = async () => {
        alert("To export video: \n1. Select 'Fatygoras Tab' (This Tab).\n2. Make sure 'Share System Audio' is checked.\n3. The presentation will play automatically.");
        try {
            const constraints: any = {
                video: { displaySurface: 'browser' },
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
                selfBrowserSurface: 'include',
                preferCurrentTab: true,
                systemAudio: 'include'
            };

            const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            const chunks: Blob[] = [];
            
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `presentation_${Date.now()}.webm`;
                a.click();
            };
            
            recorder.start();
            initiatePresentation(0); // This will still open setup modal for video export config
        } catch (e) {
            console.error("Screen capture failed", e);
            alert("Could not start recording. Ensure your browser supports screen sharing.");
        }
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        if(!printWindow) return;
        
        const content = slides.map(s => `
            <div style="page-break-after: always; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
                <div style="max-height: 80vh;">${s.svgContent}</div>
                <p style="font-family: sans-serif; padding: 20px; font-size: 18px;">${s.fullNarrative}</p>
            </div>
        `).join('');
        
        printWindow.document.write(`<html><head><title>Presentation Export</title></head><body style="margin: 0; padding: 0;">${content}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 1000);
    };

    // --- RENDER ---
    if (slides.length === 0 && viewMode === 'grid') {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                <RotateCcw size={48} className="mb-4 opacity-50" />
                <p className="text-lg">No content ready.</p>
                <p className="text-sm mt-2">Generate a lesson in Classroom or add a Title Card.</p>
                <button onClick={handleAddTitleCard} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition">Add Title Card</button>
            </div>
        );
    }

    if (viewMode === 'present') {
        return (
            <PresentationSession
                slides={slides}
                initialIndex={currentIndex}
                playbackOrder={playbackOrder}
                setPlaybackOrder={setPlaybackOrder}
                onExit={handleExitPresentation}
                initialSettings={sessionSettings}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap sm:flex-nowrap items-center justify-between px-4 py-2 gap-2 shrink-0">
                <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0">
                    <LayoutGrid size={20} className="text-indigo-500" /> 
                    <span className="hidden sm:inline">Presentation Index</span>
                </h2>
                <div className="flex items-center gap-2 ml-auto shrink-0 overflow-x-auto no-scrollbar">
                    <button onClick={handleExportVideo} className="hidden md:block p-2 text-slate-500 hover:text-indigo-500" title="Record Video"><FileVideo size={20}/></button>
                    <button onClick={handleExportPDF} className="hidden md:block p-2 text-slate-500 hover:text-indigo-500" title="Print to PDF"><FileText size={20}/></button>
                    <select value={playbackOrder} onChange={(e) => setPlaybackOrder(e.target.value as 'first' | 'last')}
                        className="bg-slate-100 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 p-2 rounded border border-slate-200 dark:border-slate-700 outline-none">
                        <option value="last">Last → First</option>
                        <option value="first">First → Last</option>
                    </select>
                    <button
                        onClick={() => initiatePresentation(currentIndex)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap shadow-sm"
                        aria-label="Start Presentation"
                    >
                        <Play size={16} fill="currentColor" /> 
                        <span className="hidden xs:inline">Start Show</span>
                        <span className="xs:hidden">Play</span>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <SlideGrid 
                    slides={playbackOrder === 'first' ? slides : [...slides].reverse()} 
                    onSelect={initiatePresentation} 
                    onDelete={handleDelete}
                    onReorder={setSlides}
                    onAddTitleCard={handleAddTitleCard}
                />
            </div>

            <PresentationSetupModal 
                isOpen={showSetupModal}
                onClose={() => setShowSetupModal(false)}
                onStart={startSession}
                initialSettings={sessionSettings}
            />
        </div>
    );
}
