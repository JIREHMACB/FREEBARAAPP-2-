import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  media: { url: string; type: string }[];
  initialIndex: number;
}

export default function Lightbox({ isOpen, onClose, media, initialIndex }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
  }, [initialIndex, isOpen]);

  // FIX: useCallback pour éviter les re-subscriptions inutiles et les closures stales
  const handleNext = useCallback(() => {
    setZoom(1);
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  }, [media.length]);

  const handlePrev = useCallback(() => {
    setZoom(1);
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  }, [media.length]);

  // FIX: dépendances correctes — plus de `currentIndex` dans les deps
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || media.length === 0) return null;

  const currentMedia = media[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 z-[100] flex flex-col select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 z-10">
          <div className="text-white text-sm font-medium">
            {currentIndex + 1} / {media.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={20} />
            </button>
            <a
              href={currentMedia.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Download"
            >
              <Download size={20} />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: zoom }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-full flex items-center justify-center p-4"
            >
              {currentMedia.type === 'image' ? (
                <img
                  src={currentMedia.url}
                  alt={`Media ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain shadow-2xl"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              ) : (
                <video
                  src={currentMedia.url}
                  className="max-w-full max-h-full shadow-2xl"
                  controls
                  autoPlay
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          {media.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}
        </div>

        {/* Footer / Indicators */}
        {media.length > 1 && (
          <div className="p-6 flex justify-center gap-2 overflow-x-auto max-w-full scrollbar-hide">
            {media.map((item, idx) => (
              <button
                key={idx}
                onClick={() => { setZoom(1); setCurrentIndex(idx); }}
                className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? 'border-primary scale-110 shadow-lg shadow-primary/20'
                    : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                {item.type === 'image' ? (
                  <img src={item.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <ChevronRight size={16} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
