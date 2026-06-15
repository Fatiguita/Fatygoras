import { GeminiModel, PlaygroundCode, CourseLevel, SyllabusData, TestResult } from '../types';
import {
    generateSyllabus,
    generateQuizDatabase,
    generateLevelTestPlayground,
    generatePlayground
} from '../services/geminiService';

export const createPlaygroundHandlers = (
    apiKey: string,
    model: GeminiModel,
    playgrounds: PlaygroundCode[],
    whiteboards: any[],
    input: string,
    syllabusGallery: SyllabusData[],
    activePlaygroundId: string | null,
    setPlaygrounds: (pgs: PlaygroundCode[] | ((prev: PlaygroundCode[]) => PlaygroundCode[])) => void,
    setActivePlaygroundId: (id: string | null) => void,
    setPlaygroundPanelOpen: (open: boolean) => void,
    setActivePlaygroundTab: (tab: 'practice' | 'test') => void,
    setIsGeneratingTest: (loading: boolean) => void,
    setSyllabusGallery: (gallery: SyllabusData[] | ((prev: SyllabusData[]) => SyllabusData[])) => void,
    setTestResults: (results: TestResult[] | ((prev: TestResult[]) => TestResult[])) => void,
    setRemediationQueue: (queue: string[]) => void,
    setShowRemediationToast: (show: boolean) => void,
    addLog: (entry: any) => void
) => {
    const closePlayground = (id: string) => {
        setPlaygrounds(prev => prev.filter(p => p.id !== id));
        if (activePlaygroundId === id) setActivePlaygroundId(null);
    };

    const handleCreateLevelTest = async (topic: string, selectedModel: GeminiModel, specificLevel?: CourseLevel) => {
        if (!apiKey) { alert("Please enter API Key"); return; }
        setIsGeneratingTest(true);
        setPlaygroundPanelOpen(true);
        setActivePlaygroundTab('test');

        const tempId = Date.now().toString();
        const description = specificLevel 
            ? `Test: ${topic} (${specificLevel})`
            : `Test: ${topic}`;

        const placeholder: PlaygroundCode = {
            id: tempId,
            html: '',
            description,
            timestamp: Date.now(),
            status: 'loading',
            type: 'test',
            relatedTopic: topic,
            model: selectedModel
        };

        setPlaygrounds(prev => [...prev, placeholder]);
        setActivePlaygroundId(tempId);

        try {
            const levels: CourseLevel[] = specificLevel ? [specificLevel] : ['Introduction', 'Beginner', 'Intermediate', 'Advanced', 'Master'];
            let accumulatedSyllabusContext = "";

            for (const level of levels) {
                const existingSyllabus = syllabusGallery.find(s =>
                    s.topic.trim().toLowerCase() === topic.trim().toLowerCase() &&
                    s.level === level
                );

                if (existingSyllabus) {
                    accumulatedSyllabusContext += JSON.stringify(existingSyllabus) + "\n";
                    addLog({ type: 'info', source: 'LevelTest', summary: `Using existing syllabus for ${level}`, details: existingSyllabus });
                } else {
                    const s = await generateSyllabus(apiKey, topic, level, selectedModel, addLog, accumulatedSyllabusContext);
                    accumulatedSyllabusContext += JSON.stringify(s) + "\n";
                    setSyllabusGallery(prev => [{ ...s, id: Date.now().toString() + Math.random() }, ...prev]);
                }
            }

            const quizDbJson = await generateQuizDatabase(apiKey, topic, accumulatedSyllabusContext, selectedModel, addLog, specificLevel);
            const testApp = await generateLevelTestPlayground(
                apiKey,
                topic,
                quizDbJson,
                selectedModel,
                addLog,
                topic,
                specificLevel
            );

            setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...testApp, status: 'ready', id: tempId, type: 'test', relatedTopic: topic, model: selectedModel } : p));

            setTestResults(prev => [...prev, {
                id: tempId,
                topic: topic,
                levelAssigned: 'Pending',
                score: 0,
                maxScore: 0,
                timestamp: Date.now(),
                type: specificLevel ? 'single_level' : 'comprehensive',
                targetLevel: specificLevel
            }]);

        } catch (error) {
            console.error(error);
            setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error' } : p));
            alert("Failed to generate level test. Please try again.");
        } finally {
            setIsGeneratingTest(false);
        }
    };

    const handleTestComplete = (data: any) => {
        setTestResults(prev => prev.map(res => {
            if (res.id === data.testId) {
                return {
                    ...res,
                    levelAssigned: data.level || 'Unknown',
                    score: data.score || 0,
                    maxScore: data.maxScore || 0,
                    failedConcepts: data.failedConcepts || [],
                    skillBreakdown: data.skillBreakdown || {}
                };
            }
            return res;
        }));

        if (data.failedConcepts && Array.isArray(data.failedConcepts) && data.failedConcepts.length > 0) {
            setRemediationQueue(data.failedConcepts);
            setShowRemediationToast(true);
        }

        addLog({ type: 'info', source: 'LevelTest', summary: 'Received test results', details: data });
    };

    const handleRetryPlayground = async () => {
        if (!activePlaygroundId || !apiKey) return;
        const pg = playgrounds.find(p => p.id === activePlaygroundId);
        if (!pg) return;

        const modelToUse = pg.model || model;

        if (pg.type === 'test') {
            const topic = pg.relatedTopic || pg.description.replace('Test: ', '').replace(/\s\(.*\)$/, '');
            const levelMatch = pg.description.match(/\((.*?)\)$/);
            const level = levelMatch ? levelMatch[1] as CourseLevel : undefined;

            closePlayground(pg.id);
            handleCreateLevelTest(topic, modelToUse, level);
            return;
        }

        setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...p, status: 'loading' } : p));
        try {
            const topic = pg.description.replace('Playground: ', '');
            const relatedWB = whiteboards.find(w => w.topic === topic);
            const mainTopicContext = relatedWB ? relatedWB.explanation.substring(0, 50) + "..." : input;

            const codeData = await generatePlayground(
                apiKey,
                topic,
                modelToUse,
                addLog,
                relatedWB?.svgContent,
                mainTopicContext
            );
            setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...codeData, status: 'ready', id: pg.id, type: 'practice', model: modelToUse } : p));
        } catch (e) {
            setPlaygrounds(prev => prev.map(p => p.id === pg.id ? { ...p, status: 'error' } : p));
        }
    };

    return { handleCreateLevelTest, handleTestComplete, handleRetryPlayground, closePlayground };
};
