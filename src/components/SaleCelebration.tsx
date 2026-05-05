import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star } from 'lucide-react';

export default function SaleCelebration({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100 }}
        className="relative"
      >
        <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400/50"></div>
        <Star className="text-yellow-400" size={128} fill="currentColor" />
        
        {/* Particle effect */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ 
              x: Math.cos((i * Math.PI) / 4) * 150, 
              y: Math.sin((i * Math.PI) / 4) * 150,
              opacity: 0,
              scale: 0 
            }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 w-4 h-4 bg-yellow-300 rounded-full"
          />
        ))}
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 text-center"
        >
          <h2 className="text-2xl font-black text-white whitespace-nowrap">Première vente !</h2>
          <p className="text-yellow-300 font-bold">Félicitations pour cet exploit !</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
