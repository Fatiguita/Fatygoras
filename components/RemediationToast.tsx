
import React, { useState, useEffect } from 'react';
import Button from './Button';
import { Zap, X, CheckSquare, Square } from 'lucide-react';

interface RemediationToastProps {
  isVisible: boolean;
  concepts: string[];
  onDismiss: () => void;
  onFixGaps: (topics: string[]) => void;
}

const RemediationToast: React.FC<RemediationToastProps> = ({ isVisible, concepts, onDismiss, onFixGaps }) => {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (isVisible) {
      setSelected(concepts);
    }
  }, [isVisible, concepts]);

  const toggleConcept = (c: string) => {
    setSelected(prev => prev.includes(c) ? prev.filter(i => i !== c) : [...prev, c]);
  };

  if (!isVisible || concepts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] max-w-sm w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-orange-500 animate-fade-in overflow-hidden">
      <div className="bg-orange-50 dark:bg-orange-900/20 p-3 border-b border-orange-100 dark:border-orange-800 flex justify-between items-center">
        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold">
           <Zap size={18} fill="currentColor" />
           <span>Learning Gaps Detected</span>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
           <X size={18} />
        </button>
      </div>
      
      <div className="p-4">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          You missed questions related to these topics. Select the ones you'd like to review:
        </p>
        
        <div className="flex flex-col gap-2 mb-4 max-h-[200px] overflow-y-auto pr-1">
          {concepts.map((concept, idx) => (
             <button 
                key={idx}
                onClick={() => toggleConcept(concept)}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
             >
                <div className={`shrink-0 ${selected.includes(concept) ? 'text-orange-500' : 'text-gray-300'}`}>
                   {selected.includes(concept) ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <span className={`text-sm ${selected.includes(concept) ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-500'}`}>
                  {concept}
                </span>
             </button>
          ))}
        </div>

        <div className="flex gap-2">
           <Button variant="secondary" size="sm" onClick={onDismiss} className="flex-1">Dismiss</Button>
           <Button 
             size="sm" 
             onClick={() => onFixGaps(selected)} 
             disabled={selected.length === 0} 
             className="flex-[2] bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
           >
             Fix Gaps ({selected.length})
           </Button>
        </div>
      </div>
    </div>
  );
};

export default RemediationToast;
