import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SlideData, PlayerSettings, ToolMode } from '../../types';
import { AnnotationLayer, AnnotationLayerRef } from './AnnotationLayer';

interface SlideViewportProps {
    currentSlide: SlideData | undefined;
    activeTool: ToolMode;
    settings: PlayerSettings;
    activeId: string | null;
    isTransitioning: boolean;
    setSettings: React.Dispatch<React.SetStateAction<PlayerSettings>>;
    onInteract: () => void;
}

export interface SlideViewportRef {
    getAnnotationData: () => string | null;
    resetTransform: () => void;
    adjustZoom: (delta: number) => void;
}

export const SlideViewport = forwardRef<SlideViewportRef, SlideViewportProps>(({
    currentSlide,
    activeTool,
    settings,
    activeId,
    isTransitioning,
    setSettings,
    onInteract
}, ref) => {
    // Transform State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Touch State
    const [touchStartDist, setTouchStartDist] = useState<number>(0);
    const [touchStartZoom, setTouchStartZoom] = useState<number>(1);

    // References
    const annotationRef = useRef<AnnotationLayerRef>(null);
    const lastActiveId = useRef<string | null>(null);

    // Constants
    const MIN_ZOOM = 0.6;
    const MAX_ZOOM = 5;

    // --- Exposed Methods ---
    useImperativeHandle(ref, () => ({
        getAnnotationData: () => annotationRef.current?.getCanvasData() || null,
        resetTransform: () => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
        },
        adjustZoom: (delta: number) => {
            if (settings.autoPan) setSettings(prev => ({ ...prev, autoPan: false }));
            setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
        }
    }));

    // --- Auto-Pan Logic ---
    useEffect(() => {
        if (!settings.autoPan || isTransitioning || isDragging) return;

        if (!activeId || activeId === 'root-svg') {
            if (zoom !== 1 || pan.x !== 0 || pan.y !== 0) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
            lastActiveId.current = activeId;
            return;
        }

        if (activeId === lastActiveId.current) return;
        lastActiveId.current = activeId;

        // Cinematic Step 1: Pan Out
        setZoom(1);
        setPan({ x: 0, y: 0 });

        // Cinematic Step 2: Pan In (Delayed)
        const timeoutId = setTimeout(() => {
            const el = document.getElementById(activeId);
            const container = document.getElementById('slide-container');

            if (el && container) {
                const elRect = el.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                if (elRect.width === 0 || elRect.height === 0) return;

                const paddingFactor = 0.5;
                const targetW = containerRect.width * paddingFactor;
                const targetH = containerRect.height * paddingFactor;

                const scaleX = targetW / elRect.width;
                const scaleY = targetH / elRect.height;

                const desiredScaleFactor = Math.min(scaleX, scaleY);
                const clampedZoom = Math.max(1, Math.min(settings.maxAutoZoom, desiredScaleFactor));

                const containerCenterX = containerRect.left + containerRect.width / 2;
                const containerCenterY = containerRect.top + containerRect.height / 2;
                
                const elCenterY = elRect.top + elRect.height / 2;
                const diffY = (containerCenterY - elCenterY) * clampedZoom;

                const padding = Math.min(40, 10 * clampedZoom);
                const targetX = containerRect.left + padding;
                
                const targetOffsetX = targetX - containerCenterX;
                const currentOffsetX = elRect.left - containerCenterX;
                
                const diffX = targetOffsetX - (currentOffsetX * clampedZoom);

                setPan({ x: diffX, y: diffY });
                setZoom(clampedZoom);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [activeId, settings.autoPan, isTransitioning, isDragging, settings.maxAutoZoom]);

    // --- Highlighting Logic ---
    useEffect(() => {
        const highlights = document.querySelectorAll('.svg-highlight-active');
        highlights.forEach(el => el.classList.remove('svg-highlight-active'));
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el) el.classList.add('svg-highlight-active');
        }
    }, [activeId]);

    // --- Interaction Handlers ---
    const handleMouseDown = (e: React.MouseEvent) => {
        onInteract();
        if (settings.autoPan && activeTool === 'hand') {
            setSettings(prev => ({ ...prev, autoPan: false }));
        }

        if (activeTool === 'hand') {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        onInteract();
        if (activeTool === 'laser' || activeTool === 'spotlight') {
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        if (!isDragging || activeTool !== 'hand') return;
        e.preventDefault();
        setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        onInteract();
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
        onInteract();
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
                // With touch-action: none, preventDefault is often not needed for scrolling,
                // but we keep it to be safe for other browser behaviors.
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

    const handleWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaY) < 5) return;
        if (settings.autoPan) {
            setSettings(prev => ({ ...prev, autoPan: false }));
        }
        const sensitivity = 0.001;
        const delta = -e.deltaY * sensitivity * (zoom * 1.5);
        setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    };

    return (
        <div
            id="slide-container"
            className={`w-full h-full flex items-center justify-center overflow-hidden relative p-4 ${activeTool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
            // CRITICAL FIX: touch-action: none prevents the browser from handling scrolling/zooming gestures.
            // This eliminates "passive event listener" warnings and allows our JS to handle panning smoothly.
            style={{ touchAction: 'none' }} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
        >
            <div className={`w-full h-full flex items-center justify-center transition-opacity duration-500 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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
    );
});
