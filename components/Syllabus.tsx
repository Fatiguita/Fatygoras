import React, { useState, useEffect, useMemo } from 'react';
import Button from './Button';
import Select from './Select';
import { SyllabusData, CourseLevel } from '../types';

interface SyllabusProps {
  data: SyllabusData | null;
  gallery: SyllabusData[];
  onGenerate: (topic: string, level: CourseLevel, description?: string) => Promise<void>;
  onGenerateProject?: (project: string, stack: string) => Promise<void>;
  isLoading: boolean;
  onImportLevel: (topics: string[], mainTopic: string) => void;
  onDelete: (id: string) => void;
  onSelect: (syllabus: SyllabusData) => void;
}

const Syllabus: React.FC<SyllabusProps> = ({ 
    data, gallery, onGenerate, onGenerateProject, isLoading, onImportLevel, onDelete, onSelect 
}) => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<CourseLevel>('Introduction');
  const [description, setDescription] = useState('');
  
  // Project Mode State
  const [mode, setMode] = useState<'academic' | 'project'>('academic');
  const [projectGoal, setProjectGoal] = useState('');
  const [techStack, setTechStack] = useState('');

  // Folder State
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Effect to populate form when data is selected
  useEffect(() => {
    if (data) {
        if (data.level.startsWith('Phase')) {
            setMode('project');
            setProjectGoal(data.topic.replace(/ - Part \d+$/, ''));
            // Tech stack is not strictly stored in SyllabusData, but we can leave it empty or guess
        } else {
            setMode('academic');
            setTopic(data.topic);
            setLevel(data.level);
            setDescription(data.description);
        }
    }
  }, [data]);

  // Grouping Logic
  const groupedGallery = useMemo(() => {
    const groups: Record<string, SyllabusData[]> = {};
    
    gallery.forEach(item => {
        let groupName = item.topic;
        // Normalize Project Names (remove " - Part X")
        if (item.level.startsWith('Phase')) {
             groupName = item.topic.replace(/ - Part \d+.*$/, '');
        }
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
    });

    return Object.entries(groups)
        .map(([name, items]) => ({
            name,
            items,
            latestTimestamp: Math.max(...items.map(i => i.timestamp || 0))
        }))
        .sort((a, b) => b.latestTimestamp - a.latestTimestamp); // Newest groups first
  }, [gallery]);

  // Auto-expand the first group if only one exists or if a new item was just added (simple heuristic)
  useEffect(() => {
      if (groupedGallery.length === 1 && !expandedGroups[groupedGallery[0].name]) {
          setExpandedGroups({ [groupedGallery[0].name]: true });
      }
  }, [groupedGallery.length]); // Only run when group count changes

  const toggleGroup = (name: string) => {
      setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getSortedItems = (items: SyllabusData[]) => {
      const isProject = items.some(i => i.level.startsWith('Phase'));
      if (isProject) {
          // Sort Projects by Phase Number (Ascending)
          return [...items].sort((a, b) => {
              const pA = parseInt(a.level.match(/\d+/)?.[0] || '0');
              const pB = parseInt(b.level.match(/\d+/)?.[0] || '0');
              return pA - pB;
          });
      }
      // Sort Academic by Difficulty Level
      const order = ['Introduction', 'Beginner', 'Intermediate', 'Advanced', 'Master'];
      return [...items].sort((a, b) => {
          const idxA = order.indexOf(a.level);
          const idxB = order.indexOf(b.level);
          // If unknown level, fall back to timestamp
          if (idxA === -1 || idxB === -1) return (a.timestamp || 0) - (b.timestamp || 0);
          return idxA - idxB;
      });
  };

  const LEVEL_OPTIONS = [
    { label: 'Introduction', value: 'Introduction' },
    { label: 'Beginner', value: 'Beginner' },
    { label: 'Intermediate', value: 'Intermediate' },
    { label: 'Advanced', value: 'Advanced' },
    { label: 'Master', value: 'Master' },
  ];

  const handleCreate = () => {
    if (mode === 'academic') {
        if (!topic.trim()) return;
        onGenerate(topic, level, description);
        // Auto expand this group after generation
        setExpandedGroups(prev => ({ ...prev, [topic]: true }));
    } else {
        if (!projectGoal.trim()) return;
        if (onGenerateProject) {
            onGenerateProject(projectGoal, techStack);
            // Auto expand
            setExpandedGroups(prev => ({ ...prev, [projectGoal]: true }));
        }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      
      <div className="text-center mb-10 animate-fade-in">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
          Curriculum Architect
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Design your own learning path. Generate a structured syllabus or reverse-engineer a project into milestones.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-y-auto scroll-smooth mb-12 animate-fade-in">
          {/* Mode Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button 
                  onClick={() => setMode('academic')}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'academic' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 border-b-2 border-purple-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
              >
                  🎓 Academic Curriculum
              </button>
              <button 
                  onClick={() => setMode('project')}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'project' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-750'}`}
              >
                  🛠️ Project Architect
              </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
              {mode === 'academic' ? (
                  <>
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Subject / Topic</label>
                        <input 
                            type="text" 
                            value={topic} 
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Astrophysics, React Hooks, Ancient Rome..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1">
                            <Select 
                                label="Difficulty Level"
                                options={LEVEL_OPTIONS}
                                value={level}
                                onChange={(e) => setLevel(e.target.value as CourseLevel)}
                                className="h-[50px]"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="flex-[2]">
                             <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Specific Focus (Optional)</label>
                             <input 
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="e.g. Focus on practical examples over theory..."
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all h-[50px]"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                  </>
              ) : (
                  <>
                     <div>
                        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">What do you want to build?</label>
                        <input 
                            type="text" 
                            value={projectGoal} 
                            onChange={(e) => setProjectGoal(e.target.value)}
                            placeholder="e.g. A Spotify Clone, A Search Engine, A 2D Physics Engine..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                         <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Tech Stack / Constraints (Optional)</label>
                         <input 
                            type="text"
                            value={techStack}
                            onChange={(e) => setTechStack(e.target.value)}
                            placeholder="e.g. React & Node.js, No external libraries, Python only..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            disabled={isLoading}
                        />
                    </div>
                  </>
              )}

              <Button 
                onClick={handleCreate} 
                disabled={isLoading || (mode === 'academic' ? !topic.trim() : !projectGoal.trim())} 
                className={`w-full py-4 text-lg font-bold shadow-lg transform transition-transform active:scale-[0.98] ${mode === 'project' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'}`}
              >
                {isLoading 
                    ? (mode === 'academic' ? "Designing Curriculum..." : "Architecting Solution...") 
                    : (mode === 'academic' ? "Generate Syllabus" : "Draft Project Blueprint")
                }
              </Button>
          </div>
      </div>

      <div className="space-y-6">
        {groupedGallery.map(group => {
            const isExpanded = expandedGroups[group.name];
            return (
                <div key={group.name} className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm transition-all duration-300">
                    <button 
                        onClick={() => toggleGroup(group.name)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                {isExpanded ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                )}
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{group.name}</h3>
                                <span className="text-xs text-gray-500">{group.items.length} module{group.items.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    
                    {/* Collapsible Content */}
                    <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="p-4 pt-0 grid grid-cols-1 gap-4 border-t border-gray-100 dark:border-gray-800 mt-2">
                            {getSortedItems(group.items).map(item => (
                                <div key={item.id} className="group/card relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${item.level.startsWith('Phase') ? 'bg-indigo-500' : 'bg-purple-500'}`}></div>
                                    
                                    <div className="p-6 pl-8">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`inline-block px-2 py-1 text-xs font-bold uppercase tracking-wider rounded mb-2 ${item.level.startsWith('Phase') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                                                    {item.level}
                                                </span>
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{item.topic}</h4>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => onSelect(item)}
                                                    className="text-gray-400 hover:text-blue-500 p-1 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    title="Load settings to form"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => item.id && onDelete(item.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    title="Delete Syllabus"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 italic border-l-2 border-gray-200 dark:border-gray-600 pl-3 line-clamp-2">
                                            {item.description}
                                        </p>

                                        <div className="mb-4">
                                            <div className="flex justify-between items-end mb-2">
                                                <h5 className="text-[10px] font-bold uppercase text-gray-500">Core Concepts</h5>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {item.concepts.map((c, i) => (
                                                    <button 
                                                        key={i} 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            onImportLevel([c], item.topic);
                                                        }}
                                                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-full border border-gray-200 dark:border-gray-600 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 hover:border-blue-300 transition-colors flex items-center gap-1 group/chip text-left"
                                                        title={`Generate lesson for: ${c}`}
                                                    >
                                                        <span className="font-mono opacity-50 mr-0.5 font-bold">{i + 1}.</span>
                                                        {c}
                                                        <svg className="w-2.5 h-2.5 opacity-0 group-hover/chip:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <Button 
                                                onClick={() => onImportLevel(item.concepts, item.topic)}
                                                size="sm"
                                                className={`text-xs ${item.level.startsWith('Phase') ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                                            >
                                                Generate All ({item.concepts.length})
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        })}
        
        {groupedGallery.length === 0 && !isLoading && (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                <p className="text-gray-400">No syllabus created yet.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Syllabus;
