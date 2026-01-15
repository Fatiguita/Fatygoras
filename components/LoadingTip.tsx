import React, { useState, useEffect } from 'react';
import { LOADING_TIPS } from '../constants';

const LoadingTip: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    // Random start
    setTipIndex(Math.floor(Math.random() * LOADING_TIPS.length));
    
    // Cycle every 4 seconds
    const interval = setInterval(() => {
        setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const tip = LOADING_TIPS[tipIndex];

  return (
    <div className={`flex items-center justify-center gap-3 py-3 px-4 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full animate-fade-in max-w-xl mx-auto backdrop-blur-sm ${className}`}>
        <span className="text-2xl animate-bounce" role="img" aria-label="tip">{tip.emoji}</span>
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 text-center">
            <span className="font-bold opacity-70 uppercase text-xs mr-2">Pro Tip:</span>
            {tip.text}
        </p>
    </div>
  );
};

export default LoadingTip;
