export enum AppTheme {
  LIGHT = 'light',
  DARK = 'dark',
  CHALKBOARD = 'chalkboard',
  BLUEPRINT = 'blueprint',
  NARUTO = 'naruto',
  POKEMON = 'pokemon',
  MATRIX = 'matrix',
  NEON = 'neon',
  SAKURA = 'sakura',
  WINDOWS_XP = 'windows-xp',
  NARUTO_FIRE = 'naruto-fire',
  L_DEATHNOTE = 'l-deathnote',
  RETRO_ARCADE = 'retro-arcade',
  SOLARIZED = 'solarized'
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
  audioSensitivity?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string; // Base64 string (raw data without prefix preferably for API, or full for display)
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
  audioSensitivity: boolean;
}

export interface PlaygroundCode {
  id: string;
  html: string;
  description: string;
  timestamp: number;
  status: 'loading' | 'ready' | 'error';
  type: 'practice' | 'test';
  relatedTopic?: string;
  model?: GeminiModel;
}

export interface TestResult {
  id: string;
  topic: string;
  score: number;
  maxScore: number;
  levelAssigned: string;
  timestamp: number;
  type?: 'comprehensive' | 'single_level';
  targetLevel?: string;
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

// Changed from union type to string to support "Phase 1", "Phase 2", etc.
export type CourseLevel = string; 

export interface SyllabusData {
  id?: string;
  timestamp?: number;
  level: CourseLevel;
  topic: string;
  description: string;
  concepts: string[];
}

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
    audioSensitivity?: boolean;
  }>;
  playgrounds: Array<{
    id: string;
    description: string;
    timestamp: number;
    filePath: string;
  }>;
  testResults?: TestResult[];
  syllabus?: SyllabusData | null;
  syllabusGallery?: SyllabusData[];
}

export interface SavedSessionMetadata {
  id: string;
  name: string;
  group?: string;
  timestamp: number;
  topicCount: number;
}

// --- NEW: PRESENTATION TYPES ---

export interface NarrativeSegment {
  id: string;
  text: string;
  lang?: string; // Added language support
}

export interface SlideData {
  id: string;
  name: string;
  svgContent: string;
  narrativeSegments: NarrativeSegment[];
  fullNarrative: string;
}

export interface PlayerSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  themeColor: string;
  highlightColor: string;
  autoPlay: boolean;
  pacing: number; // Delay in ms between segments
  staticSlideDuration: number; // NEW: Duration for slides with NO text/audio tags
  minSlideDuration: number;    // NEW: Minimum duration for ANY slide, overriding short text audio
}

export type PlayState = 'idle' | 'playing' | 'paused';
