import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Maximize, Minimize } from 'lucide-react';
import { PlayState } from '../../types';

interface PlayerControlsProps {
    currentIndex: number;
    totalSlides: number;
    playState: PlayState;
    progressPercent: number;
    visible: boolean;
    onTogglePlay: () => void;
    onPrev: () => void;
    onNext: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    playbackOrder: 'first' | 'last';
    voiceName: string;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    currentIndex,
    totalSlides,
    playState,
    progressPercent,
    visible,
    onTogglePlay,
    onPrev,
    onNext,
    isFullscreen,
    onToggleFullscreen,
    playbackOrder,
    voiceName
}) => {
    return (
        <div className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-12 pb-6 px-4 md:px-8 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

            <div className="relative h-1.5 bg-white/20 rounded-full mb-4 w-full cursor-pointer overflow-hidden group/progress">
                <div className="absolute left-0 top-0 bottom-0 bg-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                <div className="absolute left-0 top-0 bottom-0 bg-white/5 w-full">
                    {Array.from({ length: totalSlides }).map((_, idx) => (
                        <div
                            key={idx}
                            className="absolute top-0 bottom-0 w-0.5 bg-black/50"
                            style={{ left: `${(idx / totalSlides) * 100}%` }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onTogglePlay}
                        className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                        aria-label={playState === 'playing' ? 'Pause Presentation' : 'Play Presentation'}
                    >
                        {playState === 'playing' ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={onPrev}
                            disabled={playbackOrder === 'first' ? currentIndex === 0 : currentIndex === totalSlides - 1}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-30"
                            aria-label="Previous Slide"
                        >
                            <SkipBack size={20} />
                        </button>
                        <button
                            onClick={onNext}
                            disabled={playbackOrder === 'first' ? currentIndex === totalSlides - 1 : currentIndex === 0}
                            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-30"
                            aria-label="Next Slide"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>

                    <span className="text-xs md:text-sm font-medium text-white/80 font-mono ml-2">
                        {currentIndex + 1} <span className="text-white/40">/</span> {totalSlides}
                    </span>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden md:flex items-center gap-2 text-white/60 text-xs">
                        <Volume2 size={14} />
                        <span aria-label={`Audio mode: ${voiceName}`}>{voiceName}</span>
                    </div>
                    <button
                        onClick={onToggleFullscreen}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
                        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    >
                        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
