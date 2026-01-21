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
     * Handles the mouse down event to initiate drawing.
     * Starts a new path on the canvas context.
     * @param {React.MouseEvent} e The mouse event object.
     */
    const startDraw = (e: React.MouseEvent) => {
        if (!active) return; // Only allow drawing if the annotation layer is active
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        ctx.beginPath(); // Begin a new drawing path
        // Move the drawing pointer to the current mouse offset relative to the canvas
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); 
        setIsDrawing(true); // Set drawing state to true
    };

    /**
     * Handles the mouse move event to continue drawing.
     * Draws a line from the previous point to the current mouse position.
     * @param {React.MouseEvent} e The mouse event object.
     */
    const draw = (e: React.MouseEvent) => {
        // Only draw if `isDrawing` is true (mouse is down) and the layer is `active`
        if (!isDrawing || !active) return; 
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); // Draw a line segment
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
                onMouseUp={() => setIsDrawing(false)} // Stop drawing when mouse button is released
                onMouseLeave={() => setIsDrawing(false)} // Stop drawing if the mouse leaves the canvas area
                // Dynamically apply cursor and pointer-events based on `active` state
                className={`absolute inset-0 z-10 ${active ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
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
