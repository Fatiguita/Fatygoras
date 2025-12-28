import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PlaygroundCode, Logger, SyllabusData } from '../types';
import { 
  ANALYSIS_SYSTEM_PROMPT, 
  BATCH_TEACHER_SYSTEM_PROMPT, 
  PLAYGROUND_SYSTEM_PROMPT, 
  CHATBOT_SYSTEM_PROMPT, 
  SYLLABUS_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
  QUIZ_DB_SYSTEM_PROMPT,
  LEVEL_TEST_PLAYGROUND_PROMPT
} from './prompts';

const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const analyzeTopic = async (apiKey: string, topic: string, modelId: string, logger?: Logger): Promise<AnalysisResult> => {
  if (logger) logger({ type: 'info', source: 'analyzeTopic', summary: `Starting analysis for: "${topic}"` });
  const ai = getClient(apiKey);
  
  try {
    const config = {
      systemInstruction: ANALYSIS_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAbstract: { type: Type.BOOLEAN },
          topics: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["isAbstract", "topics"]
      }
    };

    if (logger) logger({ 
      type: 'request', 
      source: 'analyzeTopic', 
      summary: 'Sending generation request', 
      details: { model: modelId, contents: topic, config } 
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: topic,
      config: config
    });

    const text = response.text;
    
    if (logger) logger({ 
      type: 'response', 
      source: 'analyzeTopic', 
      summary: 'Received response', 
      details: { text, candidates: response.candidates } 
    });

    if (!text) throw new Error("No response from analysis model");
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    if (logger) logger({ 
      type: 'error', 
      source: 'analyzeTopic', 
      summary: 'Analysis failed', 
      details: error 
    });
    console.error("Analysis failed:", error);
    return { isAbstract: false, topics: [topic] };
  }
};

export const generateWhiteboardBatch = async (
  apiKey: string, 
  topics: string[], 
  previousContext: string,
  modelId: string, 
  logger?: Logger
): Promise<Array<{ topic: string, svg: string, explanation: string }>> => {
  const ai = getClient(apiKey);
  
  const prompt = `
    Please generate teaching materials for the following topics: ${JSON.stringify(topics)}.
    
    ${previousContext ? `\nCONTEXT FROM PREVIOUS RELATED TOPICS:\n${previousContext}\n` : ''}

    Ensure each topic has a unique SVG whiteboard and a detailed explanation following the word counting rules.
  `;
  
  if (logger) logger({ 
    type: 'request', 
    source: 'generateWhiteboardBatch', 
    summary: `Generating batch for ${topics.length} topics`, 
    details: { model: modelId, topics, promptContent: prompt } 
  });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: BATCH_TEACHER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              svg: { type: Type.STRING, description: "Raw SVG code for the whiteboard. Do not use markdown." },
              explanation: { type: Type.STRING, description: "Detailed explanation with word counts per line." }
            },
            required: ["topic", "svg", "explanation"]
          }
        }
      }
    });

    const fullText = response.text || "[]";

    if (logger) logger({ 
      type: 'response', 
      source: 'generateWhiteboardBatch', 
      summary: 'Received batch response', 
      details: { 
          fullText: fullText.substring(0, 500) + "... (truncated)", // Truncate for UI performance but show start
          itemsCount: JSON.parse(fullText).length 
      } 
    });
    
    return JSON.parse(fullText);
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'generateWhiteboardBatch', summary: 'Batch generation failed', details: error });
    throw error;
  }
};

export const generatePlayground = async (apiKey: string, topic: string, modelId: string, logger?: Logger): Promise<Omit<PlaygroundCode, 'status'>> => {
  const ai = getClient(apiKey);
  const prompt = `Create a practice playground for: ${topic}`;

  if (logger) logger({ 
    type: 'request', 
    source: 'generatePlayground', 
    summary: 'Generating interactive playground', 
    details: { model: modelId, prompt } 
  });
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: PLAYGROUND_SYSTEM_PROMPT,
      }
    });

    const fullText = response.text || "";
    
    if (logger) logger({ 
      type: 'response', 
      source: 'generatePlayground', 
      summary: 'Received playground code', 
      details: { fullText: fullText } 
    });

    const htmlMatch = fullText.match(/```html\n([\s\S]*?)\n```/);
    const html = htmlMatch ? htmlMatch[1] : "<h1>Error generating playground</h1>";

    return {
      id: Date.now().toString(),
      html,
      description: `Playground: ${topic}`,
      timestamp: Date.now(),
      type: 'practice'
    };
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'generatePlayground', summary: 'Playground generation failed', details: error });
    throw error;
  }
};

