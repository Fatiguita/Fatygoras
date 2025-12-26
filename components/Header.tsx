import React, { useState, useEffect } from 'react';
import { AppTheme, GeminiModel } from '../types';
import { THEME_OPTIONS, MODEL_OPTIONS } from '../constants';
import Select from './Select';
import Input from './Input';
import Button from './Button';

interface HeaderProps {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  model: GeminiModel;
  setModel: (m: GeminiModel) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  onClearSession: () => void;
  saveToLocal: boolean;
  setSaveToLocal: (v: boolean) => void;
  toggleAdvancedMode: () => void;
  onOpenSessionManager: () => void;
  playgroundOpen: boolean;
  togglePlayground: () => void;
  hasPlaygroundCode: boolean;
}

const Header: React.FC<HeaderProps> = ({
  theme, setTheme,
  model, setModel,
  apiKey, setApiKey,
  onClearSession,
  saveToLocal, setSaveToLocal,
  toggleAdvancedMode,
  onOpenSessionManager,
  playgroundOpen,
  togglePlayground,
  hasPlaygroundCode
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(!apiKey);

  // Auto-hide key input if key is present, but allow toggling
  useEffect(() => {
    if (apiKey && showApiKey && !isMenuOpen) {
       // Optional: could auto-hide, but let's respect user choice if they opened it manually
    }
  }, [apiKey]);

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300 flex-shrink-0">
      <div className="max-w-[1920px] mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
             <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
               Fatygoras
             </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
              {/* Primary Action always visible if active */}
              {hasPlaygroundCode && !playgroundOpen && (
                <Button size="sm" onClick={togglePlayground} className="animate-pulse bg-green-600 hover:bg-green-700 text-white border-none text-xs sm:text-sm">
                   <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                   <span className="hidden sm:inline">Playground</span>
                </Button>
              )}

              {/* API Key Toggle */}
              <button 
                 onClick={() => setShowApiKey(!showApiKey)}
                 className={`p-2 rounded-lg transition-colors ${!apiKey ? 'text-red-500 animate-pulse' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                 title="API Key Settings"
              >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              </button>

              {/* Mobile Menu Toggle */}
              <button 
                className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              {/* Desktop Controls */}
              <div className="hidden lg:flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 mr-4 ml-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Storage</label>
                      <button 
                        onClick={() => setSaveToLocal(!saveToLocal)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${saveToLocal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${saveToLocal ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>

                  <Select 
                    options={MODEL_OPTIONS} 
                    value={model} 
                    onChange={(e) => setModel(e.target.value as GeminiModel)}
                    className="w-48 text-sm py-1"
                  />

                  <Select 
                    options={THEME_OPTIONS} 
                    value={theme} 
                    onChange={(e) => setTheme(e.target.value as AppTheme)}
                    className="w-32 text-sm py-1"
                  />
                  
                  <Button variant="ghost" size="sm" onClick={onOpenSessionManager} title="Sessions Import/Export">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  </Button>

                  <Button variant="ghost" size="sm" onClick={onClearSession} title="Clear Session">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </Button>

                  <Button variant="ghost" size="sm" onClick={toggleAdvancedMode} title="Advanced Mode (API Tracker)">
                     <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  </Button>
              </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4 animate-fade-in">
             <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Local Storage</span>
                <button 
                  onClick={() => setSaveToLocal(!saveToLocal)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${saveToLocal ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${saveToLocal ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
             </div>
             
             <Select 
                label="AI Model"
                options={MODEL_OPTIONS} 
                value={model} 
                onChange={(e) => setModel(e.target.value as GeminiModel)}
                className="w-full text-sm py-1"
             />

             <Select 
                label="Theme"
                options={THEME_OPTIONS} 
                value={theme} 
                onChange={(e) => setTheme(e.target.value as AppTheme)}
                className="w-full text-sm py-1"
             />

             <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={onOpenSessionManager}>
                   Sessions
                </Button>
                <Button variant="secondary" size="sm" onClick={toggleAdvancedMode}>
                   Debug
                </Button>
             </div>
             
             <Button variant="danger" size="sm" onClick={() => { onClearSession(); setIsMenuOpen(false); }} className="w-full">
               Clear Session
             </Button>
          </div>
        )}
        
        {/* API Key Input - Conditionally Visible */}
        {showApiKey && (
            <div className="mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <Input 
                        type="password" 
                        placeholder="Enter Google Gemini API Key" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                        className="w-full"
                        autoFocus={!apiKey}
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">Auto-saves if Storage ON</span>
                        <button onClick={() => setShowApiKey(false)} className="text-gray-400 hover:text-gray-600">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </header>
  );
};

export default Header;