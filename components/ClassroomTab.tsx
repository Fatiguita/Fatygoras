import React from 'react';
import Whiteboard from './Whiteboard';
import Button from './Button';
import LoadingTip from './LoadingTip';
import { WhiteboardData } from '../types';

interface ClassroomTabProps {
    input: string;
    setInput: (input: string) => void;
    isGenerating: boolean;
    whiteboards: WhiteboardData[];
    isRefining: boolean;
    onGenerate: () => void;
    onLaunchPlayground: (topic: string) => void;
    onWhiteboardRefine: (base64Image: string, prompt: string) => Promise<void>;
}

export const ClassroomTab: React.FC<ClassroomTabProps> = ({
    input,
    setInput,
    isGenerating,
    whiteboards,
    isRefining,
    onGenerate,
    onLaunchPlayground,
    onWhiteboardRefine
}) => {
    return (
        <>
            <div className="mb-12">
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">What would you like to learn today?</label>
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                    <div className="flex flex-col relative bg-white dark:bg-gray-900 transition-shadow shadow-inner">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Explain Quantum Physics..."
                            className="w-full h-32 p-4 bg-transparent border-none focus:ring-0 resize-none text-base sm:text-lg outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                            disabled={isGenerating}
                        />
                        <div className="flex justify-end p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                            <Button onClick={onGenerate} disabled={isGenerating || !input.trim()} size="md">
                                {isGenerating ? "Thinking..." : "Create Lesson"}
                            </Button>
                        </div>
                    </div>
                    {isGenerating && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                            <LoadingTip />
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-16">
                {whiteboards.length === 0 && !isGenerating && (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-xl font-medium">Classroom is empty.</p>
                    </div>
                )}
                {whiteboards.map((wb) => (
                    <div key={wb.id} className="relative">
                        <Whiteboard
                            topic={wb.topic}
                            svgContent={wb.svgContent}
                            explanation={wb.explanation}
                            audioSensitivity={wb.audioSensitivity}
                            onRefine={onWhiteboardRefine}
                            isRefining={isRefining}
                        />
                        <div className="mt-4 flex justify-end">
                            <Button variant="secondary" onClick={() => onLaunchPlayground(wb.topic)}>
                                Practice this Topic
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
