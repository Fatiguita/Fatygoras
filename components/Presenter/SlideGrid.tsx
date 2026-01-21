import React from 'react';
import { SlideData } from '../../types';
import { PlayCircle, Trash2 } from 'lucide-react'; // Importing icons from lucide-react

interface SlideGridProps {
  slides: SlideData[]; // Array of slide data to display
  onSelect: (index: number) => void; // Callback when a slide is selected for presentation
  onDelete: (index: number) => void; // Callback when a slide is to be deleted
}

/**
 * Renders a grid view of all slides, allowing users to preview, select, and delete them.
 *
 * @param {SlideGridProps} { slides, onSelect, onDelete }
 * @returns {JSX.Element} The slide grid component.
 */
export const SlideGrid: React.FC<SlideGridProps> = ({ slides, onSelect, onDelete }) => {
  return (
    // Main container for the slide grid. Adapts layout for different screen sizes.
    <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 bg-slate-50 dark:bg-gray-900 min-h-full overflow-y-auto">
      {slides.map((slide, idx) => (
        // Each slide card in the grid
        <div
          key={slide.id} // Unique key for React list rendering
          className="group relative aspect-video bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-blue-400 overflow-hidden flex flex-col cursor-pointer"
        >
          {/* Main Click Area for selecting a slide */}
          <div 
            onClick={() => onSelect(idx)} // Triggers presentation mode for this slide
            className="flex-1 w-full p-2 overflow-hidden bg-slate-100 dark:bg-gray-700 relative"
          >
             {/* Mini Preview of the SVG content */}
            <div 
                className="w-full h-full pointer-events-none scale-75 origin-center" // Scale down for preview
                dangerouslySetInnerHTML={{ __html: slide.svgContent }} // Render the SVG content directly
            />
            {/* Overlay for Play button on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                <PlayCircle className="text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition" size={48} />
            </div>
          </div>

          {/* Footer Info for each slide card */}
          <div className="h-10 px-3 flex items-center justify-between bg-white dark:bg-gray-800 text-xs text-slate-600 dark:text-gray-300 font-medium border-t border-gray-200 dark:border-gray-700 w-full">
             {/* Slide number and name, truncated if too long */}
             <span className="truncate max-w-[70%]">{idx + 1}. {slide.name}</span>
             
             {/* Delete Action button */}
             <button 
                onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering onSelect when deleting
                    onDelete(idx); // Calls the delete handler
                }}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded transition"
                title="Delete Slide"
             >
                <Trash2 size={14} /> {/* Trash icon */}
             </button>
          </div>
        </div>
      ))}
      
      {/* Message displayed when no slides are available */}
      {slides.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center text-slate-400 mt-20">
              <p>No slides available. Generate content in Classroom first.</p>
          </div>
      )}
    </div>
  );
};
