import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Play, Pause, SkipForward, SkipBack,
    LayoutGrid, MousePointer2, PenTool, Hand,
    ZoomIn, ZoomOut, RotateCcw, X,
    Maximize, Minimize, Zap, Lightbulb, Settings,
    Volume2
} from 'lucide-react';
import { SlideData, PlayerSettings, PlayState, WhiteboardData } from '../../types';
import { usePresentationTTS } from '../../hooks/usePresentationTTS';
import { SlideGrid } from './SlideGrid';
import { AnnotationLayer } from './AnnotationLayer';
import { convertWhiteboardsToSlides } from '../../utils/presentationUtils';
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
    minSlideDuration: 50000
};

type ToolMode = 'cursor' | 'hand' | 'pen' | 'laser' | 'spotlight';

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
    const [playbackOrder, setPlaybackOrder] = useState<'first' | 'last'>('last');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<number | null>(null);

    // Transform State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [fade, setFade] = useState(false);

    // --- LOGIC ---
    const resetTransform = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    // CRITICAL FIX: Wrap changeSlide in useCallback to stabilize its identity.
    // This prevents the usePresentationTTS hook from resetting on every render.
    const changeSlide = useCallback((newIndex: number) => {
        if (newIndex < 0 || newIndex >= slides.length) return;
        setFade(true);
        setTimeout(() => {
            setCurrentIndex(newIndex);
            resetTransform();
            setFade(false);
            setPlayState(settings.autoPlay ? 'playing' : 'paused');
        }, 200);
    }, [slides.length, settings.autoPlay]);

    // CRITICAL FIX: Wrap handleNext in useCallback. Since it depends on changeSlide,
    // it also needs to be memoized to remain stable for the TTS hook.
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

    // --- INITIALIZATION & EFFECTS ---
    useEffect(() => {
        if (initialWhiteboards.length > 0) {
            const converted = convertWhiteboardsToSlides(initialWhiteboards);
            setSlides(converted); // Always update slides
            // If we are in grid, just let it update. If presenting, check bounds.
            if (viewMode === 'present' && currentIndex >= converted.length) {
                setCurrentIndex(0); // Reset to first slide if current is out of bounds
            }
        } else {
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
            if (playState === 'playing' && !showSettings) {
                setControlsVisible(false);
            }
        }, 3000);
    }, [playState, showSettings]);

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
        // Respect playback order: if 'last', map the requested index so that
        // grid index 0 corresponds to last slide when presenting.
        const clamped = Math.max(0, Math.min(index, slides.length - 1));
        const startIndex = playbackOrder === 'first' ? clamped : (slides.length - 1 - clamped);
        setCurrentIndex(startIndex);
        setViewMode('present');
        resetTransform();
        setPlayState(settings.autoPlay ? 'playing' : 'paused');
    };

    const exitPresentation = () => {
        setPlayState('idle');
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
        // If the grid is showing reversed slides, map the clicked index back to the
        // original slides array index before deleting.
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

    const adjustZoom = (delta: number) => { setZoom(z => Math.max(0.1, Math.min(8, z + delta))); };

    const handleMouseDown = (e: React.MouseEvent) => {
        showControls();
        if (activeTool !== 'hand') return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
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

    // --- RENDER ---
    if (slides.length === 0) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                <RotateCcw size={48} className="mb-4 opacity-50" />
                <p className="text-lg">No slides generated.</p>
                <p className="text-sm mt-2">Go to Classroom to create content.</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100]' : 'relative h-full'}`}>

            {viewMode === 'grid' ? (
                <div className="flex flex-col h-full">
                    <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0">
                        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <LayoutGrid size={20} className="text-indigo-500" /> Presentation Index
                        </h2>
                        <div className="flex items-center gap-3">
                            <select value={playbackOrder} onChange={(e) => setPlaybackOrder(e.target.value as 'first' | 'last')}
                                className="bg-white/5 text-sm text-white p-1 rounded border border-white/10">
                                <option value="last">Last → First</option>
                                <option value="first">First → Last</option>
                            </select>
                            <button
                                onClick={() => enterPresentation(currentIndex)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all"
                                aria-label="Start Presentation"
                            >
                                <Play size={16} fill="currentColor" /> Start Show
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {/** Pass displayedSlides to `SlideGrid` so numbering/order matches playbackOrder */}
                        <SlideGrid slides={playbackOrder === 'first' ? slides : [...slides].reverse()} onSelect={enterPresentation} onDelete={handleDelete} />
                    </div>
                </div>
            ) : (
                <div
                    className="relative w-full h-full bg-black flex flex-col overflow-hidden group/player select-none"
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
                        className={`w-full h-full flex items-center justify-center overflow-hidden relative p-4 ${activeTool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <div
                            className={`transition-opacity duration-200 ease-out origin-center ${fade ? 'opacity-0' : 'opacity-100'}`}
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                willChange: 'transform'
                            }}
                        >
                            {/* FIX: Added bg-white to ensure SVGs with transparent backgrounds are visible */}
                            <div className="relative shadow-2xl w-full h-full max-w-[1920px] max-h-[1080px] flex items-center justify-center bg-white">
                                <div className="w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: currentSlide?.svgContent || '' }} />

                                <div className="absolute inset-0 z-10 pointer-events-none">
                                    <div className={activeTool === 'pen' ? 'pointer-events-auto w-full h-full' : 'hidden'}>
                                        <AnnotationLayer active={activeTool === 'pen'} color={settings.highlightColor} />
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

                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <ToolButton icon={MousePointer2} active={activeTool === 'cursor'} onClick={() => setActiveTool('cursor')} label="Pointer" />
                        <ToolButton icon={Hand} active={activeTool === 'hand'} onClick={() => setActiveTool('hand')} label="Pan" />
                        <ToolButton icon={PenTool} active={activeTool === 'pen'} onClick={() => setActiveTool('pen')} label="Pen" />
                        <ToolButton icon={Zap} active={activeTool === 'laser'} onClick={() => setActiveTool('laser')} label="Laser" />
                        <ToolButton icon={Lightbulb} active={activeTool === 'spotlight'} onClick={() => setActiveTool('spotlight')} label="Spotlight" />
                        <div className="w-full h-px bg-white/10 my-1"></div>
                        <ToolButton icon={ZoomIn} active={false} onClick={() => adjustZoom(0.25)} label="Zoom In" />
                        <ToolButton icon={ZoomOut} active={false} onClick={() => adjustZoom(-0.25)} label="Zoom Out" />
                        <ToolButton icon={RotateCcw} active={false} onClick={resetTransform} label="Reset View" />
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
        className={`p-2.5 rounded-xl transition-all group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
        aria-label={label}
    >
        <Icon size={20} />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-medium">
            {label}
        </span>
    </button>
);
