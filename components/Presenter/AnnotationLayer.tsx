import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Eraser } from 'lucide-react';

export interface AnnotationLayerRef {
    getCanvasData: () => string | null;
}

interface AnnotationLayerProps {
    active: boolean; // Controls whether drawing is enabled
    color: string;   // The drawing color
    initialImage?: string; // Base64 string of previous annotations
    tool?: 'pen' | 'text'; // Basic tools passed from parent
}

/**
 * A React component that provides an annotation layer over the presentation slides.
 * It allows users to draw freehand lines or add text on a transparent HTML5 canvas.
 */
export const AnnotationLayer = forwardRef<AnnotationLayerRef, AnnotationLayerProps>(({ active, color, initialImage, tool = 'pen' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        getCanvasData: () => {
            return canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
        }
    }));

    // Initialize Canvas & Load Previous Image
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        
        // Use container dimensions for canvas resolution
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext('2d');
        if (ctx && initialImage) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialImage;
        }
    }, [initialImage]); // Re-run if initialImage changes (e.g., slide change)

    // Update Context Styles
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 4;
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.font = 'bold 24px sans-serif';
        }
    }, [color]);

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Scale coordinates to handle CSS transforms/zoom on the canvas
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!active) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoordinates(e);

        if (tool === 'text') {
            const text = prompt("Enter text:");
            if (text) {
                ctx.fillText(text, x, y);
            }
            return;
        }

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !active || tool !== 'pen') return;
        
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoordinates(e);
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const handleEnd = () => {
        setIsDrawing(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-full">
            <canvas 
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                
                className={`absolute inset-0 z-10 touch-none w-full h-full ${active ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            />
            {active && (
                <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur shadow-md p-1 rounded-lg flex gap-1 pointer-events-auto border border-gray-200">
                    <button 
                        onClick={clear} 
                        className="p-2 hover:bg-red-50 text-red-500 rounded transition-colors" 
                        title="Clear All Drawings"
                    >
                        <Eraser size={18} />
                    </button>
                    {/* Color Indicator */}
                    <div 
                        className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center"
                        title="Current Color"
                    >
                        <div className="w-5 h-5 rounded-full border border-gray-300" style={{backgroundColor: color}}></div>
                    </div>
                </div>
            )}
        </div>
    );
});

AnnotationLayer.displayName = 'AnnotationLayer';
