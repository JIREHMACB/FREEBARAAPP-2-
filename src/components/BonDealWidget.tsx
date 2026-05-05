import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';

export default function BonDealWidget() {
  const [products, setProducts] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    api.companies.getPromotions().then(setProducts);
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % products.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [products]);

  if (products.length === 0) return null;

  const product = products[currentIndex];
  let imageUrl = null;
  try {
    const urls = product.imageUrls ? JSON.parse(product.imageUrls) : null;
    imageUrl = (urls && Array.isArray(urls) && urls[0]) || product.imageUrl || null;
  } catch(e) {}

  return (
    <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 shadow-xl text-white overflow-hidden relative">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-yellow-300" size={20}/>
        <h3 className="font-black tracking-widest uppercase text-sm">Bon Deal</h3>
      </div>
      
      <AnimatePresence mode='wait'>
        <motion.div
          key={product.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex gap-4 items-center"
        >
          {imageUrl && <img src={imageUrl} alt={product.name} className="w-20 h-20 rounded-xl object-cover bg-white/20"/>}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-lg truncate">
              {product.name} {product.tagValue ? `-${product.tagValue}%` : ''}
            </h4>
            <p className="text-orange-100 text-sm font-medium truncate">{product.tag === 'Promotion' ? 'BON DEAL' : product.tag}</p>
          </div>
          <button 
            onClick={() => window.location.href = `/business?id=${product.companyId}`}
            className="flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap"
          >
            Découvrir <ArrowRight size={16} />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
