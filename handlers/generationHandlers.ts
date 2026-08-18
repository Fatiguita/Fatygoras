import { Tab } from '../appConstants';
import { GeminiModel, WhiteboardData, PlaygroundCode, CourseLevel } from '../types';
import {
    analyzeTopic,
    generateWhiteboardBatch,
    generatePlayground,
    generateSyllabus,
    generateProjectRoadmap,
    analyzeImageWithContext
} from '../services/geminiService';

export const createGenerationHandlers = (
    apiKey: string,
    model: GeminiModel,
    input: string,
    whiteboards: WhiteboardData[],
    playgrounds: PlaygroundCode[],
    syllabusGallery: any[],
    setInput: (input: string) => void,
    setIsGenerating: (loading: boolean) => void,
    setActiveTab: (tab: Tab) => void,
    setWhiteboards: (wbs: WhiteboardData[] | ((prev: WhiteboardData[]) => WhiteboardData[])) => void,
    setPlaygroundPanelOpen: (open: boolean) => void,
    setActivePlaygroundTab: (tab: 'practice' | 'test') => void,
    setPlaygrounds: (pgs: PlaygroundCode[] | ((prev: PlaygroundCode[]) => PlaygroundCode[])) => void,
    setActivePlaygroundId: (id: string | null) => void,
    setIsGeneratingSyllabus: (loading: boolean) => void,
    setSyllabusGallery: (gallery: any[] | ((prev: any[]) => any[])) => void,
    setIsChatOpen: (open: boolean) => void,
    setChatHistory: (history: any[] | ((prev: any[]) => any[])) => void,
    setIsRefining: (refining: boolean) => void,
    addLog: (entry: any) => void,
    activeDocText: string,
    activeDocName: string
) => {
    const handleGenerate = async (topicOverride?: string | any, mainTopicContext?: string) => {
        // --- CRITICAL DEFENSIVE CHECK ---
        // Option: Directly parse optional arguments.
        // Alternative Selected: Because React's standard onClick button handlers pass a synthetic MouseEvent 
        // as the first parameter if not wrapped, we strictly verify that topicOverride is a string before proceeding.
        const actualTopicOverride = typeof topicOverride === 'string' ? topicOverride : undefined;

        const docContext = activeDocText ? `[REFERENCE FILE CONTEXT: ${activeDocName}]\n${activeDocText}\n\n` : '';
        const topicToUse = docContext + (actualTopicOverride || input);
        const effectiveMainTopic = mainTopicContext || (actualTopicOverride ? undefined : input);

        if (!(actualTopicOverride || input).trim() || !apiKey) {
            if (!apiKey) alert("Please enter a Gemini API Key.");
            return;
        }

        setIsGenerating(true);
        setActiveTab(Tab.CLASSROOM);

        try {
            const analysis = await analyzeTopic(apiKey, topicToUse, model, addLog, effectiveMainTopic);
            const topicsToCover = analysis.isAbstract ? analysis.topics : [actualTopicOverride || input];
            const CHUNK_SIZE = 4;
            let previousContext = whiteboards.slice(0, 2).map(w => w.topic).join(", ");

            for (let i = 0; i < topicsToCover.length; i += CHUNK_SIZE) {
                const chunk = topicsToCover.slice(i, i + CHUNK_SIZE);
                const batchResults = await generateWhiteboardBatch(apiKey, chunk, previousContext, model, effectiveMainTopic || (actualTopicOverride || input), addLog);
                previousContext = batchResults.map(b => b.topic).join(", ");

                const newWhiteboards: WhiteboardData[] = batchResults.map(item => ({
                    id: Date.now().toString() + Math.random(),
                    topic: item.topic,
                    svgContent: item.svg,
                    explanation: item.explanation,
                    timestamp: Date.now(),
                    audioSensitivity: analysis.audioSensitivity
                }));

                setWhiteboards(prev => [...newWhiteboards.reverse(), ...prev]);
            }
            if (!actualTopicOverride) setInput('');
        } catch (error) {
            console.error(error);
            alert("Generation failed.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLaunchPlayground = async (topic: string) => {
        if (!apiKey) { alert("Please enter API Key"); return; }

        setPlaygroundPanelOpen(true);
        setActivePlaygroundTab('practice');

        const existing = playgrounds.find(p => p.description.includes(topic) && p.type === 'practice');
        if (existing) {
            setActivePlaygroundId(existing.id);
            return;
        }

        // Find Related SVG content
        const relatedWB = whiteboards.find(w => w.topic === topic);
        const mainTopicContext = relatedWB ? relatedWB.explanation.substring(0, 50) + "..." : input;

        const tempId = Date.now().toString();
        const placeholder: PlaygroundCode = {
            id: tempId,
            html: '',
            description: topic,
            timestamp: Date.now(),
            status: 'loading',
            type: 'practice',
            model: model
        };

        setPlaygrounds(prev => [...prev, placeholder]);
        setActivePlaygroundId(tempId);

        try {
            const codeData = await generatePlayground(
                apiKey,
                topic,
                model,
                addLog,
                relatedWB?.svgContent,
                mainTopicContext
            );
            setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...codeData, status: 'ready', id: tempId, type: 'practice', model: model } : p));
        } catch (error) {
            setPlaygrounds(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error' } : p));
        }
    };

    const handleGenerateSyllabus = async (topic: string, level: CourseLevel, description?: string) => {
        if (!apiKey) { alert("Please enter API Key"); return; }
        setIsGeneratingSyllabus(true);
        const normalizedTopic = topic.trim().toLowerCase();
        const relatedSyllabi = syllabusGallery.filter(s => s.topic.toLowerCase().includes(normalizedTopic));
        let context = '';
        if (relatedSyllabi.length > 0) {
            context = `Existing courses:\n` + relatedSyllabi.map(s => `- ${s.level} (${s.topic}): ${s.concepts.join(', ')}`).join('\n');
        }
        if (activeDocText) {
            context = `[SOURCE REFERENCE DOCUMENT: ${activeDocName}]\n${activeDocText}\n\n` + context;
        }

        try {
            const result = await generateSyllabus(apiKey, topic, level, model, addLog, context, description);
            const newSyllabus: any = { ...result, id: Date.now().toString(), timestamp: Date.now() };
            setSyllabusGallery(prev => [newSyllabus, ...prev]);
        } catch (e) { console.error(e); } finally { setIsGeneratingSyllabus(false); }
    };

    const handleGenerateProjectRoadmap = async (project: string, stack: string) => {
        if (!apiKey) { alert("Please enter API Key"); return; }
        setIsGeneratingSyllabus(true);
        try {
            const roadmap = await generateProjectRoadmap(apiKey, project, stack, model, addLog);
            const timestamp = Date.now();
            const newSyllabi = roadmap.map((item, idx) => ({
                ...item,
                id: (timestamp + idx).toString(),
                timestamp: timestamp
            }));
            
            setSyllabusGallery(prev => [...newSyllabi, ...prev]);
        } catch (e) {
             console.error(e);
             alert("Failed to architect project.");
        } finally {
            setIsGeneratingSyllabus(false);
        }
    };

    const handleWhiteboardRefine = async (base64Image: string, prompt: string): Promise<void> => {
        setIsRefining(true);
        setIsChatOpen(true);
        try {
            const response = await analyzeImageWithContext(apiKey, base64Image, prompt, model, addLog);
            setChatHistory(prev => [...prev,
            { id: Date.now().toString(), role: 'user', content: `[Image Analysis]: ${prompt}`, timestamp: Date.now() },
            { id: (Date.now() + 1).toString(), role: 'model', content: response, timestamp: Date.now() }
            ]);
        } catch (e) { console.error(e); } finally { setIsRefining(false); }
    };

    return { handleGenerate, handleLaunchPlayground, handleGenerateSyllabus, handleGenerateProjectRoadmap, handleWhiteboardRefine };
};