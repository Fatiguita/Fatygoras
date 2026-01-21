import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, 
  LayoutGrid, MonitorPlay, PenTool, MousePointer2,
  ZoomIn, ZoomOut, RotateCcw, X, Hand,
  Maximize, Minimize, Zap, Lightbulb, Settings, HelpCircle
} from 'lucide-react';
import { SlideData, PlayerSettings, PlayState, WhiteboardData } from '../../types';
import { usePresentationTTS } from '../../hooks/usePresentationTTS';
import { SlideGrid } from './SlideGrid';
import { AnnotationLayer } from './AnnotationLayer';
import { convertWhiteboardsToSlides } from '../../utils/presentationUtils';
import { cancelAudio } from '../../services/audioService'; // NEW: Import cancelAudio

const DEFAULT_SETTINGS: PlayerSettings = {
  voiceURI: null,
  rate: 1,
  pitch: 1,
  themeColor: '#4f46e5', 
  highlightColor: '#f59e0b',
  autoPlay: true,
  pacing: 500, // NEW: Default 0.5s delay between speech segments
  staticSlideDuration: 10000, // NEW: Default 10s for slides with no speech tags
  minSlideDuration: 5000      // NEW: Minimum 5s for ANY slide, regardless of speech length
};

type ToolMode = 'cursor' | 'hand' | 'pen' | 'laser' | 'spotlight';

interface PresenterModeProps {
    initialWhiteboards: WhiteboardData[];
}

