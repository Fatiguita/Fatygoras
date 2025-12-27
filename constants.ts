
import { AppTheme, GeminiModel } from './types';

export const DEFAULT_THEME = AppTheme.DARK;
export const DEFAULT_MODEL = GeminiModel.GEMINI_3_PRO;

export const MODEL_OPTIONS = [
  { label: 'Gemini 3.0 Pro Preview', value: GeminiModel.GEMINI_3_PRO },
  { label: 'Gemini 3.0 Flash Preview', value: GeminiModel.GEMINI_3_FLASH },
  // Using best available proxies for requested 2.5/2.0 versions if strictly not in SDK list, 
  // but mapping to the valid string values expected by the SDK or safe fallbacks.
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
};