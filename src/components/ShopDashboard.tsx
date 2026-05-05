import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, ShoppingCart, Package, Users, 
  Plus, Edit3, Trash2, ChevronRight, Calendar,
  ArrowUpRight, ArrowDownRight, DollarSign,
  Clock, CheckCircle2, XCircle, MoreVertical, ShieldCheck, Target, Video, FileText, Upload,
  Image as ImageIcon, X, Search, Sparkles, Tag, Loader2, Lightbulb, Check, Award, Star, LayoutDashboard, ShieldAlert,
  Plane, Bed, BarChart3, Users as UsersIcon
} from 'lucide-react';

import { api, socket } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { getAI, safeGenerateContent, Type } from '../lib/gemini';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar
} from 'recharts';
import AdsDashboard from './AdsDashboard';
import SaleCelebration from './SaleCelebration';

interface ShopDashboardProps {
  company: any;
  onClose: () => void;
  initialTab?: 'shops' | 'orders' | 'stock' | 'dashboard' | 'assistant' | 'score' | 'funding' | 'ads' | 'reservations';
}

const MotionDiv = motion.div;

function AssistantTab({ insights, orders, catalog, stock, company, transactions }: { 
  insights: any, 
  orders: any[], 
  catalog: any[], 
  stock: any[], 
  company: any,
  transactions: any[]
}) {
  const [activeSubTab, setActiveSubTab] = useState<'operations' | 'orders' | 'shops' | 'stock'>('operations');
  const [mode, setMode] = useState<'analysis' | 'mentor'>('analysis');
  const [autoPilot, setAutoPilot] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [selectedExpertAction, setSelectedExpertAction] = useState<any>(null);
  const [isAnalyzingExpert, setIsAnalyzingExpert] = useState(false);
  const [expertActions, setExpertActions] = useState<any[]>([]);
  const [loadingMentor, setLoadingMentor] = useState(false);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const iconMap: Record<string, any> = {
    'Users': Users,
    'Package': Package,
    'Tag': Tag,
    'TrendingUp': TrendingUp,
    'ShoppingCart': ShoppingCart,
    'DollarSign': DollarSign
  };

  const fetchMentorInsights = async () => {
    if (loadingMentor) return;
    try {
      setLoadingMentor(true);
      
      const shopContext = {
        name: company.name,
        sector: company.sector,
        insights,
        catalog: (catalog || []).map(p => ({ name: p.name, price: p.price, tag: p.tag })),
        recentOrders: (orders || []).slice(0, 10),
        lowStock: (stock || []).filter(s => s.quantity <= s.minQuantity),
        financials: {
          balance: transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0),
          recentTransactions: transactions.slice(0, 10)
        }
      };

      const prompt = `En tant que Mentor en Business Intelligence EXTRÊMEMENT PRÉCIS pour la boutique "${company.name}", analyse les données opérationnelles et financières RÉELLES suivantes pour générer 3 actions stratégiques prioritaires.
      
      DONNÉES OPÉRATIONNELLES ET FINANCIÈRES :
      ${JSON.stringify(shopContext)}

      DIRECTIVES :
      - Analyse le ratio stock/ventes pour identifier les surstocks ou ruptures imminentes.
      - Examine les flux de trésorerie récents pour suggérer des optimisations de budget.
      - Identifie les produits "vaches à lait" vs les "poids morts".
      - Propose des recommandations strictement basées sur les chiffres fournis.

      RETOURNE UNIQUEMENT UN JSON :
      {
        "actions": [
          {
            "id": "unique_id",
            "title": "Titre court",
            "desc": "Description concise",
            "iconName": "Users | Package | Tag | TrendingUp | ShoppingCart | DollarSign",
            "impact": "Critique | Haut | Moyen",
            "complexity": "Basse | Moyenne | Haute",
            "roi": "Gain estimé (ex: +15% CA)",
            "deepAnalysis": "Analyse détaillée expliquant l'opportunité chiffrée",
            "steps": ["Étape 1", "Étape 2"]
          }
        ]
      }`;

      const response = await safeGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    desc: { type: Type.STRING },
                    iconName: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    complexity: { type: Type.STRING },
                    roi: { type: Type.STRING },
                    deepAnalysis: { type: Type.STRING },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["id", "title", "desc", "iconName", "impact", "complexity", "roi", "deepAnalysis", "steps"]
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response?.text || '{"actions": []}');
      setExpertActions(result.actions || []);
    } catch (err) {
      console.error(err);
      toast.error('Erreur Mentor IA');
    } finally {
      setLoadingMentor(false);
    }
  };

  useEffect(() => {
    if (mode === 'mentor' && expertActions.length === 0 && !loadingMentor) {
      fetchMentorInsights();
    }
  }, [mode]);

  const handleAnalysExpert = (action: any) => {
    setIsAnalyzingExpert(true);
    setSelectedExpertAction(null);
    
    // Simulate deep AI thinking (the analysis is already in action.deepAnalysis)
    setTimeout(() => {
      setIsAnalyzingExpert(false);
      setSelectedExpertAction(action);
    }, 1500);
  };

  const runAnalysis = async (tab: 'operations' | 'orders' | 'shops' | 'stock') => {
    if (loading) return;
    try {
      setLoading(true);
      
      let dataToAnalyze = "";
      let focus = "";
      
      const financialContext = `Données financières (CA, Dépenses) : ${JSON.stringify(transactions.slice(0, 20))}`;
      
      if (tab === 'operations') {
        dataToAnalyze = `Insights Globaux : ${JSON.stringify(insights)}\n${financialContext}`;
        focus = "les KPIs de performance, la rentabilité financière et l'efficacité opérationnelle";
      } else if (tab === 'orders') {
        dataToAnalyze = `Historique Commandes : ${JSON.stringify(orders.slice(0, 30))}\n${financialContext}`;
        focus = "le comportement d'achat et l'optimisation des revenus par client";
      } else if (tab === 'stock') {
        dataToAnalyze = `État Stock : ${JSON.stringify((stock || []).map(s => ({ productName: s.productName, quantity: s.quantity, minQty: s.minQuantity })))}
        \nArticles Catalogue : ${JSON.stringify((catalog || []).map(p => ({ name: p.name, price: p.price })))}
        \nTransactions liées au stock : ${JSON.stringify((transactions || []).filter(t => t.category === 'Fournitures' || t.category === 'Autre').slice(0, 10))}`;
        focus = "la gestion de l'inventaire et l'impact financier des ruptures/surstocks";
      } else {
        dataToAnalyze = `Catalogue : ${JSON.stringify((catalog || []).map(p => ({ name: p.name, price: p.price, category: p.category, tag: p.tag })))}\nPerformances par Produit : ${JSON.stringify(insights?.topProducts || [])}`;
        focus = "la stratégie de prix, le merchandising, l'attractivité des offres promotionnelles et le positionnement marché";
      }

      const prompt = `Expert Strategique IA pour "${company.name}". Secteur: ${company.sector}. 
      Analyse ces données OPÉRATIONNELLES ET FINANCIÈRES pour fournir des recommandations stratégiques.
      
      FOCUS : ${focus}.
      
      DONNÉES :
      ${dataToAnalyze}
      
      CONSIGNES :
      - Sois extrêmement précis. Cite des chiffres (CA, montants de transactions, volumes de stock).
      - Propose des actions pour augmenter le profit net.
      
      FORMAT DE RÉPONSE (JSON uniquement) :
      {
        "summary": "Résumé analytique contextuel",
        "solutions": "Paragraphe de recommandations",
        "challenges": [
          {
            "title": "...",
            "description": "...",
            "action": "...",
            "deadline": "...",
            "impact": "Haut | Moyen | Bas"
          }
        ]
      }`;

      const response = await safeGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              solutions: { type: Type.STRING },
              challenges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    action: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    impact: { type: Type.STRING }
                  },
                  required: ["title", "description", "action", "deadline", "impact"]
                }
              }
            },
            required: ["summary", "solutions", "challenges"]
          }
        }
      });

      const analysisResult = JSON.parse(response?.text || '{}');
      setAnalysis(prev => ({ ...prev, [tab]: analysisResult }));
    } catch (err) {
      console.error(err);
      toast.error('Erreur Analyse IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis[activeSubTab] && !loading) {
      runAnalysis(activeSubTab);
    }
  }, [activeSubTab]);

  const currentAnalysis = analysis[activeSubTab];

  return (
    <div className="space-y-8">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 p-8 rounded-[32px] border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Assistant Stratégique IA</h2>
              </div>
              
              <div className="flex p-1 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50">
                <button onClick={() => setMode('analysis')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${mode === 'analysis' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-white/50'}`}>Analyse rapide</button>
                <button onClick={() => setMode('mentor')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${mode === 'mentor' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-white/50'}`}>Mentor</button>
              </div>
            </div>
            
            {mode === 'analysis' && (
              <>
                <p className="text-slate-600 font-medium max-w-2xl mb-6">
                  L'IA analyse vos données pour vous proposer des stratégies ciblées par section.
                </p>
                
                <div className="flex flex-wrap gap-2 p-1 bg-white border border-slate-100 rounded-2xl w-fit mt-6 shadow-sm">
                  {[
                    { id: 'operations', label: 'Opérations', icon: TrendingUp },
                    { id: 'orders', label: 'Commandes', icon: ShoppingCart },
                    { id: 'shops', label: 'Boutique', icon: Package },
                    { id: 'stock', label: 'Stock', icon: Package }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id as any)}
                      className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                        activeSubTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900 bg-slate-50'
                      }`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode === 'mentor' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-slate-900 font-bold text-lg">
                      Business Intelligence Mentor
                    </p>
                    <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
                      Analyse prédictive en temps réel • {autoPilot ? 'Mode Autonome' : 'Mode Conseil'}
                      <button 
                        onClick={fetchMentorInsights} 
                        disabled={loadingMentor}
                        className="ml-2 p-1 hover:bg-slate-100 rounded-md transition-colors text-primary"
                        title="Rafraîchir les analyses"
                      >
                        <Loader2 size={14} className={loadingMentor ? 'animate-spin' : ''} />
                      </button>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${autoPilot ? 'text-primary' : 'text-slate-400'}`}>
                        Auto-Pilot Engine
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">V 2.4.0 High-Perf</span>
                    </div>
                    <button 
                      onClick={() => setAutoPilot(!autoPilot)} 
                      className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${autoPilot ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                       <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${autoPilot ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {loadingMentor ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="bg-white/40 h-48 rounded-[32px] animate-pulse"></div>
                    ))
                  ) : (
                    expertActions.map((act, idx) => {
                      const Icon = iconMap[act.iconName] || Lightbulb;
                      return (
                        <motion.div 
                          key={`${act.id}-${idx}`} 
                          onClick={() => setExpandedActionId(expandedActionId === act.id ? null : act.id)}
                          whileHover={{ y: -4 }}
                          className={`bg-white/80 backdrop-blur-sm p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all space-y-4 group cursor-pointer ${expandedActionId === act.id ? 'md:col-span-3' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                               selectedExpertAction?.id === act.id ? 'bg-primary text-white' : 'bg-primary/5 text-primary group-hover:bg-primary/10'
                             }`}>
                                <Icon size={24} />
                             </div>
                             <div className="flex flex-col items-end gap-1">
                               <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                 act.impact === 'Critique' ? 'bg-red-100 text-red-600' : 
                                 act.impact === 'Haut' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                               }`}>
                                 {act.impact}
                               </span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ROI: {act.roi}</span>
                             </div>
                          </div>

                          <div>
                            <h4 className="font-black text-slate-900 text-lg tracking-tight mb-1">{act.title}</h4>
                            <p className={`text-xs text-slate-500 font-medium leading-relaxed ${expandedActionId === act.id ? '' : 'line-clamp-2'}`}>{act.depthDescription || act.desc}</p>
                          </div>

                          {expandedActionId === act.id && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="pt-4 border-t border-slate-100 space-y-4"
                            >
                              <div>
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Analyse profonde</h5>
                                <p className="text-xs text-slate-700 leading-relaxed">{act.deepAnalysis}</p>
                              </div>
                              <div>
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Étapes d'exécution</h5>
                                <div className="space-y-2">
                                  {act.steps?.map((step: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{i+1}</div>
                                      {step}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}

                          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                             <div className="flex flex-col">
                               <span className="text-[9px] font-black text-slate-400 uppercase">Complexité</span>
                               <span className="text-xs font-bold text-slate-700">{act.complexity}</span>
                             </div>
                             {autoPilot ? (
                               <div className="flex items-center gap-1.5 text-primary animate-pulse">
                                 <CheckCircle2 size={14} />
                                 <span className="text-[10px] font-black uppercase">Optimisé</span>
                               </div>
                             ) : (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleAnalysExpert(act); }}
                                 disabled={isAnalyzingExpert}
                                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                   selectedExpertAction?.id === act.id 
                                   ? 'bg-slate-900 text-white' 
                                   : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'
                                 }`}
                               >
                                 {isAnalyzingExpert ? 'Analyse...' : 'Lancer l\'exécution'}
                               </button>
                             )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {isAnalyzingExpert && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-slate-950 text-white p-8 rounded-[38px] flex flex-col items-center justify-center space-y-6"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-2 border-white/10 border-t-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles size={20} className="text-primary animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">Neural Engine Processing</p>
                        <h3 className="text-xl font-bold italic serif">Extraction d'insights haute-fidelité...</h3>
                      </div>
                    </motion.div>
                  )}

                  {selectedExpertAction && !isAnalyzingExpert && (() => {
                    const ActionIcon = iconMap[selectedExpertAction.iconName] || Lightbulb;
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-900 text-white p-10 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-10 opacity-5">
                          <ActionIcon size={200} />
                        </div>

                        <div className="md:col-span-2 space-y-8 relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40">
                              <ActionIcon size={28} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Analyse Experte Confirmée</span>
                                <div className="w-1 h-1 rounded-full bg-primary animate-ping"></div>
                              </div>
                              <h3 className="text-3xl font-black tracking-tighter">{selectedExpertAction.title}</h3>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-slate-400 text-sm font-black uppercase tracking-widest italic">Diagnostic Profond</p>
                            <p className="text-xl text-slate-100 font-medium leading-relaxed">
                              "{selectedExpertAction.deepAnalysis}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Gain Temporel</p>
                              <p className="text-lg font-bold">~140 min/semaine</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Impact Chiffre</p>
                              <p className="text-lg font-bold text-green-400">{selectedExpertAction.roi}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Statut IA</p>
                              <p className="text-lg font-bold">Prêt à exécuter</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 space-y-6 flex flex-col relative z-10">
                          <h4 className="text-sm font-black uppercase tracking-widest text-primary">Plan d'action IA</h4>
                          <div className="space-y-4 flex-1">
                            {selectedExpertAction?.steps?.map((step: string, i: number) => (
                              <div key={i} className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                                  {i + 1}
                                </div>
                                <p className="text-xs text-slate-300 font-medium">{step}</p>
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => {
                              toast.success("Action transmise à l'IA pour exécution immédiate.");
                              setSelectedExpertAction(null);
                            }}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                          >
                            Lancer l'Exécution
                          </button>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </MotionDiv>

      {mode === 'analysis' && (
        loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <Sparkles size={24} className="animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900">Analyse en cours...</h3>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">
                L'IA examine vos données de {activeSubTab === 'operations' ? 'performance' : activeSubTab === 'orders' ? 'commandes' : 'catalogue'} pour générer des recommandations stratégiques.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-8 opacity-40">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : currentAnalysis ? (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={20} />
                Résumé de l'analyse : {activeSubTab === 'operations' ? 'Opérations' : activeSubTab === 'orders' ? 'Commandes' : 'Boutique'}
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium mb-8">
                {currentAnalysis.summary}
              </p>
              
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sparkles className="text-primary" size={20} />
                Solutions Stratégiques
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                {currentAnalysis.solutions}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentAnalysis.challenges.map((challenge: any, idx: number) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col group"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      challenge.impact === 'Haut' ? 'bg-orange-100 text-orange-600' : 
                      challenge.impact === 'Moyen' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      Impact {challenge.impact}
                    </div>
                    <div className="text-slate-400 group-hover:text-primary transition-colors">
                      <TrendingUp size={24} />
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-3 tracking-tight">{challenge.title}</h4>
                  <p className="text-sm text-slate-500 mb-6 flex-1 leading-relaxed">
                    {challenge.description}
                  </p>
                  <div className="space-y-4 pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Délai</div>
                        <div className="text-sm font-bold text-slate-900">{challenge.deadline}</div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Action recommandée</div>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        {challenge.action}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={() => runAnalysis(activeSubTab)}
              disabled={loading}
              className="mt-6 px-6 py-3 bg-white text-primary rounded-xl font-bold text-sm shadow-sm border border-primary/10 hover:bg-primary/5 transition-all flex items-center gap-2"
            >
              <TrendingUp size={18} />
              Relancer l'analyse {activeSubTab === 'operations' ? 'Opérations' : activeSubTab === 'orders' ? 'Commandes' : 'Boutique'}
            </button>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100">
            <Sparkles className="mx-auto mb-4 text-slate-200" size={48} />
            <p className="text-slate-500 font-medium">Cliquez sur le bouton pour lancer l'analyse stratégique.</p>
            <button 
              onClick={() => runAnalysis(activeSubTab)}
              className="mt-6 px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all"
            >
              Lancer l'Assistant IA
            </button>
          </div>
        )
      )}
    </div>
  );
}

// Assurez-vous que le composant est bien fermé avant la suite
const safeParseImages = (jsonStr: string) => {
  try {
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse imageUrls:', e);
    return [];
  }
};

function ScoreTab({ insights, orders, catalog, stock, company, transactions, scores, onRefreshScores, calculatingScores, onNavigateToFunding }: { 
  insights: any, 
  orders: any[], 
  catalog: any[], 
  stock: any[], 
  company: any,
  transactions: any[],
  scores: any,
  onRefreshScores: () => void,
  calculatingScores: boolean,
  onNavigateToFunding: () => void
}) {
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const runSimulation = async (scenario: string) => {
    if (simulating) return;
    setSimulating(true);
    try {
      const totalRevenue = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc, 0);
      const totalExpense = transactions.reduce((acc, t) => t.type === 'expense' ? acc + t.amount : acc, 0);
      
      const context = {
        shop: {
          name: company.name,
          performance: {
            ordersCount: orders.length,
            revenue: totalRevenue,
            expenses: totalExpense,
            inventoryStatus: stock.length,
          }
        },
        simulation: scenario
      };

      const prompt = `Simule l'impact de ce scénario : "${scenario}" pour ${company.name}.
      Données : ${JSON.stringify(context)}
      RETOURNE UNIQUEMENT DU JSON :
      {
        "bankability": { "score": 85 },
        "funding": { "score": 78 },
        "growth": { "score": 92 },
        "predictive": { "trends": "Analyse de l'impact sur les tendances futures..." },
        "analysis": "Analyse rapide de l'impact théorique..."
      }`;

      const response = await safeGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response?.text || '{}');
      setSimulationResult(result);
    } catch (err) {
      console.error(err);
      toast.error('Erreur Simulation IA');
    } finally {
      setSimulating(false);
    }
  };

  const ScoreGauge = ({ score, label, color, subtitle, kpis }: { score: number, label: string, color: string, subtitle: string, kpis?: any[] }) => (
    <div className="bg-white p-6 sm:p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col items-center group hover:border-primary/20 transition-all">
      <div className="relative w-32 h-32 flex items-center justify-center mb-6">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-50" />
          <motion.circle 
            cx="64" cy="64" r="58" 
            stroke="currentColor" strokeWidth="8" fill="transparent" 
            strokeDasharray={2 * Math.PI * 58}
            initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - score / 100) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ color }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900 leading-none">{score}</span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">/100</span>
        </div>
      </div>
      <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors text-center">{label}</h4>
      <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-tighter">{subtitle}</p>
      
      {kpis && kpis.length > 0 && (
        <div className="mt-6 w-full space-y-2 border-t border-slate-50 pt-4">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">{kpi.label}</span>
              <span className={`text-[10px] font-black ${kpi.impact === 'positif' ? 'text-emerald-600' : kpi.impact === 'négatif' ? 'text-red-500' : 'text-slate-600'}`}>
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={`mt-6 w-full py-2 rounded-xl text-center text-[9px] font-black uppercase tracking-widest ${
        score >= 75 ? 'bg-emerald-50 text-emerald-600' : score >= 50 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
      }`}>
        {score >= 75 ? 'Performance Optimale' : score >= 50 ? 'Améliorations Recommandées' : 'Niveau de Risque Élevé'}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-10 rounded-[42px] text-white border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
           <ShieldCheck size={180} className="text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-3xl flex items-center justify-center shadow-2xl">
                  <Award size={32} className="text-primary" />
               </div>
               <div>
                  <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    Score IA Freebara
                    <Sparkles className="text-primary animate-pulse" size={24} />
                  </h2>
                  <p className="text-slate-400 font-medium text-sm">Le copilote financier & stratégique de votre boutique</p>
               </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="px-4 py-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Analyse Temps Réel active</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
             <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 italic">SIGNATURE PRODUIT</div>
             <div className="text-lg font-black text-primary italic leading-none whitespace-nowrap">
                “Ne gérez plus seulement votre boutique. Pilotez sa valeur.”
             </div>
          </div>
        </div>
      </div>

      {calculatingScores ? (
        <div className="bg-white p-24 rounded-[42px] border border-slate-100 flex flex-col items-center justify-center space-y-8 shadow-sm">
           <div className="relative">
              <div className="w-24 h-24 border-[6px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                 <Sparkles size={32} className="animate-pulse" />
              </div>
           </div>
           <div className="text-center space-y-3">
              <h3 className="text-2xl font-black text-slate-900">Expertise IA en cours...</h3>
              <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                Analyse poussée de vos données opérationnelles et stratégiques...
              </p>
           </div>
        </div>
      ) : scores ? (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Gauges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScoreGauge 
              score={scores?.bankability?.score || 0} 
              label={scores?.bankability?.title || "Bancabilité"} 
              subtitle="Stabilité & Fiabilité"
              color="#10b981"
              kpis={scores?.bankability?.kpis || []}
            />
            <ScoreGauge 
              score={scores?.funding?.score || 0} 
              label={scores?.funding?.title || "Éligibilité au Financement"} 
              subtitle="Accessibilité Capitaux"
              color="#3b82f6"
              kpis={scores?.funding?.kpis || []}
            />
            <ScoreGauge 
              score={scores?.growth?.score || 0} 
              label={scores?.growth?.title || "Potentiel de Croissance"} 
              subtitle="Scalabilité & Expansion"
              color="#8b5cf6"
              kpis={scores?.growth?.kpis || []}
            />
          </div>

          {/* Individual Analysis Section */}
          <div className="space-y-6">
            {scores && [scores.bankability, scores.funding, scores.growth].map((s, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      i === 0 ? 'bg-emerald-500 shadow-emerald-200' : 
                      i === 1 ? 'bg-blue-500 shadow-blue-200' : 'bg-purple-500 shadow-purple-200'
                    }`}>
                      {i === 0 ? <DollarSign size={24} /> : i === 1 ? <Target size={24} /> : <TrendingUp size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{s.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut:</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          s.score >= 75 ? 'text-emerald-600' : s.score >= 50 ? 'text-orange-500' : 'text-red-500'
                        }`}>{s.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-slate-900">{s.score}<span className="text-sm text-slate-300">/100</span></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analyse Stratégique</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {s.analysis}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Indicateurs de Performance (KPIs)</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {s.kpis.map((kpi: any, kIdx: number) => (
                        <div key={kIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-500">{kpi.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{kpi.value}</span>
                            <div className={`w-2 h-2 rounded-full ${
                              kpi.impact === 'positif' ? 'bg-emerald-500' : kpi.impact === 'négatif' ? 'bg-red-500' : 'bg-slate-300'
                            }`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recommendations Grid */}
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">

                <div className="absolute top-0 right-0 p-8 text-primary/5 pointer-events-none">
                  <Target size={120} />
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <Users size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Analyse de l'expert (Cofounder IA)</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border-l-4 border-primary">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                      "{scores.predictive?.trends || 'Analyse des tendances en cours...'}"
                    </p>
                  </div>
                  
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommandations stratégiques & Actionnables</h4>
                      {[
                        ...scores?.bankability?.recommendations?.map(r => ({ text: r, type: 'bankability' })) || [],
                        ...scores?.funding?.recommendations?.map(r => ({ text: r, type: 'funding' })) || [],
                        ...scores?.growth?.recommendations?.map(r => ({ text: r, type: 'growth' })) || []
                      ].slice(0, 6).map((rec, i) => (
                        <div key={i} className="flex gap-4 items-start p-5 bg-white border border-slate-100 rounded-3xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md group">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                            rec.type === 'bankability' ? 'bg-emerald-50 text-emerald-600' : 
                            rec.type === 'funding' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {i+1}
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-bold text-slate-800 leading-tight">{rec.text}</p>
                             <div className="flex items-center gap-2">
                               <span className="text-[9px] font-black uppercase text-slate-400">{rec.type === 'bankability' ? 'Bancabilité' : rec.type === 'funding' ? 'Financement' : 'Croissance'}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-200" />
                               <span className="text-[9px] font-bold text-primary">Priorité Haute</span>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              </div>

              {/* Simulation Mode */}
              <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[40px] border border-indigo-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform pointer-events-none">
                  <Sparkles size={120} className="text-indigo-600" />
                </div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                      <Target size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">Simulation de Croissance (Mode Simulation)</h3>
                  </div>
                  <div className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-widest">Wow Feature</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {scores.simulations.map((sim, i) => (
                    <div 
                      key={i} 
                      className="bg-white p-5 rounded-2xl border border-indigo-100 cursor-pointer hover:border-indigo-600 hover:shadow-md transition-all group/card"
                      onClick={() => runSimulation(sim.scenario)}
                    >
                      <p className="text-xs font-black text-slate-900 mb-2 truncate">"{sim.scenario}"</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{sim.impact}</span>
                        <ArrowUpRight size={14} className="text-indigo-400 group-hover/card:text-indigo-600 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setShowSimulation(true)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Sparkles size={14} /> Optimiser mon score dès maintenant
                </button>
              </div>
            </div>

            {/* Smart Funding & Risks Grid */}
            <div className="space-y-6">
              <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <DollarSign size={140} />
                </div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                    <Award size={20} />
                  </div>
                  <h3 className="text-lg font-black">Smart Funding Engine™</h3>
                </div>

                <div className="space-y-6">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                    "Sur la base de vos performances actuelles, vous êtes éligible à :"
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {scores.smartFunding.map((fund, i) => (
                      <div 
                        key={i} 
                        onClick={onNavigateToFunding}
                        className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-colors group cursor-pointer"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-black text-sm text-white">{fund.type}</h4>
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                            fund.eligibility.includes('Élevée') ? 'bg-emerald-500' : 'bg-orange-500'
                          }`}>
                            {fund.eligibility}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-bold group-hover:text-slate-300 transition-colors">{fund.reason}</p>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={onNavigateToFunding}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Déposer une demande de dossier
                  </button>
                </div>
              </div>

              {/* Predictive Risks Section */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Analyse Prédictive (Signaux faibles)</h3>
                </div>
                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 mb-6">
                   <p className="text-xs font-bold text-red-700 leading-relaxed">
                     <span className="font-black">Risque identifié :</span> {scores.predictive?.risks || 'Aucun risque majeur identifié.'}
                   </p>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Prochaine mise à jour</span>
                  <span className="text-slate-600">En direct</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[42px] border border-slate-100 space-y-6">
           <Award size={48} className="mx-auto text-slate-200" />
           <p className="italic font-medium text-slate-400 max-w-sm mx-auto">
             Aucune donnée d'analyse disponible pour le moment. L'audit nécessite des transactions et un catalogue actif.
           </p>
           <div className="flex flex-col sm:flex-row justify-center gap-4 px-8">
             <button 
               onClick={onRefreshScores} 
               className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
             >
               <Sparkles size={18} />
               Générer mon Audit IA
             </button>
             <button 
               onClick={onNavigateToFunding} 
               className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
             >
               <Plus size={18} />
               Déposer un Dossier
             </button>
           </div>
        </div>
      )}

      {/* Simulation Modal (Wow feature) */}
      <AnimatePresence>
        {showSimulation && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white rounded-[48px] w-full max-w-2xl overflow-hidden shadow-2xl border border-white/20"
             >
                <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900">Optimiseur de Score IA</h3>
                      <p className="text-slate-500 font-medium text-xs mt-1">Simulez des décisions business pour voir leur impact financier</p>
                   </div>
                   <button 
                     onClick={() => { setShowSimulation(false); setSimulationResult(null); }}
                     className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                   >
                      <X size={24} />
                   </button>
                </div>
                
                <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Appliquez une stratégie pour tester l'impact IA</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {[
                            { label: "Augmenter le panier moyen de +20%", s: "Augmentation du panier moyen de 20% via ventes croisées" },
                            { label: "Réduire les ruptures de stock de -80%", s: "Réduction drastique des ruptures de stock (disponibilité 99%)" },
                            { label: "Améliorer la marge de +10%", s: "Optimisation des prix pour gagner 10% de marge brute" },
                            { label: "Fidélisation Client : +30%", s: "Programme de fidélité augmentant la fréquence d'achat de 30%" },
                            { label: "Expansion : Nouveau Canal", s: "Ouverture d'un second point de vente physique" },
                            { label: "Marketing : +50% Visibilité", s: "Campagne publicitaire doublant le trafic en boutique" }
                         ].map((item, i) => (
                            <button 
                              key={i}
                              disabled={simulating}
                              onClick={() => runSimulation(item.s)}
                              className="w-full p-5 bg-slate-50 border-2 border-transparent hover:border-primary/30 rounded-3xl text-left transition-all hover:bg-white hover:shadow-lg group"
                            >
                               <div className="flex justify-between items-start mb-2">
                                  <span className="font-bold text-slate-700 text-sm">{item.label}</span>
                                  <Target size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                               </div>
                               <p className="text-[10px] text-slate-400 font-medium leading-tight">Cliquez pour recalculer les scores financiers prédictifs.</p>
                            </button>
                         ))}
                      </div>
                   </div>

                   {simulating && (
                      <div className="bg-primary/5 p-8 rounded-3xl flex items-center gap-6 animate-pulse">
                         <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin shrink-0" />
                         <p className="text-primary font-black text-xs uppercase tracking-widest">Calcul de l'impact financier en cours...</p>
                      </div>
                   )}

                   {simulationResult && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 space-y-6"
                      >
                         <div className="flex items-center gap-3 text-emerald-600">
                            <Sparkles size={20} />
                            <h4 className="font-black text-sm uppercase tracking-widest">Résultat de la Simulation</h4>
                         </div>
                         <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                               <div className="text-2xl font-black text-slate-900">{simulationResult.bankability.score}</div>
                               <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Bankability</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                               <div className="text-2xl font-black text-slate-900">{simulationResult.funding.score}</div>
                               <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Funding</div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
                               <div className="text-2xl font-black text-slate-900">{simulationResult.growth.score}</div>
                               <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Growth</div>
                            </div>
                         </div>
                         <p className="text-emerald-700 font-bold text-sm italic py-2 leading-relaxed">
                           "{simulationResult.predictive?.trends || 'Simulation terminée avec succès'}"
                         </p>
                      </motion.div>
                   )}
                </div>
                
                <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
                   <p className="text-[10px] font-bold text-slate-400 italic">“La simulation utilise des modèles probabilistes basés sur vos flux réels.”</p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FundingTab({ 
  company, 
  transactions, 
  orders, 
  stock, 
  scores 
}: { 
  company: any, 
  transactions: any[], 
  orders: any[], 
  stock: any[], 
  scores: any 
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [form, setForm] = useState({
    institutionId: '',
    fundingType: '',
    amount: '',
    reason: '',
    files: [] as { name: string, type: string, data: string }[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqs, insts] = await Promise.all([
        api.companies.getMyFundingRequests(),
        api.institutions.getAll()
      ]);
      // Filter requests for this specific company
      setRequests(reqs.filter((r: any) => Number(r.companyId) === Number(company.id)));
      setInstitutions(insts);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la récupération des données');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Le fichier ${file.name} est trop volumineux (max 10Mo)`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({
          ...prev,
          files: [...prev.files, {
            name: file.name,
            type: file.type,
            data: reader.result as string
          }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setForm(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!form.institutionId || !form.fundingType || !form.amount) {
      toast.error('Veuillez remplir les informations obligatoires');
      return;
    }

    setSubmitting(true);
    try {
      const strategicData = {
        iaScores: scores,
        kpis: {
          totalRevenue: transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc, 0),
          ordersCount: orders.length,
          inventoryHealth: {
            total: stock.length,
            lowStock: stock.filter(s => s.quantity <= s.minQuantity).length
          }
        },
        timestamp: new Date().toISOString(),
        files: form.files.map(f => ({ name: f.name, type: f.type }))
      };

      await api.companies.submitFundingRequest(company.id, {
        fundingType: form.fundingType,
        amount: parseFloat(form.amount),
        reason: form.reason || 'Demande via Dashboard',
        institutionId: parseInt(form.institutionId),
        strategicData: {
          ...strategicData,
          attachedFiles: form.files // Base64 data included here
        }
      });

      toast.success('Votre demande de financement a été déposée avec succès');
      setIsModalOpen(false);
      setStep(1);
      setForm({ institutionId: '', fundingType: '', amount: '', reason: '', files: [] });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors du dépôt de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInstitutions = institutions.filter(inst => 
    inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inst.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 p-10 rounded-[42px] text-white border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
           <DollarSign size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-3xl flex items-center justify-center shadow-2xl">
                  <DollarSign size={32} className="text-emerald-400" />
               </div>
               <div>
                  <h2 className="text-3xl font-black tracking-tight">Financement & Crédit</h2>
                  <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Propulsez votre croissance</p>
               </div>
            </div>
            <p className="text-slate-400 font-medium max-w-xl text-sm leading-relaxed">
              Accédez à des lignes de crédit, des subventions et des investissements basés sur votre performance réelle certifiée par notre IA.
            </p>
          </div>

          <button 
            onClick={() => {
              setStep(1);
              setIsModalOpen(true);
            }}
            className="px-8 py-5 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.05] transition-all flex items-center justify-center gap-3 active:scale-95 whitespace-nowrap"
          >
            <Plus size={20} />
            Déposer une demande
          </button>
        </div>
      </div>

      {/* Requests History List */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Historique des demandes</h3>
          <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest">
            {requests.length} demandes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institution</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {requests.map((request: any) => (
                <tr key={request.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Award size={16} />
                      </div>
                      <span className="text-slate-700">{request.creditInstitution?.name || 'Institution'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-slate-900">{formatCurrency(request.amount || 0)} FCFA</td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] uppercase tracking-widest font-black">
                      {request.fundingType}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-slate-500 text-sm font-medium">{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      request.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                      request.status === 'rejected' ? 'bg-red-100 text-red-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {request.status === 'approved' ? 'Approuvée' :
                       request.status === 'rejected' ? 'Refusée' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                        <DollarSign size={40} className="opacity-20" />
                      </div>
                      <p className="italic font-medium text-slate-400">Aucun dossier de financement déposé pour le moment.</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <Loader2 size={32} className="animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-step Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[48px] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Demande de Dossier</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full transition-all ${step === 1 ? 'bg-primary scale-110' : 'bg-slate-300'}`} />
                      <div className={`w-2 h-2 rounded-full transition-all ${step === 2 ? 'bg-primary scale-110' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Étape {step} sur 2</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                {step === 1 ? (
                  <div className="space-y-8">
                    {/* Institution Selector with Search */}
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">1. Choisir l'institution (Banque, IMF...)</label>
                      <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                          type="text"
                          placeholder="Rechercher une institution..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] pl-16 pr-8 py-5 font-bold text-slate-700 focus:border-primary outline-none transition-all placeholder:text-slate-300"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredInstitutions.map(inst => (
                          <button
                            key={inst.id}
                            onClick={() => setForm({ ...form, institutionId: inst.id.toString() })}
                            className={`p-5 rounded-3xl border-2 text-left transition-all flex items-center justify-between group ${
                              form.institutionId === inst.id.toString()
                                ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                                : 'border-slate-50 hover:border-slate-200 bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${form.institutionId === inst.id.toString() ? 'bg-primary text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                                  <Award size={20} />
                               </div>
                               <div>
                                  <p className={`font-black text-sm ${form.institutionId === inst.id.toString() ? 'text-primary' : 'text-slate-700'}`}>
                                    {inst.name}
                                  </p>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{inst.type}</p>
                               </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              form.institutionId === inst.id.toString() ? 'border-primary bg-primary text-white' : 'border-slate-200'
                            }`}>
                              {form.institutionId === inst.id.toString() && <Check size={14} />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">2. Montant souhaité (FCFA)</label>
                        <input 
                          type="number"
                          placeholder="Ex: 1000000"
                          value={form.amount}
                          onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] px-8 py-5 font-bold text-slate-700 focus:border-primary outline-none transition-all placeholder:text-slate-300"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">3. Type de projet</label>
                        <select 
                          value={form.fundingType}
                          onChange={(e) => setForm({ ...form, fundingType: e.target.value })}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] px-8 py-5 font-bold text-slate-700 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Sélectionner...</option>
                          <option value="BFR">Besoin en Fonds de Roulement</option>
                          <option value="Equipement">Achat d'équipement</option>
                          <option value="Expansion">Expansion / Nouveaux sites</option>
                          <option value="Stock">Constitution de stock</option>
                          <option value="Digitalisation">Transformation digitale</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">4. Justification du besoin</label>
                      <textarea 
                        rows={3}
                        placeholder="Expliquez brièvement l'impact de ce financement sur votre boutique..."
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[28px] px-8 py-5 font-bold text-slate-700 focus:border-primary outline-none transition-all resize-none placeholder:text-slate-300 shadow-inner"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div className="text-center space-y-3">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200 border-2 border-slate-100 shadow-inner">
                        <Upload size={36} />
                      </div>
                      <h4 className="text-xl font-black text-slate-900">Pièces Justificatives</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono">Booster votre éligibilité</p>
                    </div>

                    {/* File Upload Area */}
                    <div className="grid grid-cols-1 gap-6">
                      <label className="border-4 border-dashed border-slate-100 rounded-[40px] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-50 transition-all hover:border-primary/20 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="p-5 bg-white rounded-2xl text-slate-300 group-hover:text-primary group-hover:scale-110 transition-all shadow-sm relative z-10">
                          <Plus size={32} />
                        </div>
                        <div className="text-center relative z-10">
                          <p className="font-black text-slate-700 uppercase tracking-widest text-xs">Déposer vos documents</p>
                          <div className="flex gap-4 mt-3">
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                <FileText size={12} className="text-primary" /> PDF
                             </div>
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                <ImageIcon size={12} className="text-indigo-400" /> IMG
                             </div>
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400">
                                <Video size={12} className="text-emerald-400" /> MP4
                             </div>
                          </div>
                        </div>
                        <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,image/*,video/*" />
                      </label>

                      {/* File List */}
                      <div className="grid grid-cols-1 gap-3">
                        {form.files.map((file, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-slate-100 group hover:bg-white hover:shadow-lg transition-all"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0">
                                {file.type.includes('pdf') ? <FileText size={24} /> : 
                                 file.type.includes('image') ? <ImageIcon size={24} /> :
                                 file.type.includes('video') ? <Video size={24} /> : <FileText size={24} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-700 truncate">{file.name}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">{file.type.split('/')[1]}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeFile(idx)}
                              className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="p-8 bg-emerald-50 rounded-[32px] border border-emerald-100 flex gap-5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 text-emerald-200/20 group-hover:scale-125 transition-transform">
                         <Sparkles size={60} />
                      </div>
                      <Lightbulb className="text-emerald-600 shrink-0 mt-1" size={28} />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-widest">Conseil Expert IA</p>
                        <p className="text-sm font-bold text-emerald-700/80 leading-relaxed italic">
                          L'ajout de documents certifiés (factures, business plan) augmente la crédibilité de votre dossier de <span className="text-emerald-900 font-black">45%</span>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-10 border-t border-slate-100 bg-white flex gap-5">
                {step === 2 && (
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-5 bg-slate-100 text-slate-700 rounded-[28px] font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    Retour
                  </button>
                )}
                <button 
                  onClick={() => step === 1 ? setStep(2) : handleSubmit()}
                  disabled={submitting}
                  className="flex-[2] py-5 bg-primary text-white rounded-[28px] font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Validation IA...
                    </>
                  ) : (
                    <>
                      {step === 1 ? 'Étape Suivante' : 'Finaliser le Dossier'}
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ShopDashboard({ company, onClose, initialTab = 'dashboard' }: ShopDashboardProps) {
  const [activeTab, setActiveTab] = useState<'shops' | 'orders' | 'stock' | 'dashboard' | 'assistant' | 'score' | 'funding' | 'ads'>(initialTab);
  const [timeframe, setTimeframe] = useState<'7' | '30'>('30');
  const [insights, setInsights] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [productMovements, setProductMovements] = useState<Record<number, any[]>>({});
  const [addQtys, setAddQtys] = useState<Record<number, number>>({});
  const [costPrices, setCostPrices] = useState<Record<number, number>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [scores, setScores] = useState<any>(null);
  const [calculatingScores, setCalculatingScores] = useState(false);

  const generateDashboardScores = async (isSimulation = false, extraContext = "") => {
    if (calculatingScores) return;
    setCalculatingScores(true);
    
    try {
      const totalRevenue = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc, 0);
      const totalExpense = transactions.reduce((acc, t) => t.type === 'expense' ? acc + t.amount : acc, 0);
      const profit = totalRevenue - totalExpense;
      const avgBasket = orders.length > 0 ? totalRevenue / orders.length : 0;
      
      const context = {
        shop: {
          name: company.name,
          sector: company.sector,
          performance: {
            ordersCount: orders.length,
            revenue: totalRevenue,
            expenses: totalExpense,
            profit,
            inventoryStatus: stock.length,
            lowStockItems: stock.filter(s => s.quantity <= s.minQuantity).length,
            activeProducts: catalog.length,
            avgBasket,
            stockoutRate: catalog.length > 0 ? (stock.filter(s => s.quantity <= 0).length / catalog.length) * 100 : 0,
            burnRate: totalExpense / 6,
          }
        },
        simulation: extraContext
      };

      const prompt = `Génère un rapport de Score IA 2.0 EXTRÊMEMENT DÉTAILLÉ pour la boutique "${company.name}" (${company.sector}).
      Analyse ces données réelles : ${JSON.stringify(context)}

      TU DOIS CALCULER 3 SCORES MAJEURS (0-100) :
      1. Bankability Score™ : Capacité à obtenir un prêt bancaire classique (gestion des flux, régularité, marges).
      2. Funding Readiness Score™ : Maturité pour une levée de fonds ou crowdfunding (vision, structuration, potentiel d'échelle).
      3. Growth Potential Score™ : Capacité intrinsèque à multiplier son CA (rétention, catalogue, efficacité stock).

      POUR CHAQUE SCORE, INCLUS :
      - Une valeur numérique précise.
      - 3 KPIs spécifiques calculés (ex: Taux de marge brute estimé, Coefficient de rotation, Ratio de dépendance).
      - 3 Recommandations granulaires et actionnables.

      AJOUTE ÉGALEMENT :
      - "predictive": un objet avec "trends" (phrase sur les tendances futures) et "risks" (phrase sur les risques potentiels).

      RETOURNE UNIQUEMENT DU JSON :
      {
        "bankability": { "score": 85, "kpis": ["..."], "recommendations": ["..."] },
        "funding": { "score": 72, "kpis": ["..."], "recommendations": ["..."] },
        "growth": { "score": 91, "kpis": ["..."], "recommendations": ["..."] },
        "predictive": { "trends": "...", "risks": "..." },
        "globalAnalysis": "Synthèse de 3 phrases sur la santé du business"
      }`;

      const response = await safeGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response?.text || '{}');
      setScores(result);
    } catch (err) {
      console.error(err);
      toast.error('Erreur Score IA');
    } finally {
      setCalculatingScores(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'score' && !scores && !calculatingScores) {
      generateDashboardScores();
    }
  }, [activeTab]);

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };

  const exportToPDF = (productName: string, movements: any[]) => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Historique des approvisionnements - ${productName}`, 14, 15);
      autoTable(doc, {
          startY: 25,
          head: [['Date', 'Heure', 'Quantité']],
          body: movements
              .filter(m => m.type === 'purchase')
              .map(m => [
                  new Date(m.createdAt).toLocaleDateString(),
                  new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  `+${m.quantity}`
              ]),
      });
      doc.save(`approvisionnements_${productName.replace(/ /g, '_')}.pdf`);
  };
  const [productToDelete, setProductToDelete] = useState<number | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [assistantData, setAssistantData] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Product Form State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrls: [] as string[],
    tag: '',
    tagValue: ''
  });
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedTagProducts, setSelectedTagProducts] = useState<number[]>([]);
  const [tagForm, setTagForm] = useState({ tag: '', tagValue: '' });
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchDashboardData();

    // Socket listeners for real-time updates
    const handleNewOrder = (data: any) => {
      if (Number(data.companyId) === Number(company.id)) {
        setOrders(prev => [data.order, ...prev]);
        toast.success('Nouvelle commande reçue !', { icon: '🛍️' });
        // Refresh insights to update charts/stats
        api.companies.getInsights(company.id).then(setInsights);
      }
    };

    const handleOrderStatusUpdate = (data: any) => {
      if (Number(data.companyId) === Number(company.id)) {
        let shouldTrigger = false;
        
        setOrders(prev => {
          const updatedOrders = prev.map(o => o.id === Number(data.orderId) ? { ...o, status: data.status } : o);
          
          const oldOrder = prev.find(o => o.id === Number(data.orderId));
          
          if (data.status === 'confirmed' && oldOrder?.status !== 'confirmed') {
            const confirmedCount = updatedOrders.filter(o => o.status === 'confirmed').length;
            if (confirmedCount === 1 || confirmedCount % 100 === 0) {
              shouldTrigger = true;
            }
          }
          return updatedOrders;
        });

        if (shouldTrigger) {
          triggerCelebration();
        }
      }
    };

    const handleStockAlert = (data: any) => {
      toast.error(`Alerte stock : Un produit atteint son seuil critique (${data.quantity} restants)`, { icon: '⚠️', duration: 8000 });
      fetchDashboardData();
    };

    socket.on('new_shop_order', handleNewOrder);
    socket.on('shop_order_status_updated', handleOrderStatusUpdate);
    socket.on('stock_alert', handleStockAlert);

    return () => {
      socket.off('new_shop_order', handleNewOrder);
      socket.off('shop_order_status_updated', handleOrderStatusUpdate);
      socket.off('stock_alert', handleStockAlert);
    };
  }, [company.id]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [insightsData, ordersData, catalogData, stockData, transactionsData] = await Promise.all([
        api.companies.getInsights(company.id),
        api.companies.getOrders(company.id),
        api.companies.getCatalog(company.id),
        api.companies.getStock(company.id),
        api.users.getTransactions()
      ]);
      setInsights(insightsData);
      setOrders(ordersData);
      setCatalog(catalogData);
      setStock(stockData);
      setTransactions(transactionsData);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await api.companies.updateOrderStatus(orderId, status);
      setOrders(prev => {
        const updated = prev.map(o => o.id === orderId ? { ...o, status } : o);
        const confirmedOrders = updated.filter(o => o.status === 'confirmed');
        if (status === 'confirmed' && confirmedOrders.length === 1) {
          triggerCelebration();
        }
        return updated;
      });
      toast.success('Statut de la commande mis à jour');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProduct(true);
    try {
      const data = {
        ...productForm,
        price: parseFloat(productForm.price),
        imageUrls: productForm.imageUrls
      };

      if (editingProduct) {
        await api.companies.updateProduct(company.id, editingProduct.id, data);
        toast.success('Produit mis à jour');
      } else {
        await api.companies.addProduct(company.id, data);
        toast.success('Produit ajouté');
      }
      
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ name: '', description: '', price: '', category: '', imageUrls: [], tag: '', tagValue: '' });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'enregistrement du produit');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      await api.companies.deleteProduct(company.id, productId);
      setCatalog(prev => prev.filter(p => p.id !== productId));
      toast.success('Produit supprimé');
      setProductToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProductForm(prev => ({
            ...prev,
            imageUrls: [...prev.imageUrls, reader.result as string].slice(0, 4)
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleApplyTags = async () => {
    if (selectedTagProducts.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }
    if (!tagForm.tag) {
      toast.error('Veuillez sélectionner un tag');
      return;
    }
    try {
      for (const productId of selectedTagProducts) {
        const product = catalog.find(p => p.id === productId);
        if (product) {
          await api.companies.updateProduct(company.id, productId, {
            ...product,
            tag: tagForm.tag,
            tagValue: tagForm.tagValue
          });
        }
      }
      toast.success('Tags appliqués avec succès');
      setTagModalOpen(false);
      setSelectedTagProducts([]);
      setTagForm({ tag: '', tagValue: '' });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'application des tags');
    }
  };

  if (loading && !insights) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen -mx-4 sm:-mx-8 p-4 sm:p-8">
      {showCelebration && <SaleCelebration onClose={() => setShowCelebration(false)} />}
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Tableau de Bord</h1>
            <p className="text-slate-500 font-medium">Gérez votre boutique {company.name}</p>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Retour à la page publique
          </button>
        </div>

        {/* Sidebar and Content */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <nav className="flex flex-col gap-2 p-2 bg-white border border-slate-100 rounded-3xl shadow-sm w-full md:w-64 h-fit">
            { [
              { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, color: 'text-violet-500', bg: 'bg-violet-500' },
              { id: 'shops', label: 'Catalogue', icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-500' },
              { id: 'stock', label: 'Stock', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500' },
              { id: 'orders', label: 'Commandes', icon: ShoppingCart, color: 'text-pink-500', bg: 'bg-pink-500' },
              { id: 'assistant', label: 'Assistant IA', icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500' },
              { id: 'score', label: 'Score IA', icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-500' },
              { id: 'funding', label: 'Financement', icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-500' },
              { id: 'ads', label: 'Publicités', icon: Target, color: 'text-red-500', bg: 'bg-red-500' },
              ...( ['Transport', 'Hébergement'].includes(company.domaine) ? [{ id: 'reservations', label: 'Réservations', icon: Calendar, color: 'text-sky-500', bg: 'bg-sky-500' }] : []),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 ${
                  activeTab === item.id 
                    ? `${item.bg} text-white shadow-lg ${item.bg.replace('bg-', 'shadow-')}/20` 
                    : 'text-slate-500 hover:text-slate-900 bg-slate-50'
                }`}
              >
                <item.icon size={16} className={activeTab === item.id ? 'text-white' : item.color} />
                {item.label}
              </button>
            ))}
          </nav>
          
          {/* Main content */}
          <div className="flex-1">

        {/* Celebration Overlay */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl opacity-50"
                />
                <Award size={128} className="text-yellow-400 fill-yellow-400 drop-shadow-2xl" />
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -100 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -top-10 -right-10 text-yellow-300"
                >
                  <Star size={32} fill="currentColor" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -100 }}
                  transition={{ duration: 1.5, delay: 0.5, repeat: Infinity }}
                  className="absolute -top-10 -left-10 text-yellow-300"
                >
                  <Star size={32} fill="currentColor" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'reservations' && (
            <motion.div
              key="reservations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">Gestion des Réservations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Réservations</p>
                    <p className="text-2xl font-black text-slate-900">128</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-500">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conversion</p>
                    <p className="text-2xl font-black text-slate-900">12%</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Disponibilités</p>
                    <p className="text-2xl font-black text-slate-900">45</p>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Revenus</p>
                    <p className="text-2xl font-black text-slate-900">1.2M F</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ads' && (
            <AdsDashboard company={company} />
          )}

          {activeTab === 'stock' && (
            <motion.div
              key="stock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">Gestion des Stocks</h3>
              <div className="space-y-4">
                {catalog.map(product => {
                  const s = stock.find(st => st.productId === product.id);
                  const isExpanded = expandedProducts.has(product.id);
                  const quantity = s?.quantity || 0;
                  const isCrit = quantity <= (s?.minQuantity || 5);
                  
                  return (
                    <div key={product.id} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        onClick={() => {
                          if (!isExpanded) {
                            api.companies.getStockMovements(company.id, product.id).then(movements => {
                                setProductMovements(prev => ({ ...prev, [product.id]: movements }));
                            });
                          }
                          setExpandedProducts(prev => {
                            const next = new Set(prev);
                            if (next.has(product.id)) next.delete(product.id);
                            else next.add(product.id);
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl overflow-hidden shrink-0">
                            {product.imageUrls && safeParseImages(product.imageUrls).length > 0 ? (
                              <img src={safeParseImages(product.imageUrls)[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100"><Package size={24} /></div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isCrit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                {isCrit ? 'Critique' : 'En stock'}
                              </span>
                              <p className="text-xs text-slate-500 font-medium">Stock: {quantity}</p>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-100 bg-white">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Historique des approvisionnements</p>
                            <button 
                               onClick={() => exportToPDF(product.name, productMovements[product.id] || [])}
                               className="text-xs text-primary font-bold hover:underline"
                            >
                                Exporter PDF
                            </button>
                          </div>
                          <div className="space-y-2 mb-6">
                            {(productMovements[product.id] || []).filter(m => m.type === 'purchase').slice(0, 5).map((m, i) => (
                                <div key={i} className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-emerald-600">+{m.quantity}</span>
                                        <span className="text-slate-600 font-medium">unités ajoutées</span>
                                    </div>
                                    <span className="text-slate-400 text-xs">
                                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            {(productMovements[product.id] || []).filter(m => m.type === 'purchase').length === 0 && (
                                 <p className="text-xs text-slate-400 italic">Aucun approvisionnement historique disponible.</p>
                            )}
                          </div>
                          <div className="mt-4 p-4 bg-slate-100 rounded-xl">
                            <label className="text-xs font-bold text-slate-500 mb-2 block">Ajouter au stock</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={addQtys[product.id] || ''}
                                    onChange={(e) => setAddQtys(prev => ({ ...prev, [product.id]: parseInt(e.target.value) || 0 }))}
                                    className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                    placeholder="Quantité"
                                />
                                <input 
                                    type="number" 
                                    value={costPrices[product.id] || ''}
                                    onChange={(e) => setCostPrices(prev => ({ ...prev, [product.id]: parseFloat(e.target.value) || 0 }))}
                                    className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                    placeholder="Prix Revient"
                                />
                                <button 
                                    onClick={async () => {
                                        const qtyToAdd = addQtys[product.id] || 0;
                                        const costPrice = costPrices[product.id] || 0;
                                        if (qtyToAdd <= 0) return;
                                        const newQty = (s?.quantity || 0) + qtyToAdd;
                                        await api.companies.updateStock(company.id, product.id, { quantity: newQty, minQuantity: s?.minQuantity || 5, reason: 'purchase', costPrice });
                                        setStock(prev => {
                                          const exists = prev.find(st => st.productId === product.id);
                                          if (exists) return prev.map(item => item.productId === product.id ? {...item, quantity: newQty, costPrice} : item);
                                          return [...prev, { productId: product.id, quantity: newQty, minQuantity: 5, costPrice }];
                                        });
                                        const movements = await api.companies.getStockMovements(company.id, product.id);
                                        setProductMovements(prev => ({ ...prev, [product.id]: movements }));
                                        setAddQtys(prev => ({ ...prev, [product.id]: 0 }));
                                        setCostPrices(prev => ({ ...prev, [product.id]: 0 }));
                                    }}
                                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                                >
                                    Valider
                                </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {/* Main KPIs Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <DollarSign size={100} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Total des ventes</span>
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black mb-2 truncate text-white">
                      {formatCurrency(insights?.totalSales || 0)} <span className="text-lg opacity-60">FCFA</span>
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-100">
                      <ArrowUpRight size={14} />
                      <span>{((insights?.totalSales || 0) > 0 ? '+12.4%' : '0%')} vs mois dernier</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-600 group-hover:scale-110 transition-transform">
                    <ShoppingCart size={100} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                        <ShoppingCart size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commandes totales</span>
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mb-2">{insights?.ordersCount}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500">
                      <CheckCircle2 size={12} />
                      <span>{insights?.ordersCount > 0 ? 'Activité régulière' : 'En attente de commandes'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-600 group-hover:scale-110 transition-transform">
                    <Users size={100} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Users size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clients uniques</span>
                    </div>
                    <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mb-2">{insights?.customersCount}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500">
                      <ArrowUpRight size={14} />
                      <span>Fidélisation en hausse</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-600 group-hover:scale-110 transition-transform">
                     <Package size={100} />
                   </div>
                   <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                         <Package size={20} />
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Articles actifs</span>
                     </div>
                     <h3 className="text-3xl lg:text-4xl font-black text-slate-900 mb-2">{catalog.length}</h3>
                     <div className="text-[10px] font-bold text-slate-400">
                       Dont {stock.filter(s => s.quantity <= s.minQuantity).length} en alerte stock
                     </div>
                     <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Valeur Bénéficiaire Estimée</p>
                        <p className="text-xl font-black text-emerald-900">
                          {formatCurrency(1000)}
                        </p>
                     </div>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sales Chart Section */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 lg:p-10 rounded-[42px] shadow-sm border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Courbe de Croissance</h3>
                        <p className="text-slate-500 font-medium">Ventes journalières des {timeframe === '30' ? '30' : '7'} derniers jours</p>
                      </div>
                      <div className="flex bg-slate-50 p-1 rounded-xl w-fit">
                        <button 
                          onClick={() => setTimeframe('30')}
                          className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${timeframe === '30' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          30J
                        </button>
                        <button 
                          onClick={() => setTimeframe('7')}
                          className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${timeframe === '7' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          7J
                        </button>
                      </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={insights?.salesByDay?.slice(timeframe === '30' ? -30 : -7)}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            tickFormatter={(str) => {
                              try {
                                return new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                              } catch(e) { return str; }
                            }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '24px', 
                              border: 'none', 
                              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                              padding: '20px',
                              backgroundColor: '#fff'
                            }}
                            itemStyle={{ color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                            labelStyle={{ color: '#64748b', fontWeight: 700, marginBottom: '8px' }}
                            formatter={(value: any) => [`${formatCurrency(value)} FCFA`, 'Chiffre d\'affaires']}
                            labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="#3b82f6" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorSales)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <div className="bg-slate-900 p-8 rounded-[40px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform">
                          <TrendingUp size={100} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[3px] text-slate-500 mb-6">Pic historique</h4>
                        <div className="text-4xl font-black text-primary mb-2">
                           {formatCurrency(insights?.peakSalesDay?.amount || 0)} <span className="text-sm opacity-50 uppercase tracking-tighter">FCFA</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400">
                           Atteint le {insights?.peakSalesDay ? new Date(insights.peakSalesDay.date).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) : 'N/A'}
                        </p>
                     </div>
                     <div className="bg-emerald-600 p-8 rounded-[40px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                          <Users size={100} />
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-[3px] text-emerald-100/50 mb-6">Rentabilité client</h4>
                        <div className="text-4xl font-black text-white mb-2">
                           {formatCurrency(Math.round(insights?.totalSales / (insights?.customersCount || 1)))} <span className="text-sm opacity-50 uppercase tracking-tighter font-medium">FCFA</span>
                        </div>
                        <p className="text-xs font-bold text-emerald-100/70">
                           Valeur moyenne générée par client unique
                        </p>
                     </div>
                  </div>
                </div>

                {/* Top 5 Products Sidebar */}
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[42px] shadow-sm border border-slate-100 flex-1">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Top 5 Produits</h3>
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Award size={20} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {insights?.topProducts?.slice(0, 5).map((product: any, idx: number) => {
                        const catalogItem = catalog.find(p => p.name === product.name);
                        return (
                          <div key={idx} className="group block p-4 bg-slate-50 hover:bg-slate-100/50 rounded-3xl border border-transparent hover:border-slate-200 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="relative w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex-shrink-0 shadow-sm">
                                {catalogItem?.imageUrls && safeParseImages(catalogItem.imageUrls)[0] ? (
                                  <img src={safeParseImages(catalogItem.imageUrls)[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Package size={24} />
                                  </div>
                                )}
                                <div className="absolute top-0 left-0 w-6 h-6 bg-slate-900 text-white text-[10px] font-black flex items-center justify-center rounded-br-xl">
                                  {idx + 1}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate uppercase tracking-tighter">{product.name}</h4>
                                <div className="flex flex-col gap-0.5 mt-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                                    <ShoppingCart size={10} className="text-primary" />
                                    {product.totalQuantity} VENTES
                                  </div>
                                  <div className="text-xs font-black text-emerald-600">
                                    {formatCurrency(product.totalRevenue || 0)} FCFA
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${Math.min(100, (product.totalRevenue / (insights.totalSales || 1)) * 100)}%` }}
                                 className="h-full bg-primary shadow-sm shadow-primary/30"
                               />
                            </div>
                          </div>
                        );
                      })}
                      {(!insights?.topProducts || insights.topProducts.length === 0) && (
                        <div className="text-center py-12">
                           <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                             <Package size={32} className="text-slate-200" />
                           </div>
                           <p className="text-xs font-bold text-slate-400 italic">Aucune donnée de vente</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Highlights section */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[40px] text-white">
                     <h4 className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 mb-6">Mises en avant</h4>
                     <div className="space-y-4">
                        {[
                          { id: 1, label: 'Promotions actives', val: catalog.filter(p => p.tag === 'Promotion').length, icon: Tag, color: 'text-orange-400' },
                          { id: 2, label: 'Nouveautés', val: catalog.filter(p => p.tag === 'Nouveautés').length, icon: Sparkles, color: 'text-blue-400' },
                          { id: 3, label: 'Alerte Stock', val: stock.filter(s => s.quantity <= s.minQuantity).length, icon: ShieldAlert, color: 'text-red-400' }
                        ].map(item => (
                          <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <item.icon size={18} className={item.color} />
                              <span className="font-bold text-sm text-slate-200 uppercase tracking-tighter">{item.label}</span>
                            </div>
                            <span className="text-lg font-black">{item.val}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-slate-900">Gestion des Commandes</h3>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <Search size={18} className="text-slate-400" />
                    <input type="text" placeholder="Rechercher..." className="bg-transparent border-none outline-none text-sm font-medium w-full" />
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        <th className="px-8 py-4">Client</th>
                        <th className="px-8 py-4">Produit</th>
                        <th className="px-8 py-4">Total</th>
                        <th className="px-8 py-4">Marge</th>
                        <th className="px-8 py-4">Date</th>
                        <th className="px-8 py-4">Statut</th>
                        <th className="px-8 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{order.customerName}</span>
                              <span className="text-xs text-slate-500">{order.customerWhatsapp}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-medium text-slate-700">{order.productName}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-black text-slate-900">{formatCurrency(order.totalPrice || 0)} FCFA</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-black text-emerald-600">
                                  { formatCurrency(order.totalPrice - ((stock.find(s => s.productId === order.productId)?.costPrice || 0) * order.quantity)) } FCFA
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Marge nette</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="px-8 py-5">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Confirmer"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Annuler"
                              >
                                <XCircle size={18} />
                              </button>
                              <button 
                                onClick={() => window.open(`https://wa.me/${order.customerWhatsapp?.replace(/[^0-9]/g, '')}`, '_blank')}
                                className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                title="Contacter"
                              >
                                <MoreVertical size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-50">
                  {orders.map((order) => (
                    <div key={order.id} className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900">{order.customerName}</div>
                          <div className="text-xs text-slate-500">{order.customerWhatsapp}</div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Produit</div>
                          <div className="text-sm font-medium text-slate-700">{order.productName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total</div>
                          <div className="font-black text-slate-900">{formatCurrency(order.totalPrice || 0)} FCFA</div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-600 rounded-xl text-xs font-bold"
                        >
                          <CheckCircle2 size={16} /> Confirmer
                        </button>
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold"
                        >
                          <XCircle size={16} /> Annuler
                        </button>
                        <button 
                          onClick={() => window.open(`https://wa.me/${order.customerWhatsapp?.replace(/[^0-9]/g, '')}`, '_blank')}
                          className="px-4 py-2.5 bg-primary/10 text-primary rounded-xl"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'shops' && (
            <motion.div
              key="shops"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {/* Add Product Card */}
              <button 
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: '', category: '', imageUrls: [], tag: '', tagValue: '' });
                  setShowProductModal(true);
                }}
                className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-8 flex flex-col items-center justify-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[300px]"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                  <Plus size={32} />
                </div>
                <span className="font-black text-slate-900 uppercase tracking-widest text-sm">Ajouter un produit</span>
              </button>

              {catalog.map((product) => {
                let images: string[] = [];
                try {
                  const parsed = product.imageUrls ? JSON.parse(product.imageUrls) : [];
                  images = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                  images = [];
                }
                return (
                  <div key={product.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 group">
                    <div className="aspect-[4/3] sm:aspect-square bg-slate-100 relative">
                      {images.length > 0 ? (
                        <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package size={48} />
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setProductForm({
                              name: product.name,
                              description: product.description,
                              price: product.price.toString(),
                              category: product.category,
                              imageUrls: Array.isArray(images) ? [...images] : [],
                              tag: product.tag || '',
                              tagValue: product.tagValue || ''
                            });
                            setShowProductModal(true);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg text-slate-700 hover:text-primary transition-colors"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => setProductToDelete(product.id)}
                          className="p-2 bg-white rounded-full shadow-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-xl text-xs font-black text-slate-900 shadow-sm">
                        {formatCurrency(product.price || 0)} FCFA
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{product.category}</div>
                      <h3 className="font-bold text-slate-900 mb-2">{product.name}</h3>
                      <div className="relative">
                        <p className={`text-xs text-slate-500 ${!expandedProducts.has(product.id) ? 'line-clamp-3' : ''}`}>
                          {product.description}
                        </p>
                        {product.description && product.description.length > 100 && (
                          <button 
                            onClick={() => {
                              const newSet = new Set(expandedProducts);
                              if (newSet.has(product.id)) {
                                newSet.delete(product.id);
                              } else {
                                newSet.add(product.id);
                              }
                              setExpandedProducts(newSet);
                            }}
                            className="text-primary font-bold text-[10px] mt-1 hover:underline uppercase tracking-wider"
                          >
                            {expandedProducts.has(product.id) ? 'Réduire' : 'Tout lire'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'funding' && (
            <FundingTab 
              company={company}
              transactions={transactions || []}
              orders={orders}
              stock={stock}
              scores={scores}
            />
          )}

          {activeTab === 'assistant' && (
            <AssistantTab 
              insights={insights} 
              orders={orders} 
              catalog={catalog} 
              stock={stock}
              company={company}
              transactions={transactions || []}
            />
          )}

          {activeTab === 'score' && (
            <ScoreTab 
              insights={insights} 
              orders={orders} 
              catalog={catalog} 
              stock={stock} 
              company={company}
              transactions={transactions || []}
              scores={scores}
              calculatingScores={calculatingScores}
              onRefreshScores={() => generateDashboardScores()}
              onNavigateToFunding={() => setActiveTab('funding')}
            />
          )}
        </AnimatePresence>
        </div>
        </div>

        {/* Product Modal */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-2xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[95vh]"
            >
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </h2>
                <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleProductSubmit} className="space-y-6">
                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Images (Max 4)</label>
                  <div className="grid grid-cols-4 gap-4">
                    {Array.isArray(productForm.imageUrls) && productForm.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setProductForm(prev => ({ ...prev, imageUrls: (prev.imageUrls || []).filter((_, i) => i !== idx) }))}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {Array.isArray(productForm.imageUrls) && productForm.imageUrls.length < 4 && (
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-all">
                        <ImageIcon size={24} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400">Ajouter</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nom du produit</label>
                    <input 
                      required
                      type="text" 
                      value={productForm.name}
                      onChange={e => setProductForm({...productForm, name: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Prix (FCFA)</label>
                    <input 
                      required
                      type="number" 
                      value={productForm.price}
                      onChange={e => setProductForm({...productForm, price: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Catégorie</label>
                  <select 
                    required
                    value={productForm.category}
                    onChange={e => setProductForm({...productForm, category: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium appearance-none"
                  >
                    <option value="">Choisir une catégorie</option>
                    {(company.categories ? (Array.isArray(company.categories) ? company.categories : company.categories.split(',')) : []).map((cat: string) => (
                      <option key={cat} value={typeof cat === 'string' ? cat.trim() : cat}>
                        {typeof cat === 'string' ? cat.trim() : cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    required
                    rows={4}
                    value={productForm.description}
                    onChange={e => setProductForm({...productForm, description: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tag (Optionnel)</label>
                    <select 
                      value={productForm.tag}
                      onChange={e => setProductForm({...productForm, tag: e.target.value, tagValue: ''})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium appearance-none"
                    >
                      <option value="">Aucun tag</option>
                      <option value="Nouveautés">Nouveautés</option>
                      <option value="Promotion">Promotion</option>
                      <option value="Offre flash">Offre flash</option>
                      <option value="Best-seller">Best-seller</option>
                    </select>
                  </div>
                  
                  {productForm.tag === 'Promotion' && (
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pourcentage de réduction (%)</label>
                      <input 
                        type="number" 
                        placeholder="Ex: 20"
                        value={productForm.tagValue}
                        onChange={e => setProductForm({...productForm, tagValue: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      />
                    </div>
                  )}
                  
                  {productForm.tag === 'Offre flash' && (
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nouveau prix (FCFA)</label>
                      <input 
                        type="number" 
                        placeholder="Ex: 5000"
                        value={productForm.tagValue}
                        onChange={e => setProductForm({...productForm, tagValue: e.target.value})}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingProduct}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSavingProduct ? <Loader2 size={18} className="animate-spin" /> : null}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Supprimer le produit ?</h3>
              <p className="text-slate-500 text-sm mb-8">Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => handleDeleteProduct(productToDelete)}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Tag Assignment Modal */}
        {tagModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
                <h2 className="text-xl font-black text-slate-900">Attribuer des tags</h2>
                <button onClick={() => setTagModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">1. Choisir un tag</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Nouveautés', 'Promotion', 'Offre flash', 'Best-seller'].map(tag => (
                      <button
                        key={tag}
                        onClick={() => setTagForm({ ...tagForm, tag, tagValue: '' })}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          tagForm.tag === tag 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {tagForm.tag === 'Promotion' && (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Pourcentage de réduction (%)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 20"
                      value={tagForm.tagValue}
                      onChange={e => setTagForm({...tagForm, tagValue: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    />
                  </div>
                )}
                
                {tagForm.tag === 'Offre flash' && (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nouveau prix (FCFA)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 5000"
                      value={tagForm.tagValue}
                      onChange={e => setTagForm({...tagForm, tagValue: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">2. Sélectionner les produits</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {catalog.map(product => (
                      <label key={product.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedTagProducts.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTagProducts([...selectedTagProducts, product.id]);
                            } else {
                              setSelectedTagProducts(selectedTagProducts.filter(id => id !== product.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                          {product.imageUrls && safeParseImages(product.imageUrls).length > 0 ? (
                            <img src={safeParseImages(product.imageUrls)[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={20} className="m-auto mt-2.5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{product.name}</h4>
                          <p className="text-xs text-slate-500">{product.price} FCFA</p>
                        </div>
                        {product.tag && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                            {product.tag}
                          </span>
                        )}
                      </label>
                    ))}
                    {catalog.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        Aucun produit dans le catalogue.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-4">
                <button 
                  onClick={() => {
                    setTagModalOpen(false);
                    setSelectedTagProducts([]);
                    setTagForm({ tag: '', tagValue: '' });
                  }}
                  className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleApplyTags}
                  disabled={selectedTagProducts.length === 0 || !tagForm.tag}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Appliquer les tags
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${colors[color]} rounded-xl sm:rounded-2xl flex items-center justify-center`}>
          <Icon size={20} className="sm:w-6 sm:h-6" />
        </div>
        <div className={`flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-bold ${trend.startsWith('+') ? 'text-green-500' : 'text-slate-400'}`}>
          {trend.startsWith('+') ? <ArrowUpRight size={12} className="sm:w-3.5 sm:h-3.5" /> : null}
          {trend}
        </div>
      </div>
      <div className="text-base sm:text-2xl font-black text-slate-900 mb-0.5 sm:mb-1 truncate">{value}</div>
      <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest truncate">{title}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    pending: { label: 'En attente', class: 'bg-orange-100 text-orange-600' },
    confirmed: { label: 'Confirmée', class: 'bg-blue-100 text-blue-600' },
    delivered: { label: 'Livrée', class: 'bg-green-100 text-green-600' },
    cancelled: { label: 'Annulée', class: 'bg-red-100 text-red-600' }
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${config.class}`}>
      {config.label}
    </span>
  );
}
