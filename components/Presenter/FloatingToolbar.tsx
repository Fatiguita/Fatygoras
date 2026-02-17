import React from 'react';
import { 
    MousePointer2, Hand, PenTool, Type, Zap, Lightbulb, 
    ZoomIn, ZoomOut, RotateCcw 
} from 'lucide-react';
import { ToolMode } from '../../types';

interface FloatingToolbarProps {
    activeTool: ToolMode;
    setActiveTool: (tool: ToolMode) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
    visible: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    activeTool,
    setActiveTool,
    onZoomIn,
    onZoomOut,
    onReset,
    mobileMenuOpen,
    setMobileMenuOpen,
    visible
}) => {
    return (
        <div className={`
            absolute z-40 transition-all duration-300 flex flex-col
            ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
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
                
                <ToolButton icon={ZoomIn} active={false} onClick={onZoomIn} label="Zoom In" />
                <ToolButton icon={ZoomOut} active={false} onClick={onZoomOut} label="Zoom Out" />
                <ToolButton icon={RotateCcw} active={false} onClick={onReset} label="Reset View" />
            </div>
        </div>
    );
};

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
