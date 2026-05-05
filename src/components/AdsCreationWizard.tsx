import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ChevronRight, Target, Layout, Target as TargetingIcon, DollarSign, Check, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function AdsCreationWizard({ company, onClose, onComplete }: { company: any, onClose: () => void, onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [placement, setPlacement] = useState<'feed' | 'story' | 'network'>('feed');
  const [data, setData] = useState({
    goal: 'Notoriété',
    product: '',
    image: '',
    content: { headline: '', description: '', cta: 'En savoir plus' },
    targeting: { location: 'Toute la zone', age: '18-65', interests: '' },
    budgetType: 'total' as 'total' | 'daily',
    budget: 5000,
    duration: 7
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Pour la simulation, on utilise une URL locale
      setData(d => ({ ...d, image: URL.createObjectURL(e.target.files![0]) }));
    }
  };

  const handleCreate = async () => {
    try {
      await api.ads.create({
        companyId: company.id,
        ...data
      });
      onComplete();
    } catch (err) {
      toast.error('Erreur lors de la création');
    }
  };

  const steps = [
    { id: 1, title: 'Objectif', icon: Target },
    { id: 2, title: 'Contenu', icon: Layout },
    { id: 3, title: 'Ciblage', icon: TargetingIcon },
    { id: 4, title: 'Budget', icon: DollarSign },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl flex flex-col md:flex-row h-[90vh]">
        
        {/* Left: Wizard */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r">
          <div className="p-6 border-b flex justify-between items-center text-slate-900">
            <h2 className="text-xl font-black">Créer une publicité</h2>
            <button onClick={onClose}><X /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Progress stepper */}
            <div className="flex justify-between mb-8">
              {steps.map(s => (
                <div key={s.id} className={`flex flex-col items-center gap-2 ${step >= s.id ? 'text-primary' : 'text-slate-300'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= s.id ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                    <s.icon size={20} />
                  </div>
                  <span className="text-xs font-bold">{s.title}</span>
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Quel est votre objectif ?</h3>
                {['Notoriété', 'Trafic', 'Engagement', 'Conversion'].map(goal => (
                  <button key={goal} onClick={() => setData(d => ({ ...d, goal }))} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between font-bold ${data.goal === goal ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                    {goal} {data.goal === goal && <Check className="text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Contenu publicitaire</h3>
                
                <div className="space-y-2">
                    <label className="text-sm font-bold">Produit à booster</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl" value={data.product} onChange={e => setData(d => ({ ...d, product: e.target.value }))}>
                        <option value="">Sélectionner un produit</option>
                        {company.catalog?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold">Visuel (Image/Vidéo)</label>
                    <label className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-primary">
                        <Upload className="text-slate-400" />
                        <span className="text-slate-500 font-bold">Charger un média</span>
                        <input type="file" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {data.image && <img src={data.image} className="h-20 w-20 object-cover rounded-xl" alt="Preview"/>}
                </div>

                <input placeholder="Titre accrocheur" className="w-full p-4 bg-slate-50 rounded-2xl" value={data.content.headline} onChange={e => setData(d => ({ ...d, content: { ...d.content, headline: e.target.value } }))} />
                <textarea placeholder="Description" className="w-full p-4 bg-slate-50 rounded-2xl h-32" value={data.content.description} onChange={e => setData(d => ({ ...d, content: { ...d.content, description: e.target.value } }))} />
                <button className="flex items-center gap-2 text-primary text-sm font-bold"><Sparkles size={16} /> Générer avec IA</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Ciblage intelligent IA</h3>
                <input placeholder="Centres d'intérêt" className="w-full p-4 bg-slate-50 rounded-2xl" value={data.targeting.interests} onChange={e => setData(d => ({ ...d, targeting: { ...d.targeting, interests: e.target.value } }))} />
                <p className="text-sm text-slate-500">L'IA suggère des audiences similaires basées sur vos clients actuels.</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Budget & Durée</h3>
                <div className="flex bg-slate-50 p-1 rounded-2xl">
                    <button onClick={() => setData(d=>({...d, budgetType: 'total'}))} className={`flex-1 py-3 rounded-xl font-bold ${data.budgetType === 'total' ? 'bg-white shadow' : ''}`}>Total</button>
                    <button onClick={() => setData(d=>({...d, budgetType: 'daily'}))} className={`flex-1 py-3 rounded-xl font-bold ${data.budgetType === 'daily' ? 'bg-white shadow' : ''}`}>Journalier</button>
                </div>
                <label>Budget {data.budgetType === 'total' ? 'total' : 'journalier'} (FCFA)</label>
                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl" value={data.budget} onChange={e => setData(d => ({ ...d, budget: Number(e.target.value) }))} />
                <label>Durée (jours)</label>
                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl" value={data.duration} onChange={e => setData(d => ({ ...d, duration: Number(e.target.value) }))} />
              </div>
            )}
          </div>

          <div className="p-6 border-t flex justify-end gap-2">
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 font-bold rounded-2xl bg-slate-100">Précédent</button>}
            {step < 4 ? 
              <button onClick={() => setStep(s => s + 1)} className="px-6 py-3 font-bold rounded-2xl bg-primary text-white flex items-center gap-2">Suivant <ChevronRight size={20} /></button> :
              <button onClick={handleCreate} className="px-6 py-3 font-bold rounded-2xl bg-slate-900 text-white">Confirmer le boostage</button>
            }
          </div>
        </div>

        {/* Right: Preview */}
        <div className="w-full md:w-80 bg-slate-50 p-6 flex flex-col gap-6">
            <h3 className="font-black text-slate-900">Aperçu</h3>
            <div className="flex bg-slate-200 p-1 rounded-full">
                {(['feed', 'story', 'network'] as const).map(p => (
                    <button key={p} onClick={() => setPlacement(p)} className={`flex-1 py-2 rounded-full text-xs font-bold capitalize ${placement === p ? 'bg-white shadow' : ''}`}>{p}</button>
                ))}
            </div>
            
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex gap-2 items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                    <div className="font-bold text-sm">{company.name}</div>
                </div>
                <div className="h-40 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">Visuel</div>
                <div className="font-bold">{data.content.headline || 'Titre publicitaire'}</div>
                <div className="text-xs text-slate-600 line-clamp-2">{data.content.description || 'Description de votre produit...'}</div>
                <button className="w-full py-2 bg-slate-100 rounded-xl text-xs font-bold">{data.content.cta}</button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
