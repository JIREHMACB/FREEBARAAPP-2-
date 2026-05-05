import React, { useState, useEffect } from 'react';
import { History, Heart, Building2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface BusinessHistoryProps {
  favoriteCompanies: any[];
  recentCompanies: any[];
  onSelectCompany: (id: number) => void;
}

export default function BusinessHistory({ favoriteCompanies, recentCompanies, onSelectCompany }: BusinessHistoryProps) {

  // In a real app, we would fetch these companies by ID if they aren't in the current list
  // For now, we'll assume they might be passed or we just show the IDs/names if we had them
  // Since we don't have a "fetchByIds" easily available here without modifying api.tsx,
  // we'll just show favorites and whatever we can find in the current session.
  
  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-50 bg-slate-50/50">
        <h3 className="font-black text-slate-900 flex items-center gap-2">
          <History size={18} className="text-primary" />
          Votre activité
        </h3>
      </div>
      
      <div className="p-4 space-y-6">
        {/* Favorites */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Favoris</span>
            <Heart size={12} className="text-red-500 fill-current" />
          </div>
          {favoriteCompanies.length > 0 ? (
            <div className="space-y-2">
              {favoriteCompanies.slice(0, 5).map(company => (
                <button
                  key={company.id}
                  onClick={() => onSelectCompany(company.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                    {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{company.name}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{company.sector}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">Aucun favori</p>
          )}
        </div>

        {/* Recently Viewed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultés récemment</span>
            <History size={12} className="text-slate-400" />
          </div>
          {recentCompanies.length > 0 ? (
            <div className="space-y-2">
              {recentCompanies.map(company => (
                <button
                  key={company.id}
                  onClick={() => onSelectCompany(company.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                    {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{company.name}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{company.sector}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4 italic">L'historique s'affichera ici</p>
          )}
        </div>
      </div>
    </div>
  );
}
