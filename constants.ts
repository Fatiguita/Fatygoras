import { AppTheme, GeminiModel } from './types';

export const DEFAULT_THEME = AppTheme.DARK;
export const DEFAULT_MODEL = GeminiModel.GEMINI_3_PRO;

export const AUTO_SAVE_TAG = 'FATY_V4_AUTO';

export const MODEL_OPTIONS = [
  { label: 'Gemini 3.0 Pro Preview', value: GeminiModel.GEMINI_3_PRO },
  { label: 'Gemini 3.0 Flash Preview', value: GeminiModel.GEMINI_3_FLASH },
  { label: 'Gemini 2.5 Flash', value: GeminiModel.GEMINI_2_5_FLASH }, 
  { label: 'Gemini 2.5 Pro', value: GeminiModel.GEMINI_2_5_PRO },
];

export const THEME_OPTIONS = [
  { label: 'Light Paper', value: AppTheme.LIGHT },
  { label: 'Dark Mode', value: AppTheme.DARK },
  { label: 'Chalkboard', value: AppTheme.CHALKBOARD },
  { label: 'Blueprint', value: AppTheme.BLUEPRINT },
];

export const STORAGE_KEYS = {
  SESSION: 'ai_teacher_session',
  API_KEY: 'ai_teacher_api_key',
  SETTINGS: 'ai_teacher_settings',
  LIBRARY_INDEX: 'ai_teacher_library_index',
  LIBRARY_DATA_PREFIX: 'ai_teacher_lib_data_',
  SYLLABUS_GALLERY: 'ai_teacher_syllabus_gallery',
  TEST_RESULTS: 'ai_teacher_test_results',
  AUTO_SAVE_CONFIG: 'ai_teacher_auto_save_config',
};

export const LOADING_TIPS = [
    { emoji: "💾", text: "Enable 'Local Storage' in the menu to save your API Key." },
    { emoji: "✏️", text: "You can draw on any whiteboard by clicking the Pen icon." },
    { emoji: "🖱️", text: "Drag to pan and scroll to zoom on Whiteboards." },
    { emoji: "🔊", text: "Click on diagrams to hear audio explanations (if supported)." },
    { emoji: "⏬", text: "You can download Playgrounds as standalone HTML files." },
    { emoji: "🌍", text: "Playgrounds work offline if you download them." },
    { emoji: "🤐", text: "Export your entire session as a ZIP file from the Session Manager." },
    { emoji: "🎮", text: "Use the 'Practice' button to code what you just learned." },
    { emoji: "🎓", text: "The Syllabus Architect can plan a course from Intro to Master." },
    { emoji: "🧠", text: "Gemini 3.0 Pro is best for complex logic and reasoning." },
    { emoji: "⚡", text: "Gemini Flash models are faster but less detailed." },
    { emoji: "🔄", text: "If a Playground bugs out, click the retry button in the header." },
    { emoji: "📦", text: "Auto-Save creates backups on your hard drive every few minutes." },
    { emoji: "🖼️", text: "Paste images into the Chat to ask Bruno about them." },
    { emoji: "🎯", text: "Level Tests adapt to your performance automatically." },
    { emoji: "🧹", text: "Use the cleanup script to manage old Auto-Save files." },
    { emoji: "🕶️", text: "Try 'Blueprint' theme for a technical architectural look." },
    { emoji: "📝", text: "Double click text tool to add notes to your whiteboard." },
    { emoji: "🚀", text: "Fatygoras runs entirely in your browser. No backend." },
    { emoji: "🧩", text: "Ask for 'Interactive Simulations' for Physics topics." },
    { emoji: "🛑", text: "You can stop audio playback by clicking the pulsing indicator." },
    { emoji: "🔍", text: "Circle an area on the whiteboard and ask the AI to explain it." }
];
