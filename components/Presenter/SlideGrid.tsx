import React, { useState } from 'react';
import { SlideData } from '../../types';
import { Play, Trash2, GripVertical, Plus, Type } from 'lucide-react';
import Button from '../Button';

interface SlideGridProps {
    slides: SlideData[];
    onSelect: (index: number) => void;
    onDelete: (index: number) => void;
    onReorder: (newSlides: SlideData[]) => void;
    onAddTitleCard: () => void;
}

export const SlideGrid: React.FC<SlideGridProps> = ({ slides, onSelect, onDelete, onReorder, onAddTitleCard }) => {
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent drag image
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const newSlides = [...slides];
        const draggedItem = newSlides[draggedItemIndex];
        newSlides.splice(draggedItemIndex, 1);
        newSlides.splice(index, 0, draggedItem);
        
        onReorder(newSlides);
        setDraggedItemIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    return (
        <div className="p-6 bg-slate-100 dark:bg-slate-900 min-h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Presentation Deck</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Drag to reorder slides. Click play to start.</p>
                    </div>
                    <Button onClick={onAddTitleCard} className="flex items-center gap-2">
                        <Plus size={16} /> Add Title Card
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`
                                group relative bg-white dark:bg-slate-800 rounded-xl border-2 transition-all duration-200 hover:shadow-xl
                                ${draggedItemIndex === index ? 'opacity-50 border-indigo-500 border-dashed scale-95' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'}
                            `}
                        >
                            {/* Drag Handle */}
                            <div className="absolute top-2 left-2 z-20 p-1.5 bg-black/20 text-white rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical size={16} />
                            </div>

                            {/* Delete Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                                className="absolute top-2 right-2 z-20 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Slide"
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Content Preview */}
                            <div 
                                onClick={() => onSelect(index)}
                                className="aspect-video w-full overflow-hidden rounded-t-xl bg-white relative cursor-pointer"
                            >
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none transform scale-[0.5]">
                                    {slide.type === 'title' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-indigo-900 text-white p-8 text-center">
                                            <div>
                                                <Type size={48} className="mx-auto mb-4 opacity-50" />
                                                <h1 className="text-4xl font-bold">{slide.name}</h1>
                                            </div>
                                        </div>
                                    ) : (
                                        <div 
                                            className="w-[1920px] h-[1080px] bg-white flex items-center justify-center"
                                            dangerouslySetInnerHTML={{ __html: slide.svgContent }} 
                                        />
                                    )}
                                </div>
                                
                                {/* Overlay Play Icon */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all shadow-lg">
                                        <Play size={20} fill="currentColor" className="ml-1" />
                                    </div>
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate pr-2 text-sm">{slide.name}</h4>
                                    <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.5em]">
                                    {slide.fullNarrative}
                                </p>
                                <div className="mt-3 flex gap-2">
                                    {slide.type === 'title' && <span className="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Title</span>}
                                    {slide.annotationData && <span className="text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Annotated</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {/* Add Slide Placeholder */}
                    <button 
                        onClick={onAddTitleCard}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center min-h-[200px] text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                    >
                        <Plus size={40} className="mb-2" />
                        <span className="font-medium">Add Title Card</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
