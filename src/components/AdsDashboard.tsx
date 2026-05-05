import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, DollarSign, Clock, CheckCircle2, Loader2, Target, BarChart2, Layout, Star } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import AdsCreationWizard from './AdsCreationWizard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

// Simulation des données de performance
const performanceData = [
  { name: 'Lun', reach: 400, clicks: 24 },
  { name: 'Mar', reach: 300, clicks: 13 },
  { name: 'Mer', reach: 600, clicks: 38 },
  { name: 'Jeu', reach: 800, clicks: 50 },
  { name: 'Ven', reach: 500, clicks: 28 },
];

export default function AdsDashboard({ company }: { company: any }) {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdWizard, setShowAdWizard] = useState(false);
  const [view, setView] = useState<'campaigns' | 'performance'>('campaigns');

  useEffect(() => {
    fetchAds();
  }, [company.id]);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const data = await api.ads.getByCompany(company.id);
      setAds(data);
    } catch (err) {
      toast.error('Erreur lors de la récupération des campagnes');
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    { label: 'Portée', value: '45.2K', icon: Target },
    { label: 'Impressions', value: '88.4K', icon: Layout },
    { label: 'Engagement', value: '5.2K', icon: CheckCircle2 },
    { label: 'CTR', value: '2.4%', icon: BarChart2 },
    { label: 'Conversions', value: '128', icon: Star },
    { label: 'Coût/Résultat', value: '150 FCFA', icon: DollarSign },
    { label: 'ROI Estimé', value: '3.2x', icon: TrendingUp },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {showAdWizard && (
        <AdsCreationWizard 
          company={company} 
          onClose={() => setShowAdWizard(false)} 
          onComplete={() => {
            setShowAdWizard(false);
            fetchAds();
            toast.success('Publicité créée avec succès !');
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Gestion Publicitaire</h2>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setView('campaigns')} className={`px-4 py-2 rounded-xl font-bold ${view === 'campaigns' ? 'bg-white shadow' : ''}`}>Campagnes</button>
            <button onClick={() => setView('performance')} className={`px-4 py-2 rounded-xl font-bold ${view === 'performance' ? 'bg-white shadow' : ''}`}>Performances</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : view === 'performance' ? (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {metrics.map(m => (
                    <div key={m.label} className="bg-white p-6 rounded-[32px] border shadow-sm col-span-1">
                        <div className="text-slate-400 mb-2"><m.icon size={20} /></div>
                        <div className="text-2xl font-black">{m.value}</div>
                        <div className="text-sm text-slate-500 font-bold">{m.label}</div>
                    </div>
                ))}
            </div>
            <div className="bg-white p-8 rounded-[32px] border shadow-sm h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="reach" fill="#8884d8" name="Portée" />
                        <Bar dataKey="clicks" fill="#82ca9d" name="Clics" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white rounded-[32px] p-20 text-center border-2 border-dashed border-slate-200">
          <Target size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-900">Aucune campagne active</h3>
          <p className="text-slate-500 font-bold mt-2">Boostez votre boutique avec notre Assistant IA.</p>
          <button onClick={() => setShowAdWizard(true)} className="mt-6 px-6 py-3 bg-primary text-white rounded-2xl font-bold">Démarrer une campagne</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad: any) => (
            <div key={ad.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest">{ad.goal}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ad.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                  {ad.status === 'active' ? 'Active' : 'Terminée'}
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight">{ad.content.headline}</h3>
              <div className="text-sm text-slate-500 font-medium line-clamp-2">{ad.content.description}</div>
              <div className="flex justify-between pt-4 border-t border-slate-50 text-xs font-bold text-slate-700">
                <span>{ad.budget.toLocaleString()} FCFA ({ad.budgetType})</span>
                <span>{ad.duration} jours</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
