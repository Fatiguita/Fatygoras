import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Play, Pause, SkipForward, SkipBack,
    LayoutGrid, MousePointer2, PenTool, Hand,
    ZoomIn, ZoomOut, RotateCcw, X,
    Maximize, Minimize, Zap, Lightbulb, Settings,
    Volume2, FileVideo, FileText, Type
} from 'lucide-react';
import { SlideData, PlayerSettings, PlayState, WhiteboardData } from '../../types';
import { usePresentationTTS } from '../../hooks/usePresentationTTS';
import { SlideGrid } from './SlideGrid';
import { AnnotationLayer, AnnotationLayerRef } from './AnnotationLayer';
import { convertWhiteboardsToSlides, generateId } from '../../utils/presentationUtils';
import { cancelAudio } from '../../services/audioService';

const DEFAULT_SETTINGS: PlayerSettings = {
    voiceURI: null,
    rate: 1,
    pitch: 1,
    themeColor: '#4f46e5',
    highlightColor: '#f59e0b',
    autoPlay: true,
    pacing: 500,
    staticSlideDuration: 10000,
    minSlideDuration: 50000,
    autoPan: true,
    maxAutoZoom: 2.5
};

type ToolMode = 'cursor' | 'hand' | 'pen' | 'text' | 'laser' | 'spotlight';

interface PresenterModeProps {
    initialWhiteboards: WhiteboardData[];
}

