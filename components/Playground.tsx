import React, { useRef, useEffect } from 'react';
import { PlaygroundCode } from '../types';

interface PlaygroundProps {
  code: PlaygroundCode;
  onClose: () => void;
  onRetry?: () => void;
  onTestComplete?: (results: any) => void;
}

const Playground: React.FC<PlaygroundProps> = ({ code, onClose, onRetry, onTestComplete }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (code.status === 'ready' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(code.html);
        doc.close();
      }
    }
  }, [code]);

  // Listen for score communication from Level Test apps
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ensure security check if dealing with external domains, 
      // but here we are rendering local content.
      if (event.data && event.data.type === 'FATY_TEST_COMPLETE') {
          if (onTestComplete) {
              onTestComplete({
                  ...event.data.payload,
                  testId: code.id
              });
          }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTestComplete, code.id]);

  const handleDownload = () => {
    const blob = new Blob([code.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 select-none">
         <div className="flex items-center gap-2 overflow-hidden">
            {code.type === 'test' ? (
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            ) : (
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            )}
            <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 truncate uppercase tracking-wider">
                {code.description}
            </span>
            {code.status === 'loading' && <span className="text-xs text-blue-500 animate-pulse">(Building...)</span>}
         </div>
         <div className="flex items-center gap-2">
             {onRetry && (
                 <button 
                   onClick={onRetry}
                   className="text-gray-500 hover:text-orange-500 transition-colors p-1"
                   title="Retry Generation"
                   disabled={code.status === 'loading'}
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </button>
             )}
             {code.status === 'ready' && (
                 <button 
                   onClick={handleDownload}
                   className="text-gray-500 hover:text-blue-500 transition-colors p-1"
                   title="Download HTML App"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 </button>
             )}
             <button 
               onClick={onClose}
               className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
               title="Close Panel"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
         </div>
      </div>
      <div className="flex-1 relative bg-white">
        {code.status === 'loading' ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
               <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
               <p className="text-gray-500 dark:text-gray-400 text-sm">Designing interactive environment...</p>
           </div>
        ) : code.status === 'error' ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <p className="text-red-500">Failed to load playground.</p>
              {onRetry && (
                  <button onClick={onRetry} className="mt-4 text-blue-500 hover:underline">Try Again</button>
              )}
           </div>
        ) : (
           <iframe 
               ref={iframeRef} 
               className="absolute inset-0 w-full h-full border-none"
               title="Interactive Playground"
               sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
           />
        )}
      </div>
    </div>
  );
};

export default Playground;