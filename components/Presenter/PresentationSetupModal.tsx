import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import Button from '../Button';
import { PlayerSettings, SavedPreset } from '../../types';
import { STORAGE_KEYS } from '../../constants';
import { Save, Play, RefreshCw, X, Volume2, Camera, Clock } from 'lucide-react';

interface PresentationSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (settings: PlayerSettings) => void;
    initialSettings: PlayerSettings;
}

export const PresentationSetupModal: React.FC<PresentationSetupModalProps> = ({ isOpen, onClose, onStart, initialSettings }) => {
    const [settings, setSettings] = useState<PlayerSettings>(initialSettings);
    const [presets, setPresets] = useState<(SavedPreset | null)[]>(Array(6).fill(null));
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    
    // Load Presets and Voices
    useEffect(() => {
        if (isOpen) {
            try {
                const saved = localStorage.getItem(STORAGE_KEYS.PRESENTATION_PRESETS);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Ensure fixed size 6
                    const fixed = Array(6).fill(null).map((_, i) => parsed[i] || null);
                    setPresets(fixed);
                }
            } catch (e) { console.error("Failed to load presets", e); }

            const loadVoices = () => {
                const v = window.speechSynthesis.getVoices();
                setVoices(v);
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, [isOpen]);

    const handleSavePreset = (index: number) => {
        const name = prompt("Name this preset:", `Preset ${index + 1}`);
        if (!name) return;

        const newPreset: SavedPreset = { name, settings: { ...settings } };
        const newPresets = [...presets];
        newPresets[index] = newPreset;
        setPresets(newPresets);
        localStorage.setItem(STORAGE_KEYS.PRESENTATION_PRESETS, JSON.stringify(newPresets));
    };

    const handleLoadPreset = (index: number) => {
        const preset = presets[index];
        if (preset) {
            setSettings({ ...preset.settings });
        }
    };

    const handleDeletePreset = (index: number) => {
        if (confirm("Clear this preset?")) {
            const newPresets = [...presets];
            newPresets[index] = null;
            setPresets(newPresets);
            localStorage.setItem(STORAGE_KEYS.PRESENTATION_PRESETS, JSON.stringify(newPresets));
        }
    };

    const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Theater Mode Setup">
            <div className="flex flex-col h-full max-h-[70vh] gap-6">
                <div className="flex flex-col md:flex-row gap-6 overflow-y-auto pr-2">
                    
                    {/* Left: Configuration Form */}
                    <div className="flex-1 space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Volume2 size={16}/> Audio & Voice
                            </h4>
                            
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Narrator Voice</label>
                                <select 
                                    className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                                    value={settings.voiceURI || ''}
                                    onChange={e => setSettings({...settings, voiceURI: e.target.value})}
                                >
                                    <option value="">Default Device Voice</option>
                                    {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.slice(0, 40)} ({v.lang})</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block flex justify-between">
                                        <span>Speed</span> <span>{settings.rate}x</span>
                                    </label>
                                    <input 
                                        type="range" min="0.5" max="2" step="0.1" 
                                        value={settings.rate} 
                                        onChange={e => setSettings({...settings, rate: parseFloat(e.target.value)})} 
                                        className="w-full accent-indigo-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block flex justify-between">
                                        <span>Pitch</span> <span>{settings.pitch}</span>
                                    </label>
                                    <input 
                                        type="range" min="0.5" max="2" step="0.1" 
                                        value={settings.pitch} 
                                        onChange={e => setSettings({...settings, pitch: parseFloat(e.target.value)})} 
                                        className="w-full accent-indigo-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Clock size={16}/> Pacing & Timing
                            </h4>
                            
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={settings.customPacingEnabled} 
                                    onChange={e => setSettings({...settings, customPacingEnabled: e.target.checked, pacing: e.target.checked ? 1000 : 500})}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <label className="text-sm text-gray-700 dark:text-gray-300">Custom Pause after sentences</label>
                            </div>

                            {settings.customPacingEnabled && (
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block flex justify-between">
                                        <span>Pause Duration</span> <span>{(settings.pacing/1000).toFixed(1)}s</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="5000" step="100" 
                                        value={settings.pacing} 
                                        onChange={e => setSettings({...settings, pacing: parseInt(e.target.value)})} 
                                        className="w-full accent-indigo-600"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block flex justify-between">
                                    <span>Min Slide Time (Prevent skipping)</span> <span>{(settings.minSlideDuration / 1000).toFixed(0)}s</span>
                                </label>
                                <input 
                                    type="range" min="1000" max="120000" step="1000" 
                                    value={settings.minSlideDuration} 
                                    onChange={e => setSettings({...settings, minSlideDuration: parseInt(e.target.value)})} 
                                    className="w-full accent-indigo-600"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block flex justify-between">
                                    <span>Static Slide Time (No Audio)</span> <span>{(settings.staticSlideDuration / 1000).toFixed(0)}s</span>
                                </label>
                                <input 
                                    type="range" min="2000" max="60000" step="1000" 
                                    value={settings.staticSlideDuration} 
                                    onChange={e => setSettings({...settings, staticSlideDuration: parseInt(e.target.value)})} 
                                    className="w-full accent-indigo-600"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Camera size={16}/> Visuals
                            </h4>
                            
                            <div className="flex items-center gap-3 mb-2">
                                <input 
                                    type="checkbox" 
                                    checked={settings.autoPan} 
                                    onChange={e => setSettings({...settings, autoPan: e.target.checked})}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <label className="text-sm text-gray-700 dark:text-gray-300">Cinematic Auto-Pan</label>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">Highlight Color</label>
                                <div className="flex gap-2">
                                    {COLORS.map(c => (
                                        <button 
                                            key={c} 
                                            onClick={() => setSettings({...settings, highlightColor: c})}
                                            className={`w-6 h-6 rounded-full border-2 ${settings.highlightColor === c ? 'border-indigo-600 scale-110' : 'border-transparent'}`}
                                            style={{backgroundColor: c}}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Presets Grid */}
                    <div className="md:w-64 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                            <Save size={16}/> Saved Presets
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-3 flex-1 overflow-y-auto custom-scrollbar">
                            {presets.map((preset, index) => (
                                <div 
                                    key={index}
                                    className={`
                                        p-3 rounded-lg border text-sm transition-all relative group
                                        ${preset 
                                            ? 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-900 shadow-sm' 
                                            : 'border-dashed border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }
                                    `}
                                >
                                    {preset ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="font-bold text-indigo-700 dark:text-indigo-300 truncate pr-6">{preset.name}</div>
                                            <div className="text-xs text-gray-500 flex gap-2">
                                                <span>{preset.settings.rate}x Spd</span>
                                                <span>{preset.settings.autoPan ? 'Pan On' : 'Pan Off'}</span>
                                            </div>
                                            <div className="flex gap-2 mt-1">
                                                <button 
                                                    onClick={() => handleLoadPreset(index)}
                                                    className="flex-1 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-1 rounded text-xs font-semibold"
                                                >
                                                    Load
                                                </button>
                                                <button 
                                                    onClick={() => handleSavePreset(index)} 
                                                    className="p-1 text-gray-400 hover:text-indigo-500" 
                                                    title="Overwrite"
                                                >
                                                    <RefreshCw size={14}/>
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => handleDeletePreset(index)}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleSavePreset(index)}
                                            className="w-full h-full flex flex-col items-center justify-center gap-1 py-2 text-gray-400 hover:text-indigo-500"
                                        >
                                            <Save size={20} className="opacity-50"/>
                                            <span className="text-xs font-medium">Save Current</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onStart(settings)} className="pl-6 pr-8 font-bold text-lg shadow-xl shadow-indigo-500/20">
                        <Play size={20} className="mr-2 fill-current"/> Start Show
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
