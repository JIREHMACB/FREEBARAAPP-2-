import React, { useMemo } from 'react';
import { Sparkles, ShoppingBag, ChevronRight, Plus, Heart, Share2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrls: string;
  imageUrl?: string;
  companyId: number;
  companyName: string;
  tag?: string;
  tagValue?: string;
  isFavorite?: boolean;
  favoritesCount?: number;
  shares_count?: number;
}

interface ProductSuggestionsProps {
  products: Product[];
  onSelectProduct: (product: any) => void;
  onToggleFavorite: (product: any) => void;
  onShare: (product: any) => void;
}

export default function ProductSuggestions({ products, onSelectProduct, onToggleFavorite, onShare }: ProductSuggestionsProps) {
  const suggestions = useMemo(() => {
    return products.filter(p => p.tag === 'Promotion' || p.tag === 'Offre flash');
  }, [products]);

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pour vous</h2>
          <p className="text-slate-500 text-sm font-medium">Offres spéciales et flash</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {suggestions.map((product, idx) => {
          let imageUrl = '';
          try {
            const urls = product.imageUrls ? JSON.parse(product.imageUrls) : null;
            imageUrl = (urls && Array.isArray(urls) && urls[0]) || product.imageUrl;
          } catch(e) {}

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm group relative"
            >
              <div className="aspect-square bg-slate-50 relative overflow-hidden" onClick={() => onSelectProduct(product)}>
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon size={40} />
                  </div>
                )}
                
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }}
                    className={`p-1.5 rounded-full shadow-sm backdrop-blur-md transition-all ${product.isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-600 hover:text-red-500'}`}
                  >
                    <Heart size={14} fill={product.isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onShare(product); }}
                    className="p-1.5 bg-white/90 backdrop-blur-md rounded-full text-slate-600 hover:text-primary shadow-sm"
                  >
                    <Share2 size={14} />
                  </button>
                </div>
                
                {/* Tag Badge */}
                {product.quantity === 0 && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm">
                    Rupture de stock
                  </div>
                )}
                {product.tag && product.quantity > 0 && (
                    <div className={`absolute top-2 left-2 ${product.tag === 'Promotion' ? 'bg-orange-500' : 'bg-red-600'} text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm flex items-center gap-2`}>
                      <span>{product.tag} {product.tagValue ? (product.tag === 'Promotion' ? `-${product.tagValue}%` : `${product.tagValue}F`) : ''}</span>
                    </div>
                )}
              </div>
              <div className="p-4 space-y-1 cursor-pointer" onClick={() => product.quantity > 0 && onSelectProduct(product)}>
                <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest truncate">{product.companyName}</p>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col">
                    {(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue && (
                      <span className="text-slate-400 font-medium text-xs line-through">{product.price.toLocaleString()} F</span>
                    )}
                    <span className="text-slate-900 font-black text-sm">{(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue 
                          ? (product.price * (1 - parseInt(product.tagValue) / 100)).toLocaleString() 
                          : product.price.toLocaleString()} F</span>
                  </div>
                  {product.quantity > 0 && (
                    <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                      <Plus size={14} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
