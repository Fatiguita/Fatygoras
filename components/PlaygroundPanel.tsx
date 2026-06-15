import React from 'react';
import Playground from './Playground';
import LoadingTip from './LoadingTip';
import { PlaygroundCode } from '../types';

interface PlaygroundPanelProps {
    playgrounds: PlaygroundCode[];
    activePlaygroundId: string | null;
    setActivePlaygroundId: (id: string) => void;
    activePlaygroundTab: 'practice' | 'test';
    setActivePlaygroundTab: (t: 'practice' | 'test') => void;
    activePlayground: PlaygroundCode | undefined;
    onClose: () => void;
    onCloseItem: (id: string) => void;
    onRetry: () => void;
    onTestComplete: (res: any) => void;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({
    playgrounds,
    activePlaygroundId,
    setActivePlaygroundId,
    activePlaygroundTab,
    setActivePlaygroundTab,
    activePlayground,
    onClose,
    onCloseItem,
    onRetry,
    onTestComplete
}) => {
    const visiblePlaygrounds = playgrounds.filter(p => p.type === activePlaygroundTab);

    return (
        <div className="flex-1 overflow-hidden min-w-[300px] h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pr-2">
                <div className="flex flex-1">
                    <button
                        onClick={() => setActivePlaygroundTab('practice')}
                        className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider ${activePlaygroundTab === 'practice' ? 'bg-white dark:bg-gray-900 border-t-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
                    >
                        Practice Apps
                    </button>
                    <button
                        onClick={() => setActivePlaygroundTab('test')}
                        className={`flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider ${activePlaygroundTab === 'test' ? 'bg-white dark:bg-gray-900 border-t-2 border-orange-500 text-orange-600' : 'text-gray-500'}`}
                    >
                        Level Tests
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 mx-1 text-gray-500 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Close Playground Panel"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {visiblePlaygrounds.length > 0 && (
                <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 no-scrollbar">
                    {visiblePlaygrounds.map(pg => (
                        <div
                            key={pg.id}
                            className={`flex items-center group max-w-[160px] border-r border-gray-200 dark:border-gray-700 ${
                                activePlaygroundId === pg.id ? 'bg-white dark:bg-gray-900' : 'opacity-80 hover:opacity-100'
                            }`}
                        >
                            <button
                                onClick={() => setActivePlaygroundId(pg.id)}
                                className={`px-3 py-2 text-xs truncate flex-1 text-left flex items-center gap-2 ${
                                    activePlaygroundId === pg.id ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
                                }`}
                            >
                                {pg.status === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                {pg.description}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseItem(pg.id);
                                }}
                                className="p-1 mx-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activePlayground ? (
                <Playground code={activePlayground} onClose={onClose} onRetry={onRetry} onTestComplete={onTestComplete} />
            ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <p className="text-gray-400 mb-4">No active app selected.</p>
                    <LoadingTip className="max-w-xs" />
                </div>
            )}
        </div>
    );
};
