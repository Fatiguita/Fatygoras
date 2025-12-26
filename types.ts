
export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark',
  CHALKBOARD = 'chalkboard',
  BLUEPRINT = 'blueprint'
}

export enum GeminiModel {
  GEMINI_3_FLASH = 'gemini-3-flash-preview',
  GEMINI_3_PRO = 'gemini-3-pro-preview',
  GEMINI_2_5_FLASH = 'gemini-2.5-flash',
  GEMINI_2_5_PRO = 'gemini-2.5-pro',
}

export interface WhiteboardData {
  id: string;
  topic: string;
  svgContent: string;
  explanation: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface SessionData {
  whiteboards: WhiteboardData[];
  chatHistory: ChatMessage[];
  theme: AppTheme;
  apiKey?: string;
}

export interface AnalysisResult {
  isAbstract: boolean;
  topics: string[];
}

export interface PlaygroundCode {
  id: string;
  html: string;
  description: string;
  timestamp: number;
  status: 'loading' | 'ready' | 'error'; // Added status for background loading
}

export interface ApiLogEntry {
  id: string;
  timestamp: number;
  type: 'request' | 'response' | 'error' | 'info';
  source: string;
  summary: string;
  details?: any;
}

export type Logger = (entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => void;

export interface ExportedSessionManifest {
  version: string;
  createdAt: number;
  theme: AppTheme;
  model: GeminiModel;
  chatHistory: ChatMessage[];
  whiteboards: Array<{
    id: string;
    topic: string;
    explanation: string;
    timestamp: number;
    filePath: string;
  }>;
  playgrounds: Array<{
    id: string;
    description: string;
    timestamp: number;
    filePath: string;
  }>;
}

export interface SavedSessionMetadata {
  id: string;
  name: string;
  group?: string; // For folders/collections
  timestamp: number;
  topicCount: number;
}

// Syllabus Types
export type CourseLevel = 'Introduction' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';

export interface SyllabusData {
  level: CourseLevel;
  topic: string;
  description: string;
  concepts: string[];
}