export const generateSyllabus = async (
  apiKey: string, 
  topic: string, 
  level: string, 
  modelId: string, 
  logger?: Logger,
  context?: string
): Promise<SyllabusData> => {
  const ai = getClient(apiKey);
  
  if (logger) logger({ type: 'request', source: 'generateSyllabus', summary: `Generating syllabus for ${topic} at ${level}`, details: { context } });

  try {
    const prompt = `Create a syllabus for: ${topic}. Level: ${level}.${context ? `\n\nCONTEXT FROM OTHER LEVELS:\n${context}` : ''}`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SYLLABUS_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    if (logger) logger({ type: 'response', source: 'generateSyllabus', summary: 'Syllabus generated', details: { text } });
    
    return JSON.parse(text) as SyllabusData;
  } catch (error) {
    console.error("Syllabus generation failed", error);
    throw error;
  }
};

export const generateQuizDatabase = async (
    apiKey: string,
    topic: string,
    syllabiContext: string,
    modelId: string,
    logger?: Logger
): Promise<string> => {
    const ai = getClient(apiKey);

    if (logger) logger({ 
        type: 'request', 
        source: 'generateQuizDatabase', 
        summary: `Generating comprehensive quiz DB for ${topic}`,
        details: { syllabiContextLength: syllabiContext.length }
    });

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Generate a quiz database for topic: ${topic}. \n\nSYLLABI CONTEXT:\n${syllabiContext}`,
            config: {
                systemInstruction: QUIZ_DB_SYSTEM_PROMPT,
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text || "{}";
        if (logger) logger({ type: 'response', source: 'generateQuizDatabase', summary: 'Quiz DB generated', details: { text } });
        return text;
    } catch (error) {
        if (logger) logger({ type: 'error', source: 'generateQuizDatabase', summary: 'Quiz DB gen failed', details: error });
        throw error;
    }
};

export const generateLevelTestPlayground = async (
    apiKey: string,
    topic: string,
    quizJson: string,
    modelId: string,
    logger?: Logger
): Promise<Omit<PlaygroundCode, 'status'>> => {
    const ai = getClient(apiKey);

    if (logger) logger({ 
        type: 'request', 
        source: 'generateLevelTestPlayground', 
        summary: `Generating Level Test App`,
        details: { quizJsonLength: quizJson.length }
    });

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: `Create a Level Test App for ${topic}. \n\nHere is the question database to embed:\n${quizJson}`,
            config: {
                systemInstruction: LEVEL_TEST_PLAYGROUND_PROMPT
            }
        });

        const fullText = response.text || "";
        const htmlMatch = fullText.match(/```html\n([\s\S]*?)\n```/);
        const html = htmlMatch ? htmlMatch[1] : "<h1>Error generating test</h1>";
        
        if (logger) logger({ type: 'response', source: 'generateLevelTestPlayground', summary: 'Test Playground generated', details: { fullText } });

        return {
            id: Date.now().toString(),
            html,
            description: `Level Test: ${topic}`,
            timestamp: Date.now(),
            type: 'test'
        };
    } catch (error) {
        if (logger) logger({ type: 'error', source: 'generateLevelTestPlayground', summary: 'Test Playground gen failed', details: error });
        throw error;
    }
};

export const analyzeImageWithContext = async (
  apiKey: string, 
  base64Image: string, 
  promptText: string, 
  modelId: string, 
  logger?: Logger
): Promise<string> => {
  const ai = getClient(apiKey);
  
  // Use a vision-capable model (Gemini 2.5/3.0 Pro usually supports this)
  const visionModel = modelId.includes('flash') ? 'gemini-2.5-flash' : 'gemini-3-flash-preview'; 

  if (logger) logger({ type: 'request', source: 'analyzeImageWithContext', summary: 'Sending visual analysis request' });

  try {
    const response = await ai.models.generateContent({
      model: visionModel,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: promptText }
        ]
      },
      config: {
        systemInstruction: VISION_SYSTEM_PROMPT
      }
    });

    const text = response.text || "I couldn't analyze the image.";
    if (logger) logger({ type: 'response', source: 'analyzeImageWithContext', summary: 'Received analysis', details: { text } });
    return text;
  } catch (error) {
    console.error("Image analysis failed", error);
    throw error;
  }
};

export const sendChatMessage = async (
  apiKey: string, 
  history: {role: string, content: string}[], 
  message: string, 
  context: string, 
  modelId: string, 
  logger?: Logger
) => {
  const ai = getClient(apiKey);
  
  const systemPromptWithContext = `${CHATBOT_SYSTEM_PROMPT}\n\nCURRENT APP CONTEXT:\n${context}`;

  if (logger) logger({ 
    type: 'request', 
    source: 'sendChatMessage', 
    summary: 'Sending chat message with context', 
    details: { model: modelId, message, contextLength: context.length } 
  });

  try {
    const chat = ai.chats.create({
      model: modelId,
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }]
      })),
      config: {
        systemInstruction: systemPromptWithContext
      }
    });

    const result = await chat.sendMessage({ message });
    const text = result.text || "";

    if (logger) logger({ type: 'response', source: 'sendChatMessage', summary: 'Received chat response', details: { text } });

    return text;
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'sendChatMessage', summary: 'Chat failed', details: error });
    throw error;
  }
};