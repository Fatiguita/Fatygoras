import { useCallback } from 'react';
import { ApiLogEntry, PlaygroundCode, WhiteboardData } from '../types';

export const useLogger = (setApiLogs: (logs: ApiLogEntry[] | ((prev: ApiLogEntry[]) => ApiLogEntry[])) => void) => {
    const addLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => {
        const newLog: ApiLogEntry = {
            ...entry,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
        };
        setApiLogs(prev => [...prev, newLog]);
    }, [setApiLogs]);

    return addLog;
};

export const useChatContext = (playgrounds: PlaygroundCode[], activePlaygroundId: string | null, whiteboards: WhiteboardData[]) => {
    const chatContext = (() => {
        const pg = playgrounds.find(p => p.id === activePlaygroundId);
        let pgContext = "[No Active Playground]";
        if (pg) pgContext = `[Active ${pg.type === 'test' ? 'Level Test' : 'Playground'}]: ${pg.description} (${pg.status})`;

        const wbContext = whiteboards.slice(0, 3).map(w => `[Whiteboard - ${w.topic}]: ${w.explanation.substring(0, 150)}...`).join('\n');
        return `USER SCREEN CONTEXT:\n${pgContext}\n\n${wbContext || "[No Whiteboards Visible]"}`;
    })();

    return chatContext;
};
