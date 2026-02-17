import React, { useState } from 'react';
import { Camera, Volume2, Clock, ListOrdered, ChevronDown, X } from 'lucide-react';
import { PlayerSettings } from '../../types';

interface SettingsPanelProps {
    settings: PlayerSettings;
    setSettings: (s: PlayerSettings) => void;
    voices: SpeechSynthesisVoice[];
    playbackOrder: 'first' | 'last';
    setPlaybackOrder: (order: 'first' | 'last') => void;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    settings, 
    setSettings, 
    voices, 
    playbackOrder, 
    setPlaybackOrder, 
    onClose 
}) => {
    // Settings Accordion State (Max 2 open)
    const [openSettingsGroups, setOpenSettingsGroups] = useState<string[]>(['camera']);

    const handleToggleSettingsGroup = (id: string) => {
        setOpenSettingsGroups(prev => {
            if (prev.includes(id)) {
                return prev.filter(g => g !== id);
            }
            const newGroups = [...prev, id];
            if (newGroups.length > 2) {
                // Remove the oldest one (first index) to maintain max 2
                return newGroups.slice(newGroups.length - 2);
            }
            return newGroups;
        });
    };

    return (
        <div className="absolute top-16 right-4 z-40 w-80 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl p-4 animate-fade-in text-left flex flex-col max-h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10 shrink-0">
                <h3 className="font-bold text-white text-sm">Player Settings</h3>
                <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close Settings"><X size={16} /></button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                {/* GROUP 1: Camera & Visuals */}
                <SettingsGroup 
                    id="camera"
                    title="Camera & Visuals" 
                    icon={<Camera size={16} />} 
                    isOpen={openSettingsGroups.includes('camera')}
                    onToggle={handleToggleSettingsGroup}
                >
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <label className="text-sm text-white/80">Auto-Pan Camera</label>
                        <input 
                            type="checkbox" 
                            checked={settings.autoPan} 
                            onChange={e => setSettings({...settings, autoPan: e.target.checked})} 
                            className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                        />
                    </div>

                    <div>
                        <label htmlFor="max-zoom" className="flex justify-between text-xs text-white/50 mb-1">
                            <span>Max Zoom Focus</span>
                            <span>{settings.maxAutoZoom}x</span>
                        </label>
                        <input 
                            id="max-zoom" 
                            type="range" 
                            min="1.0" 
                            max="5.0" 
                            step="0.1" 
                            value={settings.maxAutoZoom} 
                            onChange={(e) => setSettings({ ...settings, maxAutoZoom: parseFloat(e.target.value) })} 
                            className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" 
                        />
                    </div>
                    <div>
                        <label className="text-xs text-white/50 block mb-1">Highlight Color</label>
                        <div className="flex gap-2">
                            {['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'].map(c => (
                                <button key={c} onClick={() => setSettings({ ...settings, highlightColor: c })} className={`w-6 h-6 rounded-full border-2 ${settings.highlightColor === c ? 'border-white' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} aria-label={`Set highlight color to ${c}`} />
                            ))}
                        </div>
                    </div>
                </SettingsGroup>

                {/* GROUP 2: Voice & Audio */}
                <SettingsGroup 
                    id="audio"
                    title="Voice & Audio" 
                    icon={<Volume2 size={16} />}
                    isOpen={openSettingsGroups.includes('audio')}
                    onToggle={handleToggleSettingsGroup}
                >
                    <div>
                        <label htmlFor="narrator-voice" className="text-xs text-white/50 block mb-1">Narrator Voice</label>
                        <select
                            id="narrator-voice"
                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 [&>option]:bg-slate-900"
                            value={settings.voiceURI || ''}
                            onChange={(e) => setSettings({ ...settings, voiceURI: e.target.value })}
                            aria-label="Select Narrator Voice"
                        >
                            <option value="">Default Device Voice</option>
                            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.slice(0, 30)} ({v.lang})</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="narrator-speed" className="text-xs text-white/50 block mb-1">Speed ({settings.rate}x)</label>
                            <input id="narrator-speed" type="range" min="0.5" max="2" step="0.1" value={settings.rate} onChange={(e) => setSettings({ ...settings, rate: parseFloat(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`${settings.rate} times speed`} />
                        </div>
                        <div>
                            <label htmlFor="narrator-pitch" className="text-xs text-white/50 block mb-1">Pitch ({settings.pitch})</label>
                            <input id="narrator-pitch" type="range" min="0.5" max="2" step="0.1" value={settings.pitch} onChange={(e) => setSettings({ ...settings, pitch: parseFloat(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`pitch ${settings.pitch}`} />
                        </div>
                    </div>
                </SettingsGroup>

                {/* GROUP 3: Timing & Pacing */}
                <SettingsGroup 
                    id="timing"
                    title="Timing & Pacing" 
                    icon={<Clock size={16} />}
                    isOpen={openSettingsGroups.includes('timing')}
                    onToggle={handleToggleSettingsGroup}
                >
                    {/* Custom Pause Toggle & Slider */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                            <label className="text-sm text-white/80">Custom Pause</label>
                            <input 
                                type="checkbox" 
                                checked={settings.customPacingEnabled || false} 
                                onChange={e => {
                                    const enabled = e.target.checked;
                                    setSettings({
                                        ...settings,
                                        customPacingEnabled: enabled,
                                        pacing: enabled ? (settings.pacing === 500 ? 1000 : settings.pacing) : 500
                                    });
                                }} 
                                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                                title="Toggle custom pause between highlighted texts"
                            />
                        </div>
                        
                        {settings.customPacingEnabled && (
                            <div className="animate-fade-in bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                                <label htmlFor="pacing-slider" className="flex justify-between text-xs text-indigo-200 mb-1">
                                    <span>Pause between texts</span>
                                    <span>{(settings.pacing / 1000).toFixed(1)}s</span>
                                </label>
                                <input 
                                    id="pacing-slider" 
                                    type="range" 
                                    min="0" 
                                    max="5000" 
                                    step="100" 
                                    value={settings.pacing} 
                                    onChange={(e) => setSettings({ ...settings, pacing: parseInt(e.target.value) })} 
                                    className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>
                        )}
                        {!settings.customPacingEnabled && (
                            <p className="text-[10px] text-white/40 italic">Using default pacing (0.5s)</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="min-slide-time" className="flex justify-between text-xs text-white/50 mb-1"><span>Min Slide Time</span><span>{settings.minSlideDuration / 1000}s</span></label>
                        <input id="min-slide-time" type="range" min="1000" max="200000" step="1000" value={settings.minSlideDuration} onChange={(e) => setSettings({ ...settings, minSlideDuration: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" aria-valuetext={`${settings.minSlideDuration} ms`} />
                    </div>
                    <div>
                        <label htmlFor="static-slide-time" className="flex justify-between text-xs text-white/50 mb-1"><span>Static Slide Time</span><span>{settings.staticSlideDuration / 1000}s</span></label>
                        <input id="static-slide-time" type="range" min="5000" max="60000" step="5000" value={settings.staticSlideDuration} onChange={(e) => setSettings({ ...settings, staticSlideDuration: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                    </div>
                </SettingsGroup>
                
                {/* GROUP 4: Playback */}
                <SettingsGroup 
                    id="playback"
                    title="Playback Sequence" 
                    icon={<ListOrdered size={16} />}
                    isOpen={openSettingsGroups.includes('playback')}
                    onToggle={handleToggleSettingsGroup}
                >
                    <div>
                        <label htmlFor="playback-order" className="text-xs text-white/50 block mb-1">Order</label>
                        <select
                            id="playback-order"
                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            value={playbackOrder}
                            onChange={(e) => setPlaybackOrder(e.target.value as 'first' | 'last')}
                            aria-label="Playback Order"
                        >
                            <option value="first">First → Last</option>
                            <option value="last">Last → First</option>
                        </select>
                    </div>
                </SettingsGroup>
            </div>
        </div>
    );
};

const SettingsGroup: React.FC<{ id: string, title: string, icon: React.ReactNode, children: React.ReactNode, isOpen: boolean, onToggle: (id: string) => void }> = ({ id, title, icon, children, isOpen, onToggle }) => (
    <details open={isOpen} className="group bg-white/5 rounded-lg border border-white/10 overflow-hidden mb-2">
        <summary 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 transition select-none"
            onClick={(e) => {
                e.preventDefault();
                onToggle(id);
            }}
        >
            <div className="flex items-center gap-2 text-white/90">
                {icon}
                <span className="font-medium text-sm">{title}</span>
            </div>
            <ChevronDown size={14} className="text-white/50 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="p-3 space-y-4 border-t border-white/5 bg-black/20">
            {children}
        </div>
    </details>
);
