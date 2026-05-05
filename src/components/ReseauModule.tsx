import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Maximize2, Calendar, Map as MapIcon, TrendingUp, ShoppingCart, Clock, CheckCircle2, Package, ArrowUpRight, Users, DollarSign, Camera, Check, Edit3, Trash2, Layers, Activity, Church, MapPin, Plus, Image as ImageIcon, Landmark } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import InstitutionSpace from './InstitutionSpace';
import Network from '../pages/Network';
import JCEMap from './JCEMap';

const PDF_PAGES = Array.from({ length: 18 }, (_, i) => `https://picsum.photos/seed/jce${i + 1}/400/600`);

const ORGANS = [
  { name: 'JCE (La Base)', description: 'Organisation fédérative de base.', fullDescription: 'Organisation fédérative de base qui rassemble les membres locaux et coordonne les actions sur le terrain. Elle est le cœur de notre mouvement, permettant à chaque membre de s\'engager activement.', mission: 'Fédérer et structurer les initiatives locales.', link: '/jce/base' },
  { name: 'JCE GLOBAL', description: 'Fonds d\'investissement.', fullDescription: 'Fonds d\'investissement dédié au soutien des projets à fort impact. Nous accompagnons financièrement et stratégiquement les initiatives de nos membres pour maximiser leur réussite.', mission: 'Financer les projets innovants et durables.', link: '/jce/global' },
  { name: 'BOOSTIZY', description: 'Agence créative officielle.', fullDescription: 'Agence créative officielle de la JCE, spécialisée dans la communication, le design et le branding pour mettre en valeur nos actions et renforcer notre image de marque.', mission: 'Accompagner la communication et le branding.', link: '/jce/boostizy' },
  { name: 'JCE Connect', description: 'Plateforme digitale de réseautage.', fullDescription: 'Plateforme digitale exclusive permettant aux membres de se connecter, d\'échanger des opportunités professionnelles et de collaborer efficacement sur des projets communs.', mission: 'Faciliter les connexions entre membres.', link: '/jce/connect' },
];

const ACTIVITIES = [
  { id: 1, title: 'Conférence Leadership', date: '15/04/2026', type: 'À venir', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { id: 2, title: 'Atelier Networking', date: '20/04/2026', type: 'À venir', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { id: 3, title: 'Gala Annuel', date: '01/03/2026', type: 'Passée', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { id: 4, title: 'Formation Management', date: '15/02/2026', type: 'Passée', video: 'https://www.w3schools.com/html/mov_bbb.mp4' },
];

export default function ReseauModule() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('reseau');

  useEffect(() => {
    if (searchParams.get('lat') && searchParams.get('lng')) {
      setActiveTab('carte');
    }
  }, [searchParams]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [expandedOrgans, setExpandedOrgans] = useState<string[]>([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    api.users.me().then(setCurrentUser).catch(console.error);
  }, []);

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 0 : prev + 1));
    }, 50);
    return () => clearInterval(interval);
  }, [activityIndex]);
  
  // Eglise state removed
  const [loadingChurches, setLoadingChurches] = useState(false); // keep state to avoid breaking rest of code if referenced


  useEffect(() => {
  }, []);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % PDF_PAGES.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + PDF_PAGES.length) % PDF_PAGES.length);

  const nextActivity = () => setActivityIndex((prev) => (prev + 1) % ACTIVITIES.length);
  const prevActivity = () => setActivityIndex((prev) => (prev - 1 + ACTIVITIES.length) % ACTIVITIES.length);

  const toggleOrgan = (name: string) => {
    setExpandedOrgans(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // Church methods removed 


  const TABS = [
    { id: 'reseau', label: 'Réseau', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'institutions', label: 'Institutions', icon: Landmark, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ];

  return (
    <div className="space-y-8">
      {/* Modern Tab Navigation */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {TABS.map((tab) => (
          <motion.button
            key={tab.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all ${
              activeTab === tab.id 
              ? `${tab.bg} ${tab.border} shadow-lg shadow-slate-100` 
              : 'bg-white border-transparent hover:border-slate-100'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${activeTab === tab.id ? 'bg-white shadow-sm' : tab.bg}`}>
              <tab.icon size={24} className={tab.color} />
            </div>
            <span className={`text-xs font-black uppercase tracking-widest ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400'}`}>
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className={`h-1 w-8 rounded-full mt-2 ${tab.color.replace('text', 'bg')}`}
              />
            )}
          </motion.button>
        ))}
      </div>

      <div className={`p-1 rounded-[40px] shadow-sm border transition-all duration-500 ${
        activeTab === 'institutions' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-emerald-50/30 border-emerald-100'
      }`}>
        <div className="p-6 sm:p-8 bg-white/40 backdrop-blur-sm rounded-[39px]">
          <AnimatePresence mode="wait">
            {activeTab === 'reseau' && (
              <motion.div key="reseau" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Network />
              </motion.div>
            )}
            {activeTab === 'institutions' && (
              <motion.div key="institutions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <InstitutionSpace />
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>

    {/* Church modal removed */}

    </div>
  );
}
