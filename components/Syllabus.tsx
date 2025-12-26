import React, { useState } from 'react';
import { SyllabusData, CourseLevel } from '../types';
import Button from './Button';
import Select from './Select';

interface SyllabusProps {
  data: SyllabusData | null;
  onGenerate: (topic: string, level: CourseLevel) => void;
  onImportLevel: (topics: string[]) => void;
  isLoading: boolean;
}

const Syllabus: React.FC<SyllabusProps> = ({ data, onGenerate, onImportLevel, isLoading }) => {
  const [topicInput, setTopicInput] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel>('Introduction');

  const LEVELS: { label: string, value: CourseLevel }[] = [
    { label: 'Introduction', value: 'Introduction' },
    { label: 'Beginner', value: 'Beginner' },
    { label: 'Intermediate', value: 'Intermediate' },
    { label: 'Advanced', value: 'Advanced' },
    { label: 'Master', value: 'Master' },
  ];

  const handleGenerate = () => {
    if (topicInput.trim()) onGenerate(topicInput, selectedLevel);
  };

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-6">
      <div className="text-center py-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
          Course Architect
        </h2>
        
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
             <div className="flex flex-col gap-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <input 
                      type="text" 
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="Enter a topic (e.g., Python, History, Baking)"
                      className="flex-[2] px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <div className="flex-1 min-w-[150px]">
                         <Select 
                            options={LEVELS} 
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value as CourseLevel)}
                            className="h-full py-3"
                         />
                    </div>
                 </div>
                 <Button onClick={handleGenerate} disabled={isLoading || !topicInput.trim()} className="w-full sm:w-auto self-end">
                   {isLoading ? 'Designing Curriculum...' : 'Create Syllabus'}
                 </Button>
             </div>
        </div>
      </div>

      {data && (
        <div className="animate-fade-in mt-8">
           <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">{data.topic}</h3>
                    <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold">
                        {data.level} Level
                    </div>
                  </div>
                  <Button size="lg" onClick={() => onImportLevel(data.concepts)}>
                    Send All to Classroom
                  </Button>
               </div>
               
               <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
                   {data.description}
               </p>

               <div>
                 <h4 className="font-bold text-gray-500 uppercase tracking-wide text-sm mb-4">Key Concepts</h4>
                 <div className="grid grid-cols-1 gap-4">
                    {data.concepts.map((concept, i) => (
                      <div key={i} className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700/50 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
                                {i + 1}
                            </div>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{concept}</span>
                        </div>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => onImportLevel([concept])}
                        >
                            Teach this
                        </Button>
                      </div>
                    ))}
                 </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Syllabus;