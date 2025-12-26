import React, { useState, useEffect, useRef } from 'react';
import { ApiLogEntry } from '../types';

interface ApiLogPanelProps {
  logs: ApiLogEntry[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

const LogItem: React.FC<{ entry: ApiLogEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'request': return 'text-blue-600 dark:text-blue-400';
      case 'response': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 text-sm">
      <div 
        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-xs text-gray-400 min-w-[60px]">
          {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
        </span>
        <div className="flex-1 overflow-hidden">
           <div className="flex items-center gap-2">
             <span className={`uppercase text-[10px] font-bold tracking-wider ${getTypeColor(entry.type)}`}>
               {entry.type}
             </span>
             <span className="font-semibold text-gray-700 dark:text-gray-300">
               {entry.source}
             </span>
           </div>
           <p className="text-gray-600 dark:text-gray-400 truncate mt-1">
             {entry.summary}
           </p>
        </div>
        <div className="text-gray-400">
          {expanded ? '−' : '+'}
        </div>
      </div>
      
      {expanded && entry.details && (
        <div className="p-3 bg-gray-100 dark:bg-gray-900 overflow-x-auto">
          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const ApiLogPanel: React.FC<ApiLogPanelProps> = ({ logs, isOpen, onClose, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-[#1a1a1a] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-gray-200 dark:border-gray-700 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2b2b2b]">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <h2 className="font-bold text-gray-900 dark:text-white">API Advanced Mode</h2>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={onClear}
             className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
           >
             Clear
           </button>
           <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1a1a]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
            <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <p className="text-sm">No API activity yet.</p>
            <p className="text-xs mt-1">Requests and responses will appear here.</p>
          </div>
        ) : (
          logs.map((log) => (
            <LogItem key={log.id} entry={log} />
          ))
        )}
        <div ref={endRef} />
      </div>
      
      {/* Footer Status */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 text-center bg-gray-50 dark:bg-[#2b2b2b]">
        {logs.length} events logged
      </div>
    </div>
  );
};

export default ApiLogPanel;