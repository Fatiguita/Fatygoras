import { useEffect, useCallback } from 'react';

export const usePlaygroundResize = (
    isResizing: boolean,
    setIsResizing: (value: boolean) => void,
    setPlaygroundWidth: (width: number) => void
) => {
    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = document.body.clientWidth - e.clientX;
            if (newWidth > 300 && newWidth < document.body.clientWidth - 100) {
                setPlaygroundWidth(newWidth);
            }
        }
    }, [isResizing, setPlaygroundWidth]);

    const stopResizing = useCallback(() => setIsResizing(false), [setIsResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);
};

export const useFullscreenListener = (setIsFullscreen: (value: boolean) => void) => {
    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, [setIsFullscreen]);
};
