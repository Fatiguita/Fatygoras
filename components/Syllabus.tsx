import React, { useState } from 'react';
import { SyllabusData, CourseLevel } from '../types';
import Button from './Button';
import Select from './Select';

interface SyllabusProps {
  data: SyllabusData | null;
  gallery: SyllabusData[];
  onGenerate: (topic: string, level: CourseLevel) => void;
  onImportLevel: (topics: string[], mainTopic?: string) => void;
  onDelete: (id: string) => void;
  onSelect: (syllabus: SyllabusData) => void;
  isLoading: boolean;
}

const Syllabus: React.FC<SyllabusProps> = ({ 
  data, 
  gallery,
  onGenerate, 
  onImportLevel, 
  onDelete,
  onSelect,
  isLoading 
}) => {
  const [topicInput, setTopicInput] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel>('Introduction');
  const [showGallery, setShowGallery] = useState(true);

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
    <div className="max-w-4xl mx-auto p-2 sm:p-6 pb-20">
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

      {/* Current Active Syllabus */}
      {data && (
        <div className="animate-fade-in mt-8 mb-16">
           <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-8 shadow-sm border border-gray-200 dark:border-gray-700 ring-2 ring-purple-500/20">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <span className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-1 block">Active Design</span>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">{data.topic}</h3>
                    <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold">
                        {data.level} Level
                    </div>
                  </div>
                  <Button size="lg" onClick={() => onImportLevel(data.concepts, data.topic)}>
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
                            onClick={() => onImportLevel([concept], data.topic)}
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

      {/* Course Gallery */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                My Course Gallery
            </h3>
            <button 
                onClick={() => setShowGallery(!showGallery)}
                className="text-sm text-gray-500 hover:text-purple-600 underline"
            >
                {showGallery ? 'Hide Gallery' : 'Show Gallery'}
            </button>
        </div>

        {showGallery && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gallery.length === 0 ? (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-gray-400">No courses saved yet. Generate one above!</p>
                    </div>
                ) : (
                    gallery.map((course) => (
                        <div key={course.id || course.timestamp} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                            <div className="p-5 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-semibold uppercase tracking-wide">
                                        {course.level}
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {course.timestamp ? new Date(course.timestamp).toLocaleDateString() : 'Saved'}
                                    </span>
                                </div>
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-1">{course.topic}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{course.description}</p>
                                
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase">Contents Preview:</p>
                                    <ul className="text-sm text-gray-600 dark:text-gray-300 pl-4 list-disc marker:text-purple-400">
                                        {course.concepts.slice(0, 3).map((c, i) => (
                                            <li key={i} className="truncate">{c}</li>
                                        ))}
                                        {course.concepts.length > 3 && (
                                            <li className="list-none text-xs text-gray-400 mt-1 italic">
                                                +{course.concepts.length - 3} more concepts
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center gap-2">
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => onSelect(course)}>
                                        View
                                    </Button>
                                    <Button size="sm" onClick={() => onImportLevel(course.concepts, course.topic)}>
                                        Teach This
                                    </Button>
                                </div>
                                <button 
                                    onClick={() => course.id && onDelete(course.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Delete Course"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Syllabus;