export const PresenterMode: React.FC<PresenterModeProps> = ({ initialWhiteboards }) => {
  // --- STATE MANAGEMENT ---
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playState, setPlayState] = useState<PlayState>('idle');
  
  // FIX: viewMode state correctly declared.
  const [viewMode, setViewMode] = useState<'present' | 'grid'>('grid');
  
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  
  // UI State
  const [activeTool, setActiveTool] = useState<ToolMode>('cursor');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false); // Manages app's internal fullscreen state
  
  // Transform State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [fade, setFade] = useState(false);

  // --- HELPERS ---
  const resetTransform = () => { 
      setZoom(1); 
      setPan({ x: 0, y: 0 }); 
  };

  /**
   * Enters presentation mode for a specific slide index.
   * Handles state changes for view mode, current slide, and playback.
   */
  const enterPresentation = (index: number) => { 
      // Safety check: cannot enter presentation if there are no slides
      if (slides.length === 0) {
          setViewMode('grid'); // Ensure we are in grid view
          setPlayState('idle'); // Stop any playback
          return;
      }
      // Ensure the index is within bounds
      const actualIndex = Math.max(0, Math.min(index, slides.length - 1));

      setCurrentIndex(actualIndex); 
      setViewMode('present'); 
      resetTransform(); 
      // Start playing if autoPlay is enabled in settings, otherwise pause.
      setPlayState(settings.autoPlay ? 'playing' : 'paused'); 
  };

  /**
   * Exits the current presentation and returns to the slide grid view.
   * Stops any ongoing audio playback and forces browser out of fullscreen if active.
   */
  const exitPresentation = () => {
      setPlayState('idle'); 
      setViewMode('grid'); 
      cancelAudio(); // FIX: Use centralized cancel here too
      
      // FIX: Force browser to exit fullscreen when clicking the 'X' button in the player controls
      if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.warn("Exit fullscreen failed:", err));
          // setIsFullscreen(false) will be handled by the 'fullscreenchange' event listener
      }
  };


  // --- EFFECTS ---

  // Effect to convert Fatygoras Whiteboards to Presenter Slides
  useEffect(() => {
      if (initialWhiteboards.length > 0) {
          const converted = convertWhiteboardsToSlides(initialWhiteboards);
          // Only update if the number of slides changes to avoid unnecessary re-renders and state resets
          if (converted.length !== slides.length) {
              setSlides(converted);
              // If we just added slides and were in presentation mode, or current index is out of bounds
              if (viewMode === 'present' && (slides.length === 0 || currentIndex >= converted.length)) {
                  setCurrentIndex(0); // Go to first slide
                  setPlayState(settings.autoPlay ? 'playing' : 'idle'); // Start playing if autoPlay is true
              }
          }
      } else {
        // If whiteboards become empty, clear slides and go to grid view
        setSlides([]);
        setCurrentIndex(0); // Reset index
        setViewMode('grid');
        setPlayState('idle'); // Stop playback
      }
  }, [initialWhiteboards, slides.length, viewMode, currentIndex, settings.autoPlay]);

  // Effect to set CSS variable for highlight color (used in index.css)
  useEffect(() => {
      document.documentElement.style.setProperty('--highlight-color', settings.highlightColor);
  }, [settings.highlightColor]);

  // FIX: Add this effect to synchronize `isFullscreen` state with browser's native fullscreen API
  // This handles cases where the user presses ESC to exit fullscreen directly.
  useEffect(() => {
      const handleFsChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  // Get the current slide based on currentIndex
  const currentSlide = slides[currentIndex];

  /**
   * Transitions to a new slide with a fade effect.
   * @param {number} newIndex The index of the slide to transition to.
   */
  const changeSlide = (newIndex: number) => {
      if (newIndex < 0 || newIndex >= slides.length) return; // Prevent out-of-bounds access
      setFade(true); // Start fade-out animation
      setTimeout(() => { 
          setCurrentIndex(newIndex); // Update the current slide index
          resetTransform(); // Reset zoom/pan for the new slide
          setFade(false); // End fade-in animation
          // Restart/pause playback for the new slide's narrative based on autoPlay setting
          setPlayState(settings.autoPlay ? 'playing' : 'paused'); 
      }, 200); // Duration of the fade transition
  };

  /**
   * Handles moving to the next slide in the presentation.
   * Loops back to the first slide if at the end.
   */
  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
        changeSlide(currentIndex + 1);
    } else {
        setPlayState('idle'); // Stop playing when all slides are done
        changeSlide(0); // Loop back to the first slide
    }
  };

  // Custom hook for Text-to-Speech functionality
  // This hook now internally manages its segment index and uses `speakAndWait`
  const { voices, activeId } = usePresentationTTS(
    currentSlide?.narrativeSegments || [], // Pass narrative segments of the current slide
    playState === 'playing' && viewMode === 'present', // Audio plays only if in 'present' view and 'playing' state
    handleNext, // Callback when all segments of the current slide are finished (triggers next slide)
    settings // Pass TTS settings (rate, pitch, voiceURI, pacing, staticSlideDuration, minSlideDuration)
  );

  // Effect to apply highlight class to the active SVG element based on `activeId` from TTS hook
  useEffect(() => {
      // Remove highlight from any previously active elements
      const highlights = document.querySelectorAll('.svg-highlight-active');
      highlights.forEach(el => el.classList.remove('svg-highlight-active'));
      
      // Apply highlight to the element whose ID matches `activeId`
      if (activeId) {
          const el = document.getElementById(activeId);
          if (el) el.classList.add('svg-highlight-active');
      }
  }, [activeId]); // Re-run whenever `activeId` changes

  // --- CONTROLS HANDLERS ---

  /**
   * Toggles playback state between 'playing' and 'paused'.
   * FIX: Ensures immediate cancellation of speech when pausing.
   */
  const togglePlay = () => {
      setPlayState(prev => {
          if (prev === 'playing') {
              cancelAudio(); // FIX: Immediate stop of all audio (native + fallback)
              return 'paused';
          } else {
              return 'playing';
          }
      });
  };

  /**
   * Toggles fullscreen mode for the entire document.
   * The `isFullscreen` state is managed by the `fullscreenchange` event listener.
   */
  const toggleFullscreen = () => {
      if (!document.fullscreenElement) { 
          document.documentElement.requestFullscreen().catch((e) => console.error("Fullscreen request failed:", e)); 
          // State will be updated by the useEffect listener when 'fullscreenchange' event fires
      } else { 
          document.exitFullscreen().catch((e) => console.error("Exit fullscreen failed:", e)); 
          // State will be updated by the useEffect listener when 'fullscreenchange' event fires
      }
  };

  // Handles moving to the previous slide
  const handlePrev = () => { 
      if (currentIndex > 0) changeSlide(currentIndex - 1); 
  };

  /**
   * Handles deleting a slide from the `slides` array.
   * Adjusts the `currentIndex` if the deleted slide was the current one or before it.
   * NOTE: This delete function is only exposed in the SlideGrid component, not during active presentation.
   */
  const handleDelete = (index: number) => {
      const newSlides = slides.filter((_, i) => i !== index);
      setSlides(newSlides);
      if (newSlides.length === 0) {
        setViewMode('grid'); // If no slides left, switch to grid view
        setPlayState('idle'); // Stop playback
      } else if (index === currentIndex) {
        // If the current slide was deleted, move to the previous one (or stay at 0 if it was the first)
        changeSlide(Math.max(0, index - 1));
      } else if (index < currentIndex) {
        // If a slide before the current one was deleted, decrement the current index to keep focus
        setCurrentIndex(prev => prev - 1);
      }
  };

  // Adjusts the zoom level, clamping between 0.1x and 8x
  const adjustZoom = (delta: number) => { setZoom(z => Math.max(0.1, Math.min(8, z + delta))); };

  // --- MOUSE INPUT HANDLERS ---

  // Handles mouse down for initiating panning
  const handleMouseDown = (e: React.MouseEvent) => {
      if (activeTool !== 'hand') return; // Only pan if 'hand' tool is active
      setIsDragging(true); // Set dragging state to true
      // Store the initial mouse position relative to the current pan offset
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  // Handles mouse move for panning, laser, and spotlight tools
  const handleMouseMove = (e: React.MouseEvent) => {
      // Update mouse position for laser/spotlight effects
      if (activeTool === 'laser' || activeTool === 'spotlight') {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      // Handle panning if dragging is active and 'hand' tool is selected
      if (!isDragging || activeTool !== 'hand') return;
      e.preventDefault(); // Prevent default browser drag behavior (e.g., text selection)
      // Calculate new pan offset based on current mouse position
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  // Handles mouse up to stop dragging
  const handleMouseUp = () => setIsDragging(false);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore key presses if a modal is open or an input field is focused
          if (showHelp || showSettings) return;
          if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;

          // Only apply presentation-specific shortcuts in 'present' view, unless it's for help (?)
          if (viewMode !== 'present' && e.key !== '?') return; 

          switch(e.key) {
              case 'ArrowRight': handleNext(); break; // Next slide
              case 'ArrowLeft': handlePrev(); break;  // Previous slide
              case ' ': e.preventDefault(); togglePlay(); break; // Spacebar to play/pause (prevent default scroll)
              case 'Escape': 
                  // FIX: If browser is NOT in fullscreen, Esc should exit the Presentation View.
                  // If it IS in fullscreen, the browser handles Esc naturally to exit fullscreen,
                  // and our 'fullscreenchange' listener will update the UI state.
                  if (!document.fullscreenElement) {
                      exitPresentation(); // Use the new exit function
                  }
                  break;
              // Tool selection shortcuts
              case 'h': setActiveTool('hand'); break;      // Hand tool for panning
              case 'p': setActiveTool('pen'); break;       // Pen tool for annotation
              case 'v': setActiveTool('cursor'); break;    // Default cursor/pointer
              case 'l': setActiveTool('laser'); break;     // Laser pointer
              case 's': setActiveTool('spotlight'); break; // Spotlight effect
              case 'f': toggleFullscreen(); break;         // Toggle fullscreen
              case '?': setShowHelp(prev => !prev); break; // Toggle help modal
          }
      };
      // Add keyboard event listener when component mounts
      window.addEventListener('keydown', handleKeyDown);
      // Cleanup: remove event listener on component unmount
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, currentIndex, slides.length, showHelp, showSettings, playState, enterPresentation, handleNext, handlePrev, toggleFullscreen, togglePlay, exitPresentation]);

  // --- CONDITIONAL RENDERING FOR EMPTY STATE ---
  // If no whiteboards are loaded into slides, display a message.
  if (slides.length === 0) {
      return (
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
              <MonitorPlay size={48} className="mb-4 opacity-50"/>
              <p className="text-lg">No slides generated from current Classroom content.</p>
              <p className="text-sm mt-2">Go to the Classroom tab, generate some whiteboards, then return here.</p>
          </div>
      );
  }

  // --- MAIN COMPONENT RENDERING ---
  return (
    // Main container for the PresenterMode.
    // Dynamically applies `fixed inset-0 z-[100]` styles when in fullscreen mode.
    <div className={`h-full w-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100]' : 'relative'}`}>
      
      {/* TOP BAR / HEADER */}
      {/* This header is always visible, even in fullscreen, but its content is adapted */}
      <div className={`h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shadow-md z-30 shrink-0`}>
        <div className="flex items-center gap-2">
           <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Presentation Mode</span>
        </div>
        
        {/* View Switcher: Grid vs. Present */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button 
                onClick={() => { exitPresentation(); }} // Use exitPresentation here too for consistency
                className={`p-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <LayoutGrid size={16}/> Index
            </button>
            <button 
                onClick={() => enterPresentation(currentIndex)}
                disabled={slides.length === 0} // Disable if no slides are available
                className={`p-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition ${viewMode === 'present' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <MonitorPlay size={16}/> Present
            </button>
        </div>

        {/* Right-side global tools: Settings, Help, Fullscreen */}
        <div className="flex gap-2 items-center">
            <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white" title="Settings"><Settings size={18}/></button>
            <button onClick={() => setShowHelp(true)} className="p-2 text-slate-400 hover:text-white" title="Shortcuts (?)"><HelpCircle size={18}/></button>
            <button onClick={toggleFullscreen} className="p-2 text-slate-400 hover:text-white" title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}>
                {isFullscreen ? <Minimize size={18}/> : <Maximize size={18}/>}
            </button>
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-600 p-6 rounded-xl shadow-2xl max-w-sm w-full relative">
                <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><HelpCircle size={20}/> Shortcuts</h3>
                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Play / Pause</span> <code className="bg-slate-700 px-1 rounded">Space</code></div>
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Next / Prev Slide</span> <code className="bg-slate-700 px-1 rounded">Arrows</code></div>
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Laser Pointer</span> <code className="bg-slate-700 px-1 rounded">L</code></div>
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Spotlight Mode</span> <code className="bg-slate-700 px-1 rounded">S</code></div>
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Hand / Pan Tool</span> <code className="bg-slate-700 px-1 rounded">H</code></div>
                    <div className="flex justify-between border-b border-slate-700 pb-1"><span>Pointer / Select</span> <code className="bg-slate-700 px-1 rounded">V</code></div>
                    <div className="flex justify-between"><span>Toggle Fullscreen</span> <code className="bg-slate-700 px-1 rounded">F</code></div>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            {/* Added max-h-[85vh] and overflow-y-auto to allow scrolling on small screens */}
            <div className="bg-slate-800 border border-slate-600 p-6 rounded-xl shadow-2xl max-w-sm w-full relative max-h-[85vh] overflow-y-auto">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings size={20}/> Player Settings</h3>
                
                {/* Narrator Voice Selection */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Narrator Voice</label>
                    <select 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        value={settings.voiceURI || ''}
                        onChange={(e) => setSettings({...settings, voiceURI: e.target.value})}
                    >
                        <option value="">Default Device Voice</option>
                        {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.slice(0, 30)} ({v.lang})</option>)}
                    </select>
                </div>

                {/* Speed & Pitch Sliders */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Speed: {settings.rate.toFixed(1)}x</label>
                        <input type="range" min="0.5" max="2" step="0.1" value={settings.rate} onChange={(e) => setSettings({...settings, rate: parseFloat(e.target.value)})} className="w-full accent-indigo-500"/>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Pitch: {settings.pitch.toFixed(1)}</label>
                        <input type="range" min="0.5" max="2" step="0.1" value={settings.pitch} onChange={(e) => setSettings({...settings, pitch: parseFloat(e.target.value)})} className="w-full accent-indigo-500"/>
                    </div>
                </div>

                {/* NEW: Timing & Pacing Section */}
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 mt-4">Timing & Pacing</h4>

                {/* Pacing Delay */}
                <div className="mb-3">
                    <label className="block text-xs text-slate-400 mb-1 flex justify-between">
                        <span>Inter-segment Delay</span>
                        <span>{(settings.pacing / 1000).toFixed(1)}s</span>
                    </label>
                    <input 
                        type="range" 
                        min="0" 
                        max="2000" 
                        step="100" 
                        value={settings.pacing} 
                        onChange={(e) => setSettings({...settings, pacing: parseInt(e.target.value)})} 
                        className="w-full accent-indigo-500"
                    />
                    <p className="text-[10px] text-slate-600">Time added between spoken parts of a slide.</p>
                </div>

                {/* Minimum Slide Time */}
                <div className="mb-3">
                    <label className="block text-xs text-slate-400 mb-1 flex justify-between">
                        <span>Minimum Slide Time</span>
                        <span>{settings.minSlideDuration / 1000}s</span>
                    </label>
                    <input 
                        type="range" 
                        min="1000" // Min 1 second
                        max="20000" // Max 20 seconds
                        step="1000" 
                        value={settings.minSlideDuration} 
                        onChange={(e) => setSettings({...settings, minSlideDuration: parseInt(e.target.value)})} 
                        className="w-full accent-indigo-500"
                    />
                    <p className="text-[10px] text-slate-600">All slides will last at least this long.</p>
                </div>

                {/* Static Slide Duration */}
                <div className="mb-3">
                    <label className="block text-xs text-slate-400 mb-1 flex justify-between">
                        <span>Static Slide Duration</span>
                        <span>{settings.staticSlideDuration / 1000}s</span>
                    </label>
                    <input 
                        type="range" 
                        min="5000" // Min 5 seconds
                        max="60000" // Max 60 seconds
                        step="5000" 
                        value={settings.staticSlideDuration} 
                        onChange={(e) => setSettings({...settings, staticSlideDuration: parseInt(e.target.value)})} 
                        className="w-full accent-indigo-500"
                    />
                    <p className="text-[10px] text-slate-600">Duration for slides with no spoken narrative.</p>
                </div>


                {/* Highlight Color Picker */}
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-2">Highlight Glow Color</label>
                    <div className="flex gap-2 justify-between">
                        {['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'].map(color => (
                            <button
                                key={color}
                                onClick={() => setSettings({...settings, highlightColor: color})}
                                className={`w-8 h-8 rounded-full border-2 transition ${settings.highlightColor === color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {viewMode === 'grid' ? (
            <SlideGrid 
                slides={slides} 
                onSelect={enterPresentation} 
                onDelete={handleDelete} // Delete button is only here in Grid view
            />
        ) : (
            // --- PRESENTATION VIEW MODE ---
            <div className="flex-1 relative bg-black flex flex-col overflow-hidden">
                
                {/* FLOATING WIDGET: TOOLBAR (Left side, for interaction tools) */}
                <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 bg-slate-800/90 backdrop-blur p-2 rounded-lg border border-slate-700 shadow-xl">
                    <button onClick={() => setActiveTool('cursor')} className={`p-2 rounded transition ${activeTool === 'cursor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Pointer (V)"><MousePointer2 size={20} /></button>
                    <button onClick={() => setActiveTool('hand')} className={`p-2 rounded transition ${activeTool === 'hand' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Hand Tool (H)"><Hand size={20} /></button>
                    <button onClick={() => setActiveTool('pen')} className={`p-2 rounded transition ${activeTool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Pen Tool (P)"><PenTool size={20} /></button>
                    <button onClick={() => setActiveTool('laser')} className={`p-2 rounded transition ${activeTool === 'laser' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Laser (L)"><Zap size={20} /></button>
                    <button onClick={() => setActiveTool('spotlight')} className={`p-2 rounded transition ${activeTool === 'spotlight' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Spotlight (S)"><Lightbulb size={20} /></button>
                </div>

                {/* FLOATING WIDGET: ZOOM CONTROLS (Right side) */}
                <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 bg-slate-800/90 backdrop-blur p-2 rounded-lg border border-slate-700 shadow-xl">
                     <button onClick={() => adjustZoom(0.25)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Zoom In"><ZoomIn size={20} /></button>
                     <span className="text-center text-xs text-slate-500 font-mono">{Math.round(zoom * 100)}%</span>
                     <button onClick={() => adjustZoom(-0.25)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Zoom Out"><ZoomOut size={20} /></button>
                     <button onClick={resetTransform} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded border-t border-slate-700 mt-1" title="Reset View"><RotateCcw size={16} /></button>
                </div>

                {/* PRESENTATION STAGE AREA (The actual slide display) */}
                <div 
                    className={`w-full h-full flex items-center justify-center overflow-hidden relative cursor-${activeTool === 'hand' ? (isDragging ? 'grabbing' : 'grab') : 'default'}`}
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
                        <div className="relative shadow-2xl bg-white w-full h-full flex items-center justify-center">
                             {/* Renders the SVG content of the current slide */}
                             <div className="w-full h-full pointer-events-none select-none" dangerouslySetInnerHTML={{ __html: currentSlide?.svgContent || '' }} />
                             
                             {/* Annotation Layer: conditionally rendered and interactive only when 'pen' tool is active */}
                             <div className="absolute inset-0 z-10 pointer-events-none">
                                <div className={activeTool === 'pen' ? 'pointer-events-auto w-full h-full' : 'hidden'}>
                                    <AnnotationLayer active={activeTool === 'pen'} color={settings.highlightColor} />
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Laser Pointer Overlay: follows mouse, only visible when 'laser' tool is active */}
                    {activeTool === 'laser' && (
                        <div 
                            className="absolute pointer-events-none z-50 w-4 h-4 rounded-full mix-blend-screen" 
                            style={{ 
                                left: mousePos.x - 8, top: mousePos.y - 8, 
                                backgroundColor: settings.highlightColor, 
                                boxShadow: `0 0 15px 4px ${settings.highlightColor}` 
                            }} 
                        />
                    )}
                    
                    {activeTool === 'spotlight' && (
                        <div 
                            className="absolute inset-0 pointer-events-none z-50" 
                            style={{ background: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, rgba(0,0,0,0.85) 150px)` }} 
                        />
                    )}
                </div>

                {/* FLOATING WIDGET: PLAYER CONTROLS (Bottom-center navigation and info) */}
                <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur border border-slate-700 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 ${isFullscreen ? 'opacity-0 hover:opacity-100 transition-opacity duration-500' : 'opacity-100'}`}>
                    {/* Previous Slide Button */}
                    <button onClick={handlePrev} disabled={currentIndex === 0} className="text-slate-400 hover:text-white disabled:opacity-30 hover:scale-110 transition"><SkipBack size={24}/></button>
                    
                    {/* Play/Pause Button */}
                    <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all">
                        {playState === 'playing' ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1"/>}
                    </button>
                    
                    {/* Next Slide Button */}
                    <button onClick={handleNext} disabled={currentIndex === slides.length - 1} className="text-slate-400 hover:text-white disabled:opacity-30 hover:scale-110 transition"><SkipForward size={24}/></button>
                    
                    <div className="w-px h-8 bg-slate-700 mx-2"></div>
                    
                    {/* Slide Information (Current/Total and Slide Name) - DELETE BUTTON REMOVED */}
                    <div className="flex flex-col">
                        <span className="text-xs text-slate-400 font-medium">SLIDE {currentIndex + 1} / {slides.length}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200 max-w-[150px] truncate">{currentSlide?.name}</span>
                        </div>
                    </div>

                    {/* Separator before Exit Button */}
                    <div className="w-px h-8 bg-slate-700 mx-2"></div>

                    {/* Exit Presentation Button */}
                    <button 
                        onClick={exitPresentation} // Calls the new exit function
                        className="text-slate-400 hover:text-red-400 transition hover:scale-110" 
                        title="Exit Presentation"
                    >
                        <X size={24} /> {/* X icon for exiting */}
                    </button>
                </div>

                {/* TEXT NARRATIVE DISPLAY (Top-center, shows current narrative segment) */}
                {currentSlide?.fullNarrative && (
                    <div className={`group relative absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 pointer-events-none ${isFullscreen ? 'opacity-0 hover:opacity-100 transition-opacity' : ''}`}>
                        <div className="bg-black/60 backdrop-blur px-6 py-2 rounded-full border border-white/10 shadow-lg text-center transition-all">
                            <span className="text-white text-sm font-medium">{currentSlide.fullNarrative}</span>
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
}
