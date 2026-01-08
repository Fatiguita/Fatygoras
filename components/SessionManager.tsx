import React, { useRef, useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { exportCollectionToZip, importLibraryFromZip, downloadBlob } from '../services/sessionService';
import { generateCleanupScript, generateCleanupReadme } from '../services/autoSaveService';
import { WhiteboardData, ChatMessage, PlaygroundCode, AppTheme, GeminiModel, SavedSessionMetadata } from '../types';
import { STORAGE_KEYS } from '../constants';

interface SessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  whiteboards: WhiteboardData[];
  chatHistory: ChatMessage[];
  playgrounds: PlaygroundCode[];
  theme: AppTheme;
  model: GeminiModel;
  onImport: (data: {
    whiteboards: WhiteboardData[];
    chatHistory: ChatMessage[];
    playgrounds: PlaygroundCode[];
    theme: AppTheme;
    model: GeminiModel;
  }) => void;
  // Auto Save Props
  onConfigureAutoSave: (handle: any, interval: number, sessionName: string) => void;
  onUpdateAutoSaveSettings: (interval: number, sessionName: string) => void;
  onStopAutoSave: () => void;
  autoSaveActive: boolean;
  initialAutoSaveName: string;
  initialAutoSaveInterval: number;
}

const SessionManager: React.FC<SessionManagerProps> = ({
  isOpen,
  onClose,
  whiteboards,
  chatHistory,
  playgrounds,
  theme,
  model,
  onImport,
  onConfigureAutoSave,
  onUpdateAutoSaveSettings,
  onStopAutoSave,
  autoSaveActive,
  initialAutoSaveName,
  initialAutoSaveInterval
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Library State
  const [savedSessions, setSavedSessions] = useState<SavedSessionMetadata[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveGroup, setSaveGroup] = useState('');

  // Auto Save State
  const [autoSaveName, setAutoSaveName] = useState(initialAutoSaveName);
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(initialAutoSaveInterval);

  // Sync state with props when modal opens or props change (due to loading from localStorage)
  useEffect(() => {
    setAutoSaveName(initialAutoSaveName);
    setAutoSaveMinutes(initialAutoSaveInterval);
  }, [initialAutoSaveName, initialAutoSaveInterval]);

  useEffect(() => {
    if (isOpen) loadLibraryIndex();
  }, [isOpen]);

  const loadLibraryIndex = () => {
    try {
      const indexJson = localStorage.getItem(STORAGE_KEYS.LIBRARY_INDEX);
      const index = indexJson ? JSON.parse(indexJson) : [];
      setSavedSessions(index);
    } catch (e) {
      console.error("Failed to load library index", e);
      setSavedSessions([]);
    }
  };

  const saveToLibrary = () => {
    if (!saveName.trim()) return;

    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const metadata: SavedSessionMetadata = {
      id: newId,
      name: saveName.trim(),
      group: saveGroup.trim() || undefined,
      timestamp: Date.now(),
      topicCount: whiteboards.length
    };

    const sessionData = {
      whiteboards,
      chatHistory,
      playgrounds,
      theme,
      model
    };

    try {
      localStorage.setItem(`${STORAGE_KEYS.LIBRARY_DATA_PREFIX}${newId}`, JSON.stringify(sessionData));
      const newIndex = [...savedSessions, metadata];
      localStorage.setItem(STORAGE_KEYS.LIBRARY_INDEX, JSON.stringify(newIndex));
      setSavedSessions(newIndex);
      setSaveName('');
      // Keep group name for convenience
    } catch (e) {
      setError("Storage full. Cannot save session locally.");
    }
  };

  const loadFromLibrary = (id: string) => {
    const dataJson = localStorage.getItem(`${STORAGE_KEYS.LIBRARY_DATA_PREFIX}${id}`);
    if (dataJson) {
      const parsed = JSON.parse(dataJson);
      onImport({
        whiteboards: parsed.whiteboards || [],
        chatHistory: parsed.chatHistory || [],
        playgrounds: parsed.playgrounds || [],
        theme: parsed.theme || theme,
        model: parsed.model || model
      });
      onClose();
    } else {
      setError("Session data not found.");
    }
  };

  const deleteFromLibrary = (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    localStorage.removeItem(`${STORAGE_KEYS.LIBRARY_DATA_PREFIX}${id}`);
    const newIndex = savedSessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.LIBRARY_INDEX, JSON.stringify(newIndex));
    setSavedSessions(newIndex);
  };

  const handleExportLibrary = async () => {
    setIsProcessing(true);
    try {
      const sessionsToExport = [];
      for (const meta of savedSessions) {
        const dataJson = localStorage.getItem(`${STORAGE_KEYS.LIBRARY_DATA_PREFIX}${meta.id}`);
        if (dataJson) {
          const parsed = JSON.parse(dataJson);
          sessionsToExport.push({
            name: meta.name,
            group: meta.group,
            ...parsed
          });
        }
      }
      const blob = await exportCollectionToZip(sessionsToExport);
      downloadBlob(blob, `AI_Teacher_Library_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      console.error(e);
      setError("Export failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
      const importedSessions = await importLibraryFromZip(file);
      const newIndex = [...savedSessions];
      
      importedSessions.forEach(session => {
        const newId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const metadata: SavedSessionMetadata = {
          id: newId,
          name: session.name || `Imported ${new Date().toLocaleTimeString()}`,
          group: session.group,
          timestamp: Date.now(),
          topicCount: session.whiteboards.length
        };
        
        localStorage.setItem(`${STORAGE_KEYS.LIBRARY_DATA_PREFIX}${newId}`, JSON.stringify({
          whiteboards: session.whiteboards,
          chatHistory: session.chatHistory,
          playgrounds: session.playgrounds,
          theme: session.theme,
          model: session.model
        }));

        newIndex.push(metadata);
      });

      localStorage.setItem(STORAGE_KEYS.LIBRARY_INDEX, JSON.stringify(newIndex));
      setSavedSessions(newIndex);
      
    } catch (err) {
      console.error(err);
      setError("Failed to import. Ensure file is a valid ZIP archive.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetupAutoSave = async () => {
      try {
          // Check for API support
          if (!('showDirectoryPicker' in window)) {
              alert("Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera.");
              return;
          }
          
          // @ts-ignore
          const dirHandle = await window.showDirectoryPicker();
          if (dirHandle) {
              onConfigureAutoSave(dirHandle, autoSaveMinutes, autoSaveName);
          }
      } catch (err) {
          console.error("Directory picker cancelled or failed", err);
      }
  };

  const handleDownloadScript = () => {
      const script = generateCleanupScript();
      const readme = generateCleanupReadme();
      
      downloadBlob(new Blob([script], { type: 'text/javascript' }), 'cleanup_sessions.js');
      downloadBlob(new Blob([readme], { type: 'text/markdown' }), 'README_CLEANUP.md');
  };

  // Grouping Logic
  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: SavedSessionMetadata[] } = { 'Ungrouped': [] };
    savedSessions.forEach(session => {
      const g = session.group || 'Ungrouped';
      if (!groups[g]) groups[g] = [];
      groups[g].push(session);
    });
    return groups;
  }, [savedSessions]);

  const groupKeys = Object.keys(groupedSessions).sort((a, b) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Session Library">
      <div className="flex flex-col h-[70vh]">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
             {/* Local Browser Storage */}
            <div>
               <h4 className="font-bold text-sm mb-2 text-blue-800 dark:text-blue-300">Browser Storage</h4>
               <div className="flex gap-2 mb-2">
                     <input 
                        type="text" 
                        placeholder="Folder Name (Optional)" 
                        value={saveGroup} 
                        onChange={e => setSaveGroup(e.target.value)}
                        className="w-1/3 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                     />
                     <input 
                        type="text" 
                        placeholder="Session Name..." 
                        value={saveName} 
                        onChange={e => setSaveName(e.target.value)}
                        className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                     />
               </div>
               <Button size="sm" onClick={saveToLibrary} disabled={!saveName || whiteboards.length === 0} className="w-full mb-3">
                   Save Current Session
               </Button>
               
               <div className="flex gap-2">
                 <input type="file" accept=".zip" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                 <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                    {isProcessing ? 'Importing...' : 'Import ZIP'}
                 </Button>
                 <Button size="sm" variant="ghost" onClick={handleExportLibrary} disabled={savedSessions.length === 0 || isProcessing}>
                    Export All
                 </Button>
              </div>
            </div>

            {/* Auto Save Config */}
            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/30">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm text-orange-800 dark:text-orange-300">Auto-Save to Disk</h4>
                    {autoSaveActive && <span className="text-xs font-bold text-green-600 animate-pulse">● Active</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Automatically saves session <b>ZIPs</b> to a folder on your computer.
                </p>
                
                <div className="flex gap-2 mb-2">
                    <input 
                       type="text" 
                       value={autoSaveName} 
                       onChange={(e) => {
                           const val = e.target.value;
                           setAutoSaveName(val);
                           onUpdateAutoSaveSettings(autoSaveMinutes, val);
                       }}
                       placeholder="Base Filename"
                       className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <div className="flex items-center gap-1">
                        <input 
                           type="number" 
                           value={autoSaveMinutes} 
                           onChange={(e) => {
                               const val = Math.max(1, parseInt(e.target.value) || 1);
                               setAutoSaveMinutes(val);
                               onUpdateAutoSaveSettings(val, autoSaveName);
                           }}
                           className="w-12 text-sm px-1 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-center"
                        />
                        <span className="text-xs text-gray-500">min</span>
                    </div>
                </div>
                
                <div className="flex justify-between items-center gap-2">
                    <Button size="sm" onClick={handleSetupAutoSave} variant={autoSaveActive ? 'secondary' : 'primary'} className="flex-1">
                        {autoSaveActive ? 'Change Folder' : 'Select Folder & Start'}
                    </Button>
                    
                    {autoSaveActive && (
                        <Button size="sm" onClick={onStopAutoSave} variant="danger" title="Stop Auto-Save">
                            Stop
                        </Button>
                    )}
                </div>
                
                <div className="mt-2 text-right">
                    <button onClick={handleDownloadScript} className="text-xs underline text-gray-500 hover:text-orange-500">
                        Get Cleanup Script
                    </button>
                </div>
            </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto pr-2">
            {savedSessions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>Browser Library is empty.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groupKeys.map(group => (
                        <div key={group} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                            {group !== 'Ungrouped' && (
                                <details className="group" open>
                                    <summary className="bg-gray-100 dark:bg-gray-700 px-4 py-2 font-bold text-sm cursor-pointer select-none flex items-center gap-2">
                                        <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                        {group}
                                        <span className="text-xs font-normal text-gray-500 ml-auto">{groupedSessions[group].length} items</span>
                                    </summary>
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {groupedSessions[group].map(session => (
                                            <SessionRow 
                                                key={session.id} 
                                                session={session} 
                                                onLoad={loadFromLibrary} 
                                                onDelete={deleteFromLibrary} 
                                            />
                                        ))}
                                    </div>
                                </details>
                            )}
                            {group === 'Ungrouped' && groupedSessions[group].length > 0 && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                     {groupKeys.length > 1 && (
                                         <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 text-xs font-bold text-gray-500 uppercase">Unsorted</div>
                                     )}
                                     {groupedSessions[group].map(session => (
                                        <SessionRow 
                                            key={session.id} 
                                            session={session} 
                                            onLoad={loadFromLibrary} 
                                            onDelete={deleteFromLibrary} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
        {error && <div className="mt-4 text-red-500 text-sm text-center font-medium">{error}</div>}
      </div>
    </Modal>
  );
};

const SessionRow: React.FC<{
    session: SavedSessionMetadata;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ session, onLoad, onDelete }) => (
    <div className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <div className="flex flex-col">
            <span className="font-semibold text-gray-800 dark:text-gray-200">{session.name}</span>
            <div className="text-xs text-gray-400 flex gap-3">
                <span>{new Date(session.timestamp).toLocaleDateString()}</span>
                <span>•</span>
                <span>{session.topicCount} Topics</span>
            </div>
        </div>
        <div className="flex gap-2">
            <Button size="sm" onClick={() => onLoad(session.id)}>Load</Button>
            <button 
                onClick={() => onDelete(session.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
    </div>
);

export default SessionManager;
