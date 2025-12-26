import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PlaygroundCode, Logger, SyllabusData } from '../types';
import { 
  ANALYSIS_SYSTEM_PROMPT, 
  BATCH_TEACHER_SYSTEM_PROMPT, 
  PLAYGROUND_SYSTEM_PROMPT, 
  CHATBOT_SYSTEM_PROMPT,
  SYLLABUS_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT
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
    details: { model: modelId, topics, hasContext: !!previousContext } 
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
      details: { length: fullText.length } 
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
      details: { length: fullText.length } 
    });

    const htmlMatch = fullText.match(/```html\n([\s\S]*?)\n```/);
    const html = htmlMatch ? htmlMatch[1] : "<h1>Error generating playground</h1>";

    return {
      id: Date.now().toString(),
      html,
      description: `Playground: ${topic}`,
      timestamp: Date.now()
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
  
  if (logger) logger({ type: 'request', source: 'generateSyllabus', summary: `Generating syllabus for ${topic} at ${level}` });

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
    if (logger) logger({ type: 'response', source: 'generateSyllabus', summary: 'Syllabus generated' });
    
    return JSON.parse(text) as SyllabusData;
  } catch (error) {
    console.error("Syllabus generation failed", error);
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

    if (logger) logger({ type: 'response', source: 'analyzeImageWithContext', summary: 'Received analysis' });
    return response.text || "I couldn't analyze the image.";
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

    if (logger) logger({ type: 'response', source: 'sendChatMessage', summary: 'Received chat response' });

    return text;
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'sendChatMessage', summary: 'Chat failed', details: error });
    throw error;
  }
};