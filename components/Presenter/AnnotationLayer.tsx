import React, { useRef, useEffect, useState } from 'react';
import { Eraser } from 'lucide-react'; // Importing Eraser icon from lucide-react

interface AnnotationLayerProps {
    active: boolean; // Controls whether drawing is enabled
    color: string;   // The drawing color
}

/**
 * A React component that provides an annotation layer over the presentation slides.
 * It allows users to draw freehand lines on a transparent HTML5 canvas.
 *
 * @param {AnnotationLayerProps} { active, color }
 * @returns {JSX.Element} The annotation layer component.
 */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({ active, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null); // Ref to the canvas HTML element
    const [isDrawing, setIsDrawing] = useState(false); // State to track if the user is currently drawing

    // Effect to set up and resize the canvas when the component mounts or dependencies change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Resize canvas to match its parent's dimensions.
        // This is crucial to ensure the canvas drawing aligns with the SVG content.
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.lineCap = 'round';   // Rounded line caps for a smoother drawing appearance
            ctx.lineJoin = 'round';  // Rounded line joins for corners
            ctx.lineWidth = 4;       // Default line width for drawing
            ctx.strokeStyle = color; // Set stroke color from props for drawing
        }
    }, [color]); // Re-run if the drawing color changes (e.g., from settings)

    /**
     * Helper to extract (x,y) coordinates from both Mouse and Touch events relative to the canvas.
     * Accounts for CSS transforms (zoom) by calculating the scale ratio between
     * the internal canvas size and the visual bounding rectangle.
     */
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            // Use the first finger for drawing
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        // Calculate scale factors to map screen pixels to canvas bitmap pixels
        // This fixes offset issues when the parent container is zoomed/scaled via CSS
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    /**
     * Handles the mouse/touch down event to initiate drawing.
     * Starts a new path on the canvas context.
     * @param {React.MouseEvent | React.TouchEvent} e The event object.
     */
    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!active) return; // Only allow drawing if the annotation layer is active
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoordinates(e);

        ctx.beginPath(); // Begin a new drawing path
        ctx.moveTo(x, y); // Move to start
        setIsDrawing(true); // Set drawing state to true
    };

    /**
     * Handles the mouse/touch move event to continue drawing.
     * Draws a line from the previous point to the current position.
     * @param {React.MouseEvent | React.TouchEvent} e The event object.
     */
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        // Only draw if `isDrawing` is true and the layer is `active`
        if (!isDrawing || !active) return; 
        
        // Prevent scrolling on touch devices while drawing
        if ('touches' in e && e.cancelable) {
            e.preventDefault();
        }

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoordinates(e);
        
        ctx.lineTo(x, y); // Draw a line segment
        ctx.stroke(); // Render the current path
    };

    /**
     * Clears all drawings from the canvas.
     */
    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear all pixels in the canvas
        }
    };

    return (
        <>
            <canvas 
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
                
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={() => setIsDrawing(false)}
                
                // Dynamically apply cursor and pointer-events based on `active` state.
                // touch-none ensures browser scrolling doesn't interfere with drawing.
                className={`absolute inset-0 z-10 touch-none ${active ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            />
            {active && ( // Render drawing controls only if the annotation layer is active
                <div className="absolute top-4 right-4 z-20 bg-white shadow-md p-1 rounded-lg flex gap-1 pointer-events-auto">
                    <button 
                        onClick={clear} 
                        className="p-2 hover:bg-red-50 text-red-500 rounded" 
                        title="Clear All Drawings"
                    >
                        <Eraser size={18} /> {/* Lucide Eraser icon */}
                    </button>
                    {/* Display current drawing color */}
                    <div 
                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm" 
                        style={{backgroundColor: color}}
                        title={`Current drawing color: ${color}`}
                    ></div>
                </div>
            )}
        </>
    );
};
