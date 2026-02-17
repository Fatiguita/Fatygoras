import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react';
import { SlideData, PlayerSettings, PlayState, ToolMode } from '../../types';
import { usePresentationTTS } from '../../hooks/usePresentationTTS';
import { cancelAudio } from '../../services/audioService';
import { SettingsPanel } from './SettingsPanel';
import { FloatingToolbar } from './FloatingToolbar';
import { PlayerControls } from './PlayerControls';
import { SlideViewport, SlideViewportRef } from './SlideViewport';
import { DEFAULT_PLAYER_SETTINGS } from '../../constants';

interface PresentationSessionProps {
    slides: SlideData[];
    initialIndex: number;
    playbackOrder: 'first' | 'last';
    setPlaybackOrder: (order: 'first' | 'last') => void;
    onExit: (finalSlides: SlideData[]) => void;
    initialSettings?: PlayerSettings;
}

export const PresentationSession: React.FC<PresentationSessionProps> = ({
    slides: initialSlides,
    initialIndex,
    playbackOrder,
    setPlaybackOrder,
    onExit,
    initialSettings
}) => {
    // Session State
    const [slides, setSlides] = useState<SlideData[]>(initialSlides);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [playState, setPlayState] = useState<PlayState>('idle');
    // Initialize settings with passed props or default
    const [settings, setSettings] = useState<PlayerSettings>(initialSettings || DEFAULT_PLAYER_SETTINGS);
    const [activeTool, setActiveTool] = useState<ToolMode>('cursor');

    // UI State
    const [showSettings, setShowSettings] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Refs
    const controlsTimeoutRef = useRef<number | null>(null);
    const viewportRef = useRef<SlideViewportRef>(null);

    // --- LOGIC ---

    const saveCurrentAnnotation = useCallback(() => {
        if (viewportRef.current && currentIndex >= 0 && currentIndex < slides.length) {
            const data = viewportRef.current.getAnnotationData();
            if (data) {
                setSlides(prev => prev.map((s, i) => i === currentIndex ? { ...s, annotationData: data } : s));
            }
        }
    }, [currentIndex, slides.length]);

    const changeSlide = useCallback((newIndex: number) => {
        if (newIndex < 0 || newIndex >= slides.length) return;
        
        saveCurrentAnnotation();
        setIsTransitioning(true);

        setTimeout(() => {
            setCurrentIndex(newIndex);
            if(viewportRef.current) viewportRef.current.resetTransform();
            setIsTransitioning(false);
            setPlayState(settings.autoPlay ? 'playing' : 'paused');
        }, 300);
    }, [currentIndex, slides.length, settings.autoPlay, saveCurrentAnnotation]);

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

    const handlePrev = useCallback(() => {
        if (playbackOrder === 'first') {
            if (currentIndex > 0) changeSlide(currentIndex - 1);
        } else {
            if (currentIndex < slides.length - 1) changeSlide(currentIndex + 1);
        }
    }, [currentIndex, slides.length, changeSlide, playbackOrder]);

    // TTS Hook
    const { voices, activeId } = usePresentationTTS(
        slides[currentIndex]?.narrativeSegments || [],
        playState === 'playing',
        handleNext,
        settings
    );

    // UI Handlers
    const handleExit = () => {
        setPlayState('idle');
        cancelAudio();
        saveCurrentAnnotation();
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.warn(err));
        }
        onExit(slides);
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

    // Control Visibility Logic
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

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // Initial AutoPlay
    useEffect(() => {
        if (settings.autoPlay) setPlayState('playing');
    }, []); // Run once on mount

    // Computed Data
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

    return (
        <div
            className="relative w-full h-full bg-black flex flex-col overflow-hidden group/player select-none touch-none"
            onMouseMove={showControls}
            onTouchStart={showControls}
        >
            {/* --- TOP BAR --- */}
            <div className={`absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 flex items-start justify-between ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-3">
                    <button onClick={handleExit} className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors" aria-label="Exit Presentation to Grid View">
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
                        <SettingsIcon size={18} />
                    </button>
                </div>
            </div>

            {/* --- MAIN VIEWPORT --- */}
            <SlideViewport
                ref={viewportRef}
                currentSlide={currentSlide}
                activeTool={activeTool}
                settings={settings}
                setSettings={setSettings}
                activeId={activeId}
                isTransitioning={isTransitioning}
                onInteract={showControls}
            />

            {/* --- CAPTION OVERLAY --- */}
            {currentCaption && (
                <div className={`absolute bottom-24 left-0 right-0 z-20 flex justify-center px-6 transition-all duration-300 ${controlsVisible ? 'translate-y-0' : 'translate-y-8'}`}>
                    <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/5 shadow-lg max-w-3xl text-center">
                        <p className="text-white/90 text-lg md:text-xl font-medium leading-relaxed drop-shadow-md">
                            {currentCaption}
                        </p>
                    </div>
                </div>
            )}

            {/* --- OVERLAYS --- */}
            <FloatingToolbar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                onZoomIn={() => viewportRef.current?.adjustZoom(0.25)}
                onZoomOut={() => viewportRef.current?.adjustZoom(-0.25)}
                onReset={() => viewportRef.current?.resetTransform()}
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                visible={controlsVisible}
            />

            <PlayerControls
                currentIndex={currentIndex}
                totalSlides={slides.length}
                playState={playState}
                progressPercent={progressPercent}
                visible={controlsVisible}
                onTogglePlay={togglePlay}
                onPrev={handlePrev}
                onNext={handleNext}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                playbackOrder={playbackOrder}
                voiceName={settings.voiceURI ? 'AI Voice' : 'Auto'}
            />

            {showSettings && (
                <SettingsPanel
                    settings={settings}
                    setSettings={setSettings}
                    voices={voices}
                    playbackOrder={playbackOrder}
                    setPlaybackOrder={setPlaybackOrder}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};
