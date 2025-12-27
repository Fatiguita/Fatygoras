import React, { useState, useRef, useEffect, useMemo } from 'react';
import Button from './Button';

interface WhiteboardProps {
  svgContent: string;
  explanation: string;
  topic: string;
  onRefine: (image: string, prompt: string) => Promise<void>;
  isRefining: boolean;
}

type Tool = 'pen' | 'box' | 'circle' | 'arrow' | 'text' | 'eraser';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'];

// Helper to ensure SVGs scale correctly within the container
const makeSvgResponsive = (svgString: string): string => {
  let newSvg = svgString;

  // 1. Ensure preserveAspectRatio is set to 'xMidYMid meet' (contain) to prevent cropping
  if (!/preserveAspectRatio/i.test(newSvg)) {
    newSvg = newSvg.replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet"');
  }

  // 2. If viewBox is missing but width/height are present, construct a viewBox
  // This fixes the "cut" issue when models generate fixed-size SVGs without scaling logic
  if (!/viewBox/i.test(newSvg)) {
    const widthMatch = newSvg.match(/width=["']?(\d+(\.\d+)?)["']?/i);
    const heightMatch = newSvg.match(/height=["']?(\d+(\.\d+)?)["']?/i);
    
    if (widthMatch && heightMatch) {
      const w = widthMatch[1];
      const h = heightMatch[1];
      // Add viewBox and remove fixed width/height to allow CSS scaling
      newSvg = newSvg
        .replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`)
        .replace(/width=["']?(\d+(\.\d+)?)["']?/i, '')
        .replace(/height=["']?(\d+(\.\d+)?)["']?/i, '');
    }
  }

  return newSvg;
};

const Whiteboard: React.FC<WhiteboardProps> = ({ svgContent, explanation, topic, onRefine, isRefining }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isAnnotating, setIsAnnotating] = useState(false);
  
  // Panning/Zooming State
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState<number>(0);
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1);

  // Drawing State
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  
  // History State for Undo/Redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  const [refinePrompt, setRefinePrompt] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);

  // Memoize processed SVG to avoid re-parsing on every render
  const processedSvg = useMemo(() => makeSvgResponsive(svgContent), [svgContent]);

  // Fullscreen toggle (CSS only)
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([processedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Resize Canvas logic
  useEffect(() => {
    if (isAnnotating && canvasRef.current && svgWrapperRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = svgWrapperRef.current;
      
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Only resize if different
      if (canvas.width !== width || canvas.height !== height) {
          let savedData: ImageData | null = null;
          if (ctx && canvas.width > 0 && canvas.height > 0) {
             savedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          }
          
          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.lineWidth = 3;
              ctx.font = 'bold 20px sans-serif';
              ctx.textBaseline = 'middle';
              
              if (savedData && !isFullscreen) { 
                 ctx.putImageData(savedData, 0, 0); 
              }
          }
      }
    }
  }, [isAnnotating, isFullscreen]);

  const saveHistory = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
      if (historyStep > 0) {
          const prevStep = historyStep - 1;
          const imageData = history[prevStep];
          setHistoryStep(prevStep);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx && imageData) ctx.putImageData(imageData, 0, 0);
      } else if (historyStep === 0) {
          setHistoryStep(-1);
          clearCanvas(false);
      }
  };

  const handleRedo = () => {
      if (historyStep < history.length - 1) {
          const nextStep = historyStep + 1;
          const imageData = history[nextStep];
          setHistoryStep(nextStep);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx && imageData) ctx.putImageData(imageData, 0, 0);
      }
  };

  // --- INTERACTION HANDLERS (MOUSE & TOUCH) ---
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAnnotating) {
        startDrawing(e);
    } else {
        setIsPanning(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isAnnotating) {
        draw(e);
    } else if (isPanning) {
        e.preventDefault();
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    if (isAnnotating) {
        stopDrawing();
    } else {
        setIsPanning(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnnotating) {
        startDrawing(e);
        return;
    }

    if (e.touches.length === 2) {
        // Pinch Start
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        setTouchStartDist(dist);
        setTouchStartZoom(zoom);
        setIsPanning(false);
    } else if (e.touches.length === 1) {
        // Pan Start
        setIsPanning(true);
        setDragStart({ 
            x: e.touches[0].clientX - pan.x, 
            y: e.touches[0].clientY - pan.y 
        });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnnotating) {
        draw(e);
        return;
    }

    if (e.touches.length === 2) {
        // Pinch Move
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
            const scale = dist / touchStartDist;
            const newZoom = Math.min(Math.max(0.5, touchStartZoom * scale), 5);
            setZoom(newZoom);
        }
    } else if (e.touches.length === 1 && isPanning) {
        // Pan Move
        // preventDefault to stop scrolling page while panning canvas
        if(e.cancelable) e.preventDefault(); 
        setPan({ 
            x: e.touches[0].clientX - dragStart.x, 
            y: e.touches[0].clientY - dragStart.y 
        });
    }
  };

  const handleTouchEnd = () => {
    if (isAnnotating) {
        stopDrawing();
    }
    setIsPanning(false);
    setTouchStartDist(0);
  };

  // --- DRAWING HELPERS ---
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isAnnotating || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'text') {
        const pos = getPos(e);
        setTimeout(() => {
            const text = prompt("Enter annotation text:");
            if (text) {
                ctx.fillStyle = currentColor;
                ctx.font = 'bold 20px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, pos.x, pos.y);
                saveHistory(); 
            }
        }, 10);
        return;
    }

    setIsDrawing(true);
    const pos = getPos(e);
    setStartPos(pos);
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isAnnotating || !isDrawing || !canvasRef.current || !startPos) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const currentPos = getPos(e);

    if (currentTool === 'pen' || currentTool === 'eraser') {
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
    } else {
        if (historyStep >= 0 && history[historyStep]) {
             ctx.putImageData(history[historyStep], 0, 0);
        } else {
             ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        
        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = 3;
        ctx.globalCompositeOperation = 'source-over';

        if (currentTool === 'box') {
            ctx.strokeRect(startPos.x, startPos.y, currentPos.x - startPos.x, currentPos.y - startPos.y);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
            ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (currentTool === 'arrow') {
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
            
            const headLength = 10;
            const dx = currentPos.x - startPos.x;
            const dy = currentPos.y - startPos.y;
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(currentPos.x, currentPos.y);
            ctx.lineTo(currentPos.x - headLength * Math.cos(angle - Math.PI / 6), currentPos.y - headLength * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(currentPos.x - headLength * Math.cos(angle + Math.PI / 6), currentPos.y - headLength * Math.sin(angle + Math.PI / 6));
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.fill();
        }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
        setIsDrawing(false);
        setStartPos(null);
        canvasRef.current?.getContext('2d')?.closePath();
        saveHistory(); 
    }
  };

  const clearCanvas = (resetHistory = true) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      if (resetHistory) {
          setHistory([]);
          setHistoryStep(-1);
      }
    }
  };

  const handleRefineSubmit = async () => {
    if (!refinePrompt.trim()) return;
    
    const svgElement = svgWrapperRef.current?.querySelector('svg');
    if (!svgElement) return;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const imgSrc = `data:image/svg+xml;base64,${svgBase64}`;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current?.width || 800;
    tempCanvas.height = canvasRef.current?.height || 600;
    const ctx = tempCanvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        if (!ctx) return;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        if (canvasRef.current) {
            ctx.drawImage(canvasRef.current, 0, 0);
        }

        const compositeBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
        onRefine(compositeBase64, refinePrompt);
        setRefinePrompt('');
        setIsAnnotating(false);
    };
    img.src = imgSrc;
  };

  return (
    <div 
      ref={containerRef} 
      className={`flex flex-col gap-6 mb-12 ${isFullscreen ? 'fixed inset-0 z-[100] bg-gray-900 p-0 sm:p-4 overflow-hidden h-[100dvh]' : 'animate-fade-in'}`}
    >
      <div className="relative group w-full h-full flex flex-col">
        {!isFullscreen && (
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        )}
        <div className={`relative bg-white dark:bg-[#1e1e1e] ring-1 ring-gray-900/5 dark:ring-white/10 shadow-xl overflow-hidden ${isFullscreen ? 'h-full flex flex-col rounded-none sm:rounded-lg' : 'rounded-lg'}`}>
            
            {/* Toolbar */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center z-10 gap-2 overflow-x-auto no-scrollbar shrink-0">
                <h3 className="font-hand font-bold text-lg text-gray-800 dark:text-gray-200 truncate max-w-[150px] sm:max-w-[200px] shrink-0">{topic}</h3>
                
                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                    {/* Drawing Tools */}
                    {isAnnotating && (
                        <>
                        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5 mr-2">
                            {(['pen', 'eraser', 'box', 'circle', 'arrow', 'text'] as Tool[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setCurrentTool(t)}
                                    className={`p-2 sm:p-1.5 rounded-md text-xs font-semibold capitalize ${currentTool === t ? 'bg-white dark:bg-gray-600 shadow text-blue-600' : 'text-gray-500'}`}
                                    title={t}
                                >
                                    {t === 'pen' && '✎'}
                                    {t === 'eraser' && '⌫'}
                                    {t === 'box' && '☐'}
                                    {t === 'circle' && '○'}
                                    {t === 'arrow' && '↗'}
                                    {t === 'text' && 'T'}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-1 mr-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setCurrentColor(color)}
                                    className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border border-gray-300 dark:border-gray-600 ${currentColor === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>

                        <div className="flex items-center mr-2 text-gray-500 border-l border-gray-300 dark:border-gray-600 pl-2">
                             <button onClick={handleUndo} disabled={historyStep < 0} className="p-2 sm:p-1 hover:text-blue-500 disabled:opacity-30" title="Undo">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                             </button>
                             <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-2 sm:p-1 hover:text-blue-500 disabled:opacity-30" title="Redo">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                             </button>
                        </div>
                        </>
                    )}

                    <button onClick={handleDownloadSvg} className="p-2 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded mr-1" title="Download SVG">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>

                    <button onClick={handleResetView} className="p-2 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Reset View">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>

                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Zoom Out">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <span className="text-xs font-mono min-w-[30px] text-center hidden sm:inline">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Zoom In">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    <button 
                        onClick={() => setIsAnnotating(!isAnnotating)} 
                        className={`p-2 sm:p-1 rounded transition-colors ${isAnnotating ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        title={isAnnotating ? "Exit Annotation Mode" : "Annotate"}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>

                    <button onClick={toggleFullscreen} className="p-2 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title={isFullscreen ? "Minimize" : "Maximize"}>
                        {isFullscreen ? (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                    </button>
                </div>
            </div>
            
            {/* Viewport */}
            <div 
                className={`relative overflow-hidden bg-paper dark:bg-chalkboard-800 ${isFullscreen ? 'flex-1' : 'min-h-[400px] aspect-square sm:aspect-video'} ${!isAnnotating ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Content Layer with Transform */}
                <div 
                    ref={svgWrapperRef}
                    className="absolute inset-0 transition-transform duration-75 origin-top-left flex items-center justify-center w-full h-full will-change-transform"
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                >
                    {/* SVG Layer */}
                    <div 
                        className="pointer-events-none select-none w-full h-full flex items-center justify-center p-2 sm:p-8 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: processedSvg }} 
                    />
                    
                    {/* Canvas Annotation Layer */}
                    {isAnnotating && (
                        <canvas 
                            ref={canvasRef}
                            className="absolute inset-0 z-20 cursor-crosshair touch-none"
                            // Stop propagation so we don't trigger panning
                            onClick={e => e.stopPropagation()}
                        />
                    )}
                </div>
            </div>

            {/* Annotation Tools Footer */}
            {isAnnotating && (
                <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center justify-between shrink-0">
                    <div className="flex gap-2 text-xs">
                        <button onClick={() => clearCanvas(true)} className="text-red-500 hover:underline">Clear Drawings</button>
                    </div>
                    
                    <div className="flex gap-2 flex-1 max-w-md">
                        <input 
                            type="text" 
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            placeholder="Circle something and ask..."
                            className="flex-1 px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        />
                        <Button size="sm" onClick={handleRefineSubmit} disabled={isRefining || !refinePrompt}>
                            {isRefining ? 'Analyzing...' : 'Ask AI'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className={`prose dark:prose-invert max-w-none bg-white/50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm ${isFullscreen ? 'hidden' : ''}`}>
        <div className="markdown-body whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {explanation}
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