export const PresenterMode: React.FC<PresenterModeProps> = ({ initialWhiteboards }) => {
    // --- STATE ---
    const [slides, setSlides] = useState<SlideData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playState, setPlayState] = useState<PlayState>('idle');
    const [viewMode, setViewMode] = useState<'present' | 'grid'>('grid');
    const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);

    // UI State
    const [activeTool, setActiveTool] = useState<ToolMode>('cursor');
    const [showSettings, setShowSettings] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [playbackOrder, setPlaybackOrder] = useState<'first' | 'last'>('last');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<number | null>(null);
    const annotationRef = useRef<AnnotationLayerRef>(null);

    // Transform State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Touch Pinch Zoom State
    const [touchStartDist, setTouchStartDist] = useState<number>(0);
    const [touchStartZoom, setTouchStartZoom] = useState<number>(1);

    // Transition State
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Refs for Auto-Pan Logic
    const lastActiveId = useRef<string | null>(null);
    const zoomRef = useRef(zoom);
    
    // Sync ref with state for async access
    useEffect(() => { zoomRef.current = zoom; }, [zoom]);

    // Constants
    const MIN_ZOOM = 0.6; 
    const MAX_ZOOM = 5;

    // --- LOGIC ---
    const resetTransform = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    const saveAnnotation = useCallback(() => {
        if (annotationRef.current && currentIndex >= 0 && currentIndex < slides.length) {
            const data = annotationRef.current.getCanvasData();
            if (data) {
                setSlides(prev => prev.map((s, i) => i === currentIndex ? { ...s, annotationData: data } : s));
            }
        }
    }, [currentIndex, slides.length]);

    const changeSlide = useCallback((newIndex: number) => {
        if (newIndex < 0 || newIndex >= slides.length) return;
        
        saveAnnotation();

        // Start Transition
        setIsTransitioning(true);

        setTimeout(() => {
            setCurrentIndex(newIndex);
            resetTransform();
            setIsTransitioning(false);
            setPlayState(settings.autoPlay ? 'playing' : 'paused');
        }, 300);
    }, [currentIndex, slides.length, settings.autoPlay, saveAnnotation]);

    const handleNext = useCallback(() => {
        if (playbackOrder === 'first') {
            if (currentIndex < slides.length - 1) {
                changeSlide(currentIndex + 1);
            } else {
                setPlayState('idle');
                changeSlide(0);
            }
        } else {
            if (currentIndex > 0) {
                changeSlide(currentIndex - 1);
            } else {
                setPlayState('idle');
                changeSlide(slides.length - 1);
            }
        }
    }, [currentIndex, slides.length, changeSlide, playbackOrder]);

    const { voices, activeId } = usePresentationTTS(
        slides[currentIndex]?.narrativeSegments || [],
        playState === 'playing' && viewMode === 'present',
        handleNext,
        settings
    );

    // --- CINEMATIC AUTO PAN LOGIC ---
    useEffect(() => {
        if (!settings.autoPan || viewMode !== 'present' || isTransitioning || isDragging) return;

        // Reset if no active ID or static slide
        if (!activeId || activeId === 'root-svg') {
            if (zoom !== 1 || pan.x !== 0 || pan.y !== 0) {
                resetTransform();
            }
            lastActiveId.current = activeId;
            return;
        }

        // Prevent re-triggering for the same ID (e.g., when opening settings)
        if (activeId === lastActiveId.current) return;
        lastActiveId.current = activeId;

        // 1. Cinematic Step 1: Pan Out to Full View
        setZoom(1);
        setPan({ x: 0, y: 0 });

        // 2. Cinematic Step 2: Pan In to Target (Delayed)
        // Wait 1000ms (1s) which matches our transition duration, creating a smooth "Out... then In" arc.
        const timeoutId = setTimeout(() => {
            const el = document.getElementById(activeId);
            const container = document.getElementById('slide-container');

            if (el && container) {
                const elRect = el.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                // Safety check for zero dimensions
                if (elRect.width === 0 || elRect.height === 0) return;

                // --- Calculate Zoom ---
                // "Fit-to-Box" Strategy: Define safe area (50% of screen dimensions)
                const paddingFactor = 0.5;
                const targetW = containerRect.width * paddingFactor;
                const targetH = containerRect.height * paddingFactor;

                // Calculate ratios relative to current displayed size (zoom 1.0)
                const scaleX = targetW / elRect.width;
                const scaleY = targetH / elRect.height;

                // Pick the smaller scale factor to ensure it fits completely (contain)
                const desiredScaleFactor = Math.min(scaleX, scaleY);
                const clampedZoom = Math.max(1, Math.min(settings.maxAutoZoom, desiredScaleFactor));

                // --- Calculate Pan ---
                const containerCenterX = containerRect.left + containerRect.width / 2;
                const containerCenterY = containerRect.top + containerRect.height / 2;
                
                // Vertical Centering: Center the element vertically
                const elCenterY = elRect.top + elRect.height / 2;
                // Important: Scale the offset by the zoom factor to maintain centering
                const diffY = (containerCenterY - elCenterY) * clampedZoom;

                // Horizontal Left Align: Align element left edge to dynamic padding from container left
                // Range: 10px (at 1x) to 40px (at 4x or higher)
                const padding = Math.min(40, 10 * clampedZoom);
                const targetX = containerRect.left + padding;
                
                // Calculate offsets from center (0,0 in transform space)
                const targetOffsetX = targetX - containerCenterX;
                const currentOffsetX = elRect.left - containerCenterX;
                
                // Apply formula: Target = Center + (CurrentOffset * Zoom) + Pan
                // Pan = TargetOffset - (CurrentOffset * Zoom)
                const diffX = targetOffsetX - (currentOffsetX * clampedZoom);

                setPan({ x: diffX, y: diffY });
                setZoom(clampedZoom);
            }
        }, 1000); 

        return () => clearTimeout(timeoutId);

    }, [activeId, settings.autoPan, viewMode, isTransitioning, isDragging, settings.maxAutoZoom]);

    // --- INITIALIZATION & EFFECTS ---
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
            setPlayState('idle');
        }
    }, [initialWhiteboards]);

    useEffect(() => {
        document.documentElement.style.setProperty('--highlight-color', settings.highlightColor);
    }, [settings.highlightColor]);

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const currentSlide = slides[currentIndex];

    const currentCaption = useMemo(() => {
        if (!activeId) return "";
        const segment = currentSlide?.narrativeSegments.find(s => s.id === activeId);
        return segment ? segment.text : "";
    }, [activeId, currentSlide]);

    const currentSegmentIndex = useMemo(() => {
        if (!activeId || !currentSlide) return 0;
        return currentSlide.narrativeSegments.findIndex(s => s.id === activeId);
    }, [activeId, currentSlide]);

    const totalSegments = currentSlide?.narrativeSegments.length || 1;
    const progressPercent = ((currentSegmentIndex + 1) / totalSegments) * 100;

    useEffect(() => {
        const highlights = document.querySelectorAll('.svg-highlight-active');
        highlights.forEach(el => el.classList.remove('svg-highlight-active'));
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el) el.classList.add('svg-highlight-active');
        }
    }, [activeId]);

    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => {
            if (playState === 'playing' && !showSettings && !mobileMenuOpen) {
                setControlsVisible(false);
            }
        }, 3000);
    }, [playState, showSettings, mobileMenuOpen]);

    useEffect(() => {
        if (playState !== 'playing') {
            setControlsVisible(true);
        } else {
            showControls();
        }
    }, [playState, showControls]);

    // --- HANDLERS ---
    const enterPresentation = (index: number) => {
        if (slides.length === 0) return;
        const clamped = Math.max(0, Math.min(index, slides.length - 1));
        const startIndex = playbackOrder === 'first' ? clamped : (slides.length - 1 - clamped);
        setCurrentIndex(startIndex);
        setViewMode('present');
        resetTransform();
        setPlayState(settings.autoPlay ? 'playing' : 'paused');
    };

    const exitPresentation = () => {
        setPlayState('idle');
        saveAnnotation();
        setViewMode('grid');
        cancelAudio();
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.warn(err));
        }
    };

    const togglePlay = () => {
        setPlayState(prev => {
            if (prev === 'playing') {
                cancelAudio();
                return 'paused';
            }
            return 'playing';
        });
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    };

    const handlePrev = useCallback(() => {
        if (playbackOrder === 'first') {
            if (currentIndex > 0) changeSlide(currentIndex - 1);
        } else {
            if (currentIndex < slides.length - 1) changeSlide(currentIndex + 1);
        }
    }, [currentIndex, slides.length, changeSlide, playbackOrder]);

    const handleDelete = (index: number) => {
        const originalIndex = playbackOrder === 'first' ? index : (slides.length - 1 - index);
        const newSlides = slides.filter((_, i) => i !== originalIndex);
        setSlides(newSlides);
        if (newSlides.length === 0) {
            setViewMode('grid');
            setPlayState('idle');
        } else if (originalIndex === currentIndex) {
            changeSlide(Math.max(0, originalIndex - 1));
        } else if (originalIndex < currentIndex) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const adjustZoom = (delta: number) => { 
        if (settings.autoPan) setSettings(prev => ({ ...prev, autoPan: false })); // Fix: Disable auto-pan
        setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta))); 
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaY) < 5) return;
        
        // Fix 2: Disable Auto-Pan on manual wheel
        if (settings.autoPan) {
            setSettings(prev => ({ ...prev, autoPan: false }));
        }

        const sensitivity = 0.001;
        const delta = -e.deltaY * sensitivity * (zoom * 1.5);
        setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
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
            enterPresentation(0);
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

    const handleMouseDown = (e: React.MouseEvent) => {
        showControls();
        
        // Fix 2: Disable Auto-Pan on manual interaction
        if (settings.autoPan && activeTool === 'hand') {
            setSettings(prev => ({ ...prev, autoPan: false }));
        }

        if (activeTool === 'hand') {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        showControls();
        if (activeTool === 'laser' || activeTool === 'spotlight') {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        if (!isDragging || activeTool !== 'hand') return;
        e.preventDefault();
        setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- TOUCH HANDLERS ---
    const handleTouchStart = (e: React.TouchEvent) => {
        showControls();
        
        // Fix 2: Disable Auto-Pan on touch
        if (settings.autoPan) {
            setSettings(prev => ({ ...prev, autoPan: false }));
        }

        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setTouchStartDist(dist);
            setTouchStartZoom(zoom);
            setIsDragging(false); 
            return;
        }
        if (e.touches.length === 1) {
            if (activeTool === 'hand') {
                setIsDragging(true);
                dragStart.current = { 
                    x: e.touches[0].clientX - pan.x, 
                    y: e.touches[0].clientY - pan.y 
                };
            }
            if (activeTool === 'laser' || activeTool === 'spotlight') {
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ 
                    x: e.touches[0].clientX - rect.left, 
                    y: e.touches[0].clientY - rect.top 
                });
            }
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        showControls();
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (touchStartDist > 0) {
                const scale = dist / touchStartDist;
                const newZoom = Math.min(Math.max(MIN_ZOOM, touchStartZoom * scale), MAX_ZOOM);
                setZoom(newZoom);
            }
            return;
        }
        if (e.touches.length === 1) {
            if (activeTool === 'laser' || activeTool === 'spotlight') {
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ 
                    x: e.touches[0].clientX - rect.left, 
                    y: e.touches[0].clientY - rect.top 
                });
            }
            if (activeTool === 'hand' && isDragging) {
                if(e.cancelable) e.preventDefault(); 
                setPan({ 
                    x: e.touches[0].clientX - dragStart.current.x, 
                    y: e.touches[0].clientY - dragStart.current.y 
                });
            }
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setTouchStartDist(0);
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

    return (
        <div className={`flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100]' : 'relative h-full'}`}>

            {viewMode === 'grid' ? (
                <div className="flex flex-col h-full">
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
                                onClick={() => enterPresentation(currentIndex)}
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
                            onSelect={enterPresentation} 
                            onDelete={handleDelete}
                            onReorder={setSlides}
                            onAddTitleCard={handleAddTitleCard}
                        />
                    </div>
                </div>
            ) : (
                <div
                    className="relative w-full h-full bg-black flex flex-col overflow-hidden group/player select-none touch-none"
                    onMouseMove={showControls}
                    onTouchStart={showControls}
                >
                    <div className={`absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 flex items-start justify-between ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <div className="flex items-center gap-3">
                            <button onClick={exitPresentation} className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors" aria-label="Exit Presentation to Grid View">
                                <LayoutGrid size={18} className="text-white" />
                            </button>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white leading-tight drop-shadow-md">{currentSlide?.name}</span>
                                <span className="text-xs text-white/60">Slide {currentIndex + 1} of {slides.length}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                aria-label="Open Settings"
                            >
                                <Settings size={18} />
                            </button>
                        </div>
                    </div>

                    <div
                        id="slide-container"
                        className={`w-full h-full flex items-center justify-center overflow-hidden relative p-4 ${activeTool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onWheel={handleWheel}
                    >
                        {/* 
                           Separated Containers for Stability:
                           1. Outer: Handles Slide Transition (Opacity Fade) - Cleanest way to transition
                           2. Inner: Handles Pan/Zoom Transform - Separated to avoid 'transition-all' conflict
                        */}
                        <div className={`w-full h-full flex items-center justify-center transition-opacity duration-500 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                            <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    // CRITICAL FIX: Only apply transition if NOT dragging. This prevents the "floaty/crazy" lag.
                                    // Use 'ease-in-out' with 1s duration to simulate "panning out then panning in" (slow-fast-slow)
                                    transition: isDragging ? 'none' : 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                    willChange: 'transform'
                                }}
                            >
                                <div className="relative shadow-2xl w-full h-full max-w-[1920px] max-h-[1080px] flex items-center justify-center bg-white aspect-video origin-center">
                                    <div className="w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: currentSlide?.svgContent || '' }} />

                                    <div className="absolute inset-0 z-10 pointer-events-none">
                                        <div className={activeTool === 'pen' || activeTool === 'text' ? 'pointer-events-auto w-full h-full' : 'hidden'}>
                                            <AnnotationLayer 
                                                ref={annotationRef}
                                                active={activeTool === 'pen' || activeTool === 'text'} 
                                                color={settings.highlightColor}
                                                initialImage={currentSlide?.annotationData}
                                                tool={activeTool === 'text' ? 'text' : 'pen'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {activeTool === 'laser' && (
                            <div className="absolute pointer-events-none z-50 w-4 h-4 rounded-full mix-blend-screen"
                                style={{ left: mousePos.x - 8, top: mousePos.y - 8, backgroundColor: settings.highlightColor, boxShadow: `0 0 15px 4px ${settings.highlightColor}` }} />
                        )}
                        {activeTool === 'spotlight' && (
                            <div className="absolute inset-0 pointer-events-none z-50"
                                style={{ background: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, rgba(0,0,0,0.9) 150px)` }} />
                        )}
                    </div>

                    {currentCaption && (
                        <div className={`absolute bottom-24 left-0 right-0 z-20 flex justify-center px-6 transition-all duration-300 ${controlsVisible ? 'translate-y-0' : 'translate-y-8'}`}>
                            <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/5 shadow-lg max-w-3xl text-center">
                                <p className="text-white/90 text-lg md:text-xl font-medium leading-relaxed drop-shadow-md">
                                    {currentCaption}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className={`
                        absolute z-40 transition-all duration-300 flex flex-col
                        ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                        md:right-4 md:top-1/2 md:-translate-y-1/2 md:flex-col md:translate-x-0 md:bottom-auto md:left-auto md:items-center
                        bottom-32 left-4 translate-x-0 items-start
                    `}>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className={`md:hidden mb-2 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border border-white/10 backdrop-blur-md transition-all ${mobileMenuOpen ? 'bg-white text-black' : 'bg-black/60 text-white'}`}
                        >
                            <MousePointer2 size={16} />
                            <span className="text-xs font-bold">{mobileMenuOpen ? 'Close Tools' : 'Tools'}</span>
                        </button>

                        <div className={`
                            flex gap-2 bg-black/80 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl
                            md:flex-col flex-row
                            ${mobileMenuOpen ? 'flex' : 'hidden md:flex'}
                        `}>
                            <ToolButton icon={MousePointer2} active={activeTool === 'cursor'} onClick={() => setActiveTool('cursor')} label="Pointer" />
                            <ToolButton icon={Hand} active={activeTool === 'hand'} onClick={() => setActiveTool('hand')} label="Pan" />
                            <ToolButton icon={PenTool} active={activeTool === 'pen'} onClick={() => setActiveTool('pen')} label="Pen" />
                            <ToolButton icon={Type} active={activeTool === 'text'} onClick={() => setActiveTool('text')} label="Text" />
                            <ToolButton icon={Zap} active={activeTool === 'laser'} onClick={() => setActiveTool('laser')} label="Laser" />
                            <ToolButton icon={Lightbulb} active={activeTool === 'spotlight'} onClick={() => setActiveTool('spotlight')} label="Spotlight" />
                            
                            <div className="md:w-full md:h-px w-px h-auto bg-white/10 my-0 md:my-1 mx-1 md:mx-0"></div>
                            
                            <ToolButton icon={ZoomIn} active={false} onClick={() => adjustZoom(0.25)} label="Zoom In" />
                            <ToolButton icon={ZoomOut} active={false} onClick={() => adjustZoom(-0.25)} label="Zoom Out" />
                            <ToolButton icon={RotateCcw} active={false} onClick={resetTransform} label="Reset View" />
                        </div>
                    </div>

                    <div className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-12 pb-6 px-4 md:px-8 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

                        <div className="relative h-1.5 bg-white/20 rounded-full mb-4 w-full cursor-pointer overflow-hidden group/progress">
                            <div className="absolute left-0 top-0 bottom-0 bg-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                            <div className="absolute left-0 top-0 bottom-0 bg-white/5 w-full">
                                {slides.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className="absolute top-0 bottom-0 w-0.5 bg-black/50"
                                        style={{ left: `${(idx / slides.length) * 100}%` }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={togglePlay}
                                    className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                                    aria-label={playState === 'playing' ? 'Pause Presentation' : 'Play Presentation'}
                                >
                                    {playState === 'playing' ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                </button>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handlePrev}
                                        disabled={playbackOrder === 'first' ? currentIndex === 0 : currentIndex === slides.length - 1}
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-30"
                                        aria-label="Previous Slide"
                                    >
                                        <SkipBack size={20} />
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={playbackOrder === 'first' ? currentIndex === slides.length - 1 : currentIndex === 0}
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-30"
                                        aria-label="Next Slide"
                                    >
                                        <SkipForward size={20} />
                                    </button>
                                </div>

                                <span className="text-xs md:text-sm font-medium text-white/80 font-mono ml-2">
                                    {currentIndex + 1} <span className="text-white/40">/</span> {slides.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="hidden md:flex items-center gap-2 text-white/60 text-xs">
                                    <Volume2 size={14} />
                                    <span aria-label={`Audio mode: ${settings.voiceURI ? 'AI Voice' : 'Auto'}`}>{settings.voiceURI ? 'AI Voice' : 'Auto'}</span>
                                </div>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
                                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                                >
                                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {showSettings && (
                        <div className="absolute top-16 right-4 z-40 w-80 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 animate-fade-in text-left">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                                <h3 className="font-bold text-white text-sm">Player Settings</h3>
                                <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white" aria-label="Close Settings"><X size={16} /></button>
                            </div>

                            <div className="space-y-4">
                                {/* NEW: Auto Pan Toggle */}
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                    <label className="text-sm text-white/80">Auto-Pan Camera</label>
                                    <input 
                                        type="checkbox" 
                                        checked={settings.autoPan} 
                                        onChange={e => setSettings({...settings, autoPan: e.target.checked})} 
                                        className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                                    />
                                </div>

                                {/* NEW: Max Auto-Zoom Slider */}
                                <div>
                                    <label htmlFor="max-zoom" className="flex justify-between text-xs text-white/50 mb-1">
                                        <span>Max Zoom Focus</span>
                                        <span>{settings.maxAutoZoom}x</span>
                                    </label>
                                    <input 
                                        id="max-zoom" 
                                        type="range" 
                                        min="1.0" 
                                        max="5.0" 
                                        step="0.1" 
                                        value={settings.maxAutoZoom} 
                                        onChange={(e) => setSettings({ ...settings, maxAutoZoom: parseFloat(e.target.value) })} 
                                        className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>

                                <div>
                                    <label htmlFor="narrator-voice" className="text-xs text-white/50 block mb-1">Narrator Voice</label>
                                    <select
                                        id="narrator-voice"
                                        className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 [&>option]:bg-slate-900"
                                        value={settings.voiceURI || ''}
                                        onChange={(e) => setSettings({ ...settings, voiceURI: e.target.value })}
                                        aria-label="Select Narrator Voice"
                                    >
                                        <option value="">Default Device Voice</option>
                                        {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.slice(0, 30)} ({v.lang})</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="playback-order" className="text-xs text-white/50 block mb-1">Playback Order</label>
                                    <select
                                        id="playback-order"
                                        className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        value={playbackOrder}
                                        onChange={(e) => setPlaybackOrder(e.target.value as 'first' | 'last')}
                                        aria-label="Playback Order"
                                    >
                                        <option value="first">First → Last</option>
                                        <option value="last">Last → First</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="narrator-speed" className="text-xs text-white/50 block mb-1">Speed ({settings.rate}x)</label>
                                        <input id="narrator-speed" type="range" min="0.5" max="2" step="0.1" value={settings.rate} onChange={(e) => setSettings({ ...settings, rate: parseFloat(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`${settings.rate} times speed`} />
                                    </div>
                                    <div>
                                        <label htmlFor="narrator-pitch" className="text-xs text-white/50 block mb-1">Pitch ({settings.pitch})</label>
                                        <input id="narrator-pitch" type="range" min="0.5" max="2" step="0.1" value={settings.pitch} onChange={(e) => setSettings({ ...settings, pitch: parseFloat(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`pitch ${settings.pitch}`} />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="min-slide-time" className="flex justify-between text-xs text-white/50 mb-1"><span>Min Slide Time</span><span>{settings.minSlideDuration / 1000}s</span></label>
                                    <input id="min-slide-time" type="range" min="1000" max="200000" step="1000" value={settings.minSlideDuration} onChange={(e) => setSettings({ ...settings, minSlideDuration: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`${settings.minSlideDuration} ms`} />
                                </div>
                                <div>
                                    <label htmlFor="static-slide-time" className="flex justify-between text-xs text-white/50 mb-1"><span>Static Slide Time</span><span>{settings.staticSlideDuration / 1000}s</span></label>
                                    <input id="static-slide-time" type="range" min="5000" max="60000" step="5000" value={settings.staticSlideDuration} onChange={(e) => setSettings({ ...settings, staticSlideDuration: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                                </div>

                                <div>
                                    <label htmlFor="highlight-color-picker" className="text-xs text-white/50 block mb-1">Highlight Color</label>
                                    <div id="highlight-color-picker" className="flex gap-2">
                                        {['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'].map(c => (
                                            <button key={c} onClick={() => setSettings({ ...settings, highlightColor: c })} className={`w-6 h-6 rounded-full border-2 ${settings.highlightColor === c ? 'border-white' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} aria-label={`Set highlight color to ${c}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const ToolButton: React.FC<{ icon: React.ElementType, active: boolean, onClick: () => void, label: string }> = ({ icon: Icon, active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`p-2 md:p-2.5 rounded-xl transition-all group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
        aria-label={label}
    >
        <Icon size={20} />
        <span className="hidden md:block absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-medium">
            {label}
        </span>
    </button>
);
