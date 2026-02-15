import React, { useState } from 'react';
import Button from './Button';
import Select from './Select';
import { TestResult, GeminiModel, CourseLevel } from '../types';
import { MODEL_OPTIONS, DEFAULT_MODEL } from '../constants';

interface LevelTestProps {
    onStartTest: (topic: string, model: GeminiModel, specificLevel?: CourseLevel) => void;
    isGenerating: boolean;
    results: TestResult[];
}

const LevelTest: React.FC<LevelTestProps> = ({ onStartTest, isGenerating, results }) => {
    const [topic, setTopic] = useState('');
    const [selectedModel, setSelectedModel] = useState<GeminiModel>(DEFAULT_MODEL);
    const [testMode, setTestMode] = useState<'comprehensive' | 'specific'>('comprehensive');
    const [specificLevel, setSpecificLevel] = useState<CourseLevel>('Intermediate');

    const LEVEL_OPTIONS: { label: string; value: CourseLevel }[] = [
        { label: 'Introduction', value: 'Introduction' },
        { label: 'Beginner', value: 'Beginner' },
        { label: 'Intermediate', value: 'Intermediate' },
        { label: 'Advanced', value: 'Advanced' },
        { label: 'Master', value: 'Master' },
    ];

    // Group results by topic for chart visualization
    const chartData = results.reduce((acc, curr) => {
        if (!acc[curr.topic]) acc[curr.topic] = [];
        acc[curr.topic].push(curr);
        return acc;
    }, {} as Record<string, TestResult[]>);

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-20">
            <div className="text-center py-8">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600">
                    Competency Level Test
                </h2>
                <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
                    Challenge yourself! Take a full curriculum exam to find your placement, or practice a specific difficulty level.
                </p>

                <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col gap-4">
                        
                        {/* Mode Switcher */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button
                                onClick={() => setTestMode('comprehensive')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-semibold transition-all ${
                                    testMode === 'comprehensive' 
                                    ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                Full Assessment
                            </button>
                            <button
                                onClick={() => setTestMode('specific')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-semibold transition-all ${
                                    testMode === 'specific' 
                                    ? 'bg-white dark:bg-gray-600 text-orange-600 dark:text-orange-400 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                            >
                                Specific Level
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-[2]">
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="Enter topic (e.g. Biology, Java)..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                    disabled={isGenerating}
                                />
                            </div>
                            
                            {/* Model Select */}
                            <div className={`flex-1 min-w-[160px] ${testMode === 'specific' ? 'hidden sm:block' : ''}`}>
                                <Select
                                    options={MODEL_OPTIONS}
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                                    className="h-full py-3"
                                    disabled={isGenerating}
                                />
                            </div>
                        </div>

                        {/* Level Select (Conditional) */}
                        {testMode === 'specific' && (
                            <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
                                <div className="flex-1">
                                    <Select
                                        label="Target Level"
                                        options={LEVEL_OPTIONS}
                                        value={specificLevel}
                                        onChange={(e) => setSpecificLevel(e.target.value as CourseLevel)}
                                        className="py-3"
                                        disabled={isGenerating}
                                    />
                                </div>
                                <div className="flex-1 sm:hidden">
                                     <Select
                                        label="AI Model"
                                        options={MODEL_OPTIONS}
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                                        className="h-full py-3"
                                        disabled={isGenerating}
                                    />
                                </div>
                            </div>
                        )}

                        <Button 
                            onClick={() => onStartTest(topic, selectedModel, testMode === 'specific' ? specificLevel : undefined)} 
                            disabled={isGenerating || !topic.trim()} 
                            className="w-full bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
                        >
                            {isGenerating 
                                ? 'Analyzing & Building Exam...' 
                                : testMode === 'specific' 
                                    ? `Start ${specificLevel} Exam` 
                                    : 'Start Full Assessment'
                            }
                        </Button>
                        
                        {isGenerating && (
                            <p className="text-xs text-gray-500 animate-pulse">
                                {testMode === 'comprehensive' 
                                    ? "Generating 5 syllabi and a progressive quiz database..." 
                                    : `Focusing specifically on ${specificLevel} content...`
                                }
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Records Section */}
            {results.length > 0 && (
                <div className="mt-12 animate-fade-in">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
                        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Student Record
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* History List */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm">
                                Recent Attempts
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto">
                                {results.slice().reverse().map(res => (
                                    <div key={res.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{res.topic}</span>
                                            <span className="text-xs text-gray-400">{new Date(res.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                {res.type === 'single_level' && (
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] uppercase font-bold">
                                                        {res.targetLevel}
                                                    </span>
                                                )}
                                                <span className="text-gray-600 dark:text-gray-400">Result: <span className="text-orange-500 font-semibold">{res.levelAssigned}</span></span>
                                            </div>
                                            {res.maxScore > 0 && (
                                                <span className="text-gray-400 text-xs">Score: {res.score}/{res.maxScore}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Simple Progress Visualization */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-center">
                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-4">Topic Mastery Frequency</h4>
                            <div className="flex items-end gap-4 h-[200px] w-full overflow-x-auto">
                                {Object.entries(chartData).map(([t, items]) => {
                                    const height = Math.min(100, items.length * 20); // Scale height
                                    return (
                                        <div key={t} className="flex flex-col items-center gap-2 group min-w-[60px]">
                                            <div className="text-xs font-bold text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">{items.length}</div>
                                            <div 
                                                className="w-12 bg-gradient-to-t from-orange-500 to-yellow-400 rounded-t-md transition-all duration-500"
                                                style={{ height: `${height}%` }}
                                            />
                                            <div className="text-[10px] text-gray-500 text-center truncate w-16" title={t}>{t}</div>
                                        </div>
                                    );
                                })}
                                {Object.keys(chartData).length === 0 && (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                        No data to chart yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LevelTest;
