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

const SkillRadar: React.FC<{ skills: Record<string, number> }> = ({ skills }) => {
    if (!skills || Object.keys(skills).length === 0) return null;

    const keys = Object.keys(skills);
    const count = keys.length;
    const center = 100;
    const radius = 80;
    const angleSlice = (Math.PI * 2) / count;

    // Helper to get coords
    const getCoords = (value: number, index: number) => {
        const angle = index * angleSlice - Math.PI / 2; // Start at top
        const r = (value / 100) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle)
        };
    };

    // Build the filled polygon path based on data
    const polygonPoints = keys.map((key, i) => {
        const { x, y } = getCoords(skills[key], i);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative w-full max-w-[240px] aspect-square mx-auto">
            <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Background Web */}
                {[0.25, 0.5, 0.75, 1].map((scale, sIdx) => (
                    <polygon
                        key={sIdx}
                        points={keys.map((_, i) => {
                            const { x, y } = getCoords(100 * scale, i);
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="currentColor"
                        className="text-gray-200 dark:text-gray-700"
                        strokeWidth="1"
                    />
                ))}
                
                {/* Axes */}
                {keys.map((_, i) => {
                    const { x, y } = getCoords(100, i);
                    return (
                        <line 
                            key={i} 
                            x1={center} y1={center} 
                            x2={x} y2={y} 
                            stroke="currentColor" 
                            className="text-gray-200 dark:text-gray-700" 
                            strokeWidth="1" 
                        />
                    );
                })}

                {/* Data Polygon */}
                <polygon 
                    points={polygonPoints} 
                    fill="rgba(249, 115, 22, 0.2)" 
                    stroke="#f97316" 
                    strokeWidth="2" 
                />

                {/* Data Points */}
                {keys.map((key, i) => {
                    const { x, y } = getCoords(skills[key], i);
                    return (
                        <circle key={i} cx={x} cy={y} r="3" className="fill-orange-500" />
                    );
                })}

                {/* Labels */}
                {keys.map((key, i) => {
                    // Push labels out slightly further than radius
                    const angle = i * angleSlice - Math.PI / 2;
                    const labelR = radius + 15;
                    const x = center + labelR * Math.cos(angle);
                    const y = center + labelR * Math.sin(angle);
                    
                    return (
                        <text 
                            key={i} 
                            x={x} y={y} 
                            textAnchor="middle" 
                            dominantBaseline="middle" 
                            className="text-[10px] fill-gray-500 uppercase font-bold"
                        >
                            {key}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
};

const LevelTest: React.FC<LevelTestProps> = ({ onStartTest, isGenerating, results }) => {
    const [topic, setTopic] = useState('');
    const [selectedModel, setSelectedModel] = useState<GeminiModel>(DEFAULT_MODEL);
    const [testMode, setTestMode] = useState<'comprehensive' | 'specific'>('comprehensive');
    const [specificLevel, setSpecificLevel] = useState<CourseLevel>('Intermediate');
    const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

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
                            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                                {results.slice().reverse().map(res => {
                                    const isExpanded = expandedResultId === res.id;
                                    return (
                                        <div key={res.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <div 
                                                className="p-4 cursor-pointer"
                                                onClick={() => setExpandedResultId(isExpanded ? null : res.id)}
                                            >
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-400 text-xs">Score: {res.score}/{res.maxScore}</span>
                                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Expanded Details - Skill Radar */}
                                            {isExpanded && res.skillBreakdown && Object.keys(res.skillBreakdown).length > 0 && (
                                                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                                    <div className="pt-4 text-center">
                                                        <h5 className="text-xs font-bold uppercase text-gray-500 mb-2">Cognitive Skill Profile</h5>
                                                        <SkillRadar skills={res.skillBreakdown} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
