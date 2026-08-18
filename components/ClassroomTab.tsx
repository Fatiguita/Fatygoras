import React from 'react';
import Whiteboard from './Whiteboard';
import Button from './Button';
import LoadingTip from './LoadingTip';
import { WhiteboardData } from '../types';
import { storeActiveDocument } from '../services/autoSaveService';

interface ClassroomTabProps {
    input: string;
    setInput: (input: string) => void;
    isGenerating: boolean;
    whiteboards: WhiteboardData[];
    isRefining: boolean;
    onGenerate: () => void;
    onLaunchPlayground: (topic: string) => void;
    onWhiteboardRefine: (base64Image: string, prompt: string) => Promise<void>;
    // Dynamic Context props
    activeDocText: string;
    setActiveDocText: (text: string) => void;
    activeDocName: string;
    setActiveDocName: (name: string) => void;
}

export const ClassroomTab: React.FC<ClassroomTabProps> = ({
    input,
    setInput,
    isGenerating,
    whiteboards,
    isRefining,
    onGenerate,
    onLaunchPlayground,
    onWhiteboardRefine,
    activeDocText,
    setActiveDocText,
    activeDocName,
    setActiveDocName
}) => {
    return (
        <>
            {/* Optional Document / Pasting Context */}
            <div className="bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-gray-200 dark:border-gray-700 mb-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    📂 Reference Source Material (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors relative cursor-pointer">
                        <input 
                            type="file" 
                            accept=".txt,.md,.csv,.json"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const text = await file.text();
                                    setActiveDocName(file.name);
                                    setActiveDocText(text);
                                    await storeActiveDocument(file.name, text);
                                }
                            }}
                        />
                        <span className="text-2xl mb-1">📄</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {activeDocName ? `Loaded: ${activeDocName}` : 'Upload plain text file (.txt, .md)'}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <textarea
                            placeholder="Paste custom learning contexts, specific syllabus instructions, or textbook references to focus the AI..."
                            value={activeDocText}
                            onChange={async (e) => {
                                const text = e.target.value;
                                const name = text ? 'Pasted Context' : '';
                                setActiveDocName(name);
                                setActiveDocText(text);
                                await storeActiveDocument(name, text);
                            }}
                            className="w-full h-24 p-2 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-900 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 resize-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
                        />
                        {activeDocText && (
                            <button 
                                onClick={async () => {
                                    setActiveDocText('');
                                    setActiveDocName('');
                                    await storeActiveDocument('', '');
                                }}
                                className="text-[10px] text-red-500 text-right mt-1 hover:underline cursor-pointer"
                            >
                                Clear reference context
                            </button>
                        )}
                    </div>
                </div>
            </div>

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
                            {/* --- WRAPPER FIX: Wrapped in an anonymous arrow function to prevent the click event from being processed as a topicOverride string --- */}
                            <Button onClick={() => onGenerate()} disabled={isGenerating || !input.trim()} size="md">
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