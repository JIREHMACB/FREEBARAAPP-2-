import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_STORIES = [
  { id: 1, title: 'Story 1', mediaUrl: 'https://picsum.photos/seed/story1/400/700' },
  { id: 2, title: 'Story 2', mediaUrl: 'https://picsum.photos/seed/story2/400/700' },
  { id: 3, title: 'Story 3', mediaUrl: 'https://picsum.photos/seed/story3/400/700' },
  { id: 4, title: 'Story 4', mediaUrl: 'https://picsum.photos/seed/story4/400/700' },
];

export default function FeaturedStories() {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);

  const nextStory = () => {
    if (selectedStoryIndex !== null && selectedStoryIndex < MOCK_STORIES.length - 1) {
      setSelectedStoryIndex(selectedStoryIndex + 1);
    }
  };

  const prevStory = () => {
    if (selectedStoryIndex !== null && selectedStoryIndex > 0) {
      setSelectedStoryIndex(selectedStoryIndex - 1);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Stories à la une</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {MOCK_STORIES.map((story, index) => (
          <div
            key={story.id}
            className="flex-shrink-0 w-32 h-48 rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setSelectedStoryIndex(index)}
          >
            <img src={story.mediaUrl} alt={story.title} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedStoryIndex !== null && (
          <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4">
            <button
              onClick={() => setSelectedStoryIndex(null)}
              className="absolute top-4 right-4 p-2 text-white bg-black/50 rounded-full z-10"
            >
              <X size={24} />
            </button>
            <button
              onClick={prevStory}
              disabled={selectedStoryIndex === 0}
              className="absolute left-4 p-2 text-white bg-black/50 rounded-full disabled:opacity-30"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={nextStory}
              disabled={selectedStoryIndex === MOCK_STORIES.length - 1}
              className="absolute right-4 p-2 text-white bg-black/50 rounded-full disabled:opacity-30"
            >
              <ChevronRight size={32} />
            </button>
            <motion.img
              key={MOCK_STORIES[selectedStoryIndex].id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={MOCK_STORIES[selectedStoryIndex].mediaUrl}
              alt={MOCK_STORIES[selectedStoryIndex].title}
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
