import React, { useState } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, GraduationCap, Briefcase, Wrench, CheckSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import Network from './Network';
import Pannel from './Pannel';
import Offers from '../components/Offers';
import Talents from '../components/Talents';
import Tools from '../components/Tools';
import Tasks from './Tasks';

export default function Communities() {
  const [activeTab, setActiveTab] = useState<'pannel' | 'offres' | 'taches' | 'outils'>('pannel');

  const { isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 blur-3xl rounded-full"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-indigo-500/20 blur-2xl rounded-full"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/10 backdrop-blur-xl rounded-[32px] flex items-center justify-center text-white shadow-xl border border-white/20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <Users size={40} className="drop-shadow-md" />
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-sm">Boîte à outils</h1>
            <p className="text-indigo-100 text-lg sm:text-xl font-medium max-w-xl">Accédez à vos outils de création, ressources de développement et opportunités de croissance pour concrétiser vos projets.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/80 backdrop-blur-md p-2 rounded-3xl shadow-sm border border-slate-100 w-full overflow-x-auto scrollbar-hide mb-8 sticky top-4 z-30">
        {[
          { id: 'pannel', label: 'Pannels', icon: GraduationCap, color: 'text-purple-500', bg: 'bg-purple-50', activeBg: 'bg-purple-500' },
          { id: 'offres', label: 'Annonces', icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50', activeBg: 'bg-amber-500' },
          { id: 'taches', label: 'Tâches', icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-500' },
          { id: 'outils', label: 'Outils', icon: Wrench, color: 'text-emerald-500', bg: 'bg-emerald-50', activeBg: 'bg-emerald-500' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? `${tab.activeBg} text-white shadow-lg shadow-${tab.activeBg.split('-')[1]}-500/30 transform scale-[1.02]` 
                : `text-slate-500 hover:text-slate-900 hover:${tab.bg}`
            }`}
          >
            <div className={`p-2 rounded-xl ${activeTab === tab.id ? 'bg-white/20' : tab.bg}`}>
              <tab.icon size={20} className={activeTab === tab.id ? 'text-white' : tab.color} />
            </div>
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pannel' ? (
          <motion.div
            key="pannel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Pannel />
          </motion.div>
        ) : activeTab === 'offres' ? (
          <motion.div
            key="offres"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Talents />
            <Offers />
          </motion.div>
        ) : activeTab === 'taches' ? (
          <motion.div
            key="taches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Tasks />
          </motion.div>
        ) : (
          <motion.div
            key="outils"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Tools />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
