import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PlaygroundCode, Logger, SyllabusData, ChatMessage } from '../types';
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

export const analyzeTopic = async (
  apiKey: string, 
  topic: string, 
  modelId: string, 
  logger?: Logger,
  mainTopic?: string
): Promise<AnalysisResult> => {
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
          audioSensitivity: { type: Type.BOOLEAN },
          topics: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["isAbstract", "topics", "audioSensitivity"]
      }
    };

    const contentToSend = mainTopic && mainTopic !== topic
        ? `CONTEXT: The user is currently studying the course/subject "${mainTopic}".\nAnalyze this specific sub-topic request: "${topic}"`
        : topic;

    if (logger) logger({ 
      type: 'request', 
      source: 'analyzeTopic', 
      summary: 'Sending generation request', 
      details: { model: modelId, contents: contentToSend, config } 
    });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: contentToSend,
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
    const result = JSON.parse(text);
    
    return {
        isAbstract: result.isAbstract,
        topics: result.topics,
        audioSensitivity: result.audioSensitivity || false
    };

  } catch (error) {
    if (logger) logger({ type: 'error', source: 'analyzeTopic', summary: 'Analysis failed', details: error });
    console.error("Analysis failed:", error);
    return { isAbstract: false, topics: [topic], audioSensitivity: false };
  }
};

export const generateWhiteboardBatch = async (
  apiKey: string, 
  topics: string[], 
  previousContext: string,
  modelId: string, 
  mainTopic: string,
  logger?: Logger
): Promise<Array<{ topic: string, svg: string, explanation: string }>> => {
  const ai = getClient(apiKey);
  
  const prompt = `
    Context: The main subject the user is studying is "${mainTopic}".
    
    Please generate teaching materials for the following specific sub-topics: ${JSON.stringify(topics)}.
    
    ${previousContext ? `\nCONTEXT FROM PREVIOUS RELATED TOPICS:\n${previousContext}\n` : ''}

    Ensure each topic has a unique SVG whiteboard and a detailed explanation following the word counting rules.
    Ensure the visuals and explanation are deeply grounded in the main context of "${mainTopic}".
  `;
  
  if (logger) logger({ 
    type: 'request', 
    source: 'generateWhiteboardBatch', 
    summary: `Generating batch for ${topics.length} topics`, 
    details: { model: modelId, mainTopic, topics, promptContent: prompt } 
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
          fullText: fullText.substring(0, 500) + "... (truncated)", 
          itemsCount: JSON.parse(fullText).length 
      } 
    });
    
    return JSON.parse(fullText);
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'generateWhiteboardBatch', summary: 'Batch generation failed', details: error });
    throw error;
  }
};

export const generatePlayground = async (
  apiKey: string, 
  topic: string, 
  modelId: string, 
  logger?: Logger,
  whiteboardSvg?: string,
  mainTopic?: string
): Promise<Omit<PlaygroundCode, 'status'>> => {
  const ai = getClient(apiKey);
  
  let contextBlock = "";
  if (mainTopic) contextBlock += `\nMAIN COURSE CONTEXT: ${mainTopic}\n`;
  if (whiteboardSvg) contextBlock += `\nREFERENCE VISUAL (SVG Code) - Use this to style or structure the playground similarly:\n${whiteboardSvg}\n`;

  const prompt = `${contextBlock}\nCreate a practice playground for: ${topic}`;

  if (logger) logger({ 
    type: 'request', 
    source: 'generatePlayground', 
    summary: 'Generating interactive playground', 
    details: { model: modelId, prompt, hasSvg: !!whiteboardSvg } 
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
    logger?: Logger,
    mainTopic?: string
): Promise<Omit<PlaygroundCode, 'status'>> => {
    const ai = getClient(apiKey);
    
    const contextStr = mainTopic ? `COURSE CONTEXT: ${mainTopic}\n` : "";
    const contentToSend = `${contextStr}Create a Level Test App for ${topic}. \n\nHere is the question database to embed:\n${quizJson}`;

    if (logger) logger({ 
        type: 'request', 
        source: 'generateLevelTestPlayground', 
        summary: `Generating Level Test App`,
        details: { quizJsonLength: quizJson.length, mainTopic }
    });

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: contentToSend,
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
  history: ChatMessage[], 
  message: string, 
  context: string, 
  modelId: string, 
  logger?: Logger,
  image?: string
) => {
  const ai = getClient(apiKey);
  
  const systemPromptWithContext = `${CHATBOT_SYSTEM_PROMPT}\n\nCURRENT APP CONTEXT:\n${context}`;

  // Stateless Approach Strategy (similar to Edit Mode):
  // 1. We manually build the full 'contents' array from history.
  // 2. We do NOT use ai.chats.create() which maintains internal state and fails on strict ContentUnion types with mixed media.
  // 3. We take the last few messages to keep context window manageable.

  const RECENT_MESSAGES_COUNT = 4; // Keep roughly last 4 messages for context

  if (logger) logger({ 
    type: 'request', 
    source: 'sendChatMessage (Stateless)', 
    summary: 'Sending chat message', 
    details: { model: modelId, message, contextLength: context.length, hasImage: !!image } 
  });

  try {
    const contents: any[] = [];
    
    // 1. Process recent history
    const recentHistory = history.slice(-RECENT_MESSAGES_COUNT);
    
    recentHistory.forEach(h => {
        const parts: any[] = [];
        // Only add text if it exists
        if (h.content && h.content.trim()) {
            parts.push({ text: h.content });
        }
        // Add historical image if exists
        if (h.image) {
            parts.push({ inlineData: { mimeType: 'image/png', data: h.image } });
        }

        // If a message was somehow empty, skip adding it to avoid API errors
        if (parts.length > 0) {
            contents.push({
                role: h.role,
                parts: parts
            });
        }
    });

    // 2. Add CURRENT User Message
    const currentParts: any[] = [];
    if (message && message.trim()) {
        currentParts.push({ text: message });
    }
    if (image) {
        currentParts.push({ inlineData: { mimeType: 'image/png', data: image } });
    }

    if (currentParts.length > 0) {
        contents.push({
            role: 'user',
            parts: currentParts
        });
    } else {
        // Fallback if user sends empty msg? usually UI blocks this.
        contents.push({ role: 'user', parts: [{ text: "..." }] });
    }

    // 3. Send via generateContent (Stateless)
    // IMPORTANT: When using generateContent for chat, we pass the array of contents directly.
    const response = await ai.models.generateContent({
        model: modelId,
        contents: contents, // The full array of previous + current
        config: {
            systemInstruction: systemPromptWithContext
        }
    });

    const text = response.text || "";

    if (logger) logger({ type: 'response', source: 'sendChatMessage', summary: 'Received chat response', details: { text } });

    return text;
  } catch (error) {
    if (logger) logger({ type: 'error', source: 'sendChatMessage', summary: 'Chat failed', details: error });
    throw error;
  }
};
