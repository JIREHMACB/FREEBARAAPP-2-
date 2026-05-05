import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Calendar, ArrowUpRight, ArrowDownLeft, 
  PiggyBank, CreditCard, Eye, EyeOff, Filter, 
  ArrowUpDown, Wallet, Sparkles, ChevronDown, 
  ChevronUp, PieChart as PieIcon, LineChart as LineIcon,
  LayoutDashboard, List, Target, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, AreaChart, Area
} from 'recharts';
import { api, socket } from '../lib/api';

const CATEGORIES = ['Salaires', 'Loyer', 'Alimentation', 'Vente', 'Fournitures', 'Transport', 'Loisirs', 'Santé', 'Autre'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#f97316', '#64748b'];

type TabType = 'overview' | 'transactions' | 'budget';

export default function FinancePage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showBalance, setShowBalance] = useState(true);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('finance_budgets');
    return saved ? JSON.parse(saved) : {
      'Loyer': 0,
      'Alimentation': 0,
      'Fournitures': 0,
      'Transport': 0,
      'Autre': 0
    };
  });

  const [filter, setFilter] = useState({ category: 'Tous', type: 'Tous' });
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  
  const [newOp, setNewOp] = useState({
    description: '',
    amount: '',
    category: CATEGORIES[0],
    type: 'expense',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    localStorage.setItem('finance_budgets', JSON.stringify(budgets));
  }, [budgets]);

  const fetchTransactions = async () => {
    try {
      const data = await api.users.getTransactions();
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const handleTransactionUpdate = (newTransaction: any) => {
      setTransactions(prev => {
        if (prev.find(t => t.id === newTransaction.id)) return prev;
        return [newTransaction, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    };

    socket.on('transaction_update', handleTransactionUpdate);
    return () => {
      socket.off('transaction_update', handleTransactionUpdate);
    };
  }, []);

  const filteredTransactions = useMemo(() => {
    let data = [...transactions];
    if (filter.category !== 'Tous') data = data.filter(t => t.category === filter.category);
    if (filter.type !== 'Tous') data = data.filter(t => t.type === filter.type);
    
    data.sort((a, b) => {
      const aVal = a[sort.key as keyof typeof a];
      const bVal = b[sort.key as keyof typeof b];
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [transactions, filter, sort]);

  const balance = useMemo(() => transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : t.type === 'expense' ? acc - t.amount : acc, 0), [transactions]);
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0), [transactions]);

  // Chart Data: Distribution by category (Expenses)
  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories = Array.from(new Set(expenses.map(t => t.category)));
    return categories.map(cat => ({
      name: cat,
      value: expenses.filter(t => t.category === cat).reduce((acc, t) => acc + t.amount, 0)
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Chart Data: Monthly trends
  const trendData = useMemo(() => {
    const monthly: Record<string, { month: string, income: number, expense: number }> = {};
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      
      if (!monthly[monthKey]) {
        monthly[monthKey] = { month: monthLabel, income: 0, expense: 0 };
      }
      
      if (t.type === 'income') monthly[monthKey].income += t.amount;
      else monthly[monthKey].expense += t.amount;
    });
    
    return Object.values(monthly).slice(-6); // Last 6 months
  }, [transactions]);

  const handleAddOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOp.description || !newOp.amount) return;
    
    try {
      await api.users.addTransaction({
        date: newOp.date,
        description: newOp.description,
        category: newOp.category,
        amount: Number(newOp.amount),
        type: newOp.type
      });
      
      toast.success('Opération enregistrée');
      setShowOperationModal(false);
      setNewOp({ 
        description: '', 
        amount: '', 
        category: CATEGORIES[0], 
        type: 'expense',
        date: new Date().toISOString().split('T')[0]
      });
      fetchTransactions(); // Refresh
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleUpdateBudget = (category: string, amount: number) => {
    setBudgets(prev => ({ ...prev, [category]: amount }));
  };

  const spentByCategory = useMemo(() => {
    const spent: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      spent[t.category] = (spent[t.category] || 0) + t.amount;
    });
    return spent;
  }, [transactions]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-32">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <button onClick={onBack} className="text-slate-500 hover:text-slate-900 font-medium mb-4 flex items-center gap-2">
            ← Retour
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Finance Connect</h1>
              <p className="text-sm text-slate-500 font-medium">Tableau de bord financier intelligent</p>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutDashboard size={18} /> Aperçu
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List size={18} /> Flux
          </button>
          <button 
            onClick={() => setActiveTab('budget')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'budget' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Target size={18} /> Budget
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <CreditCard size={120} className="-mr-10 -mt-10 rotate-12" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold tracking-widest opacity-60">SOLDE TOTAL</span>
                    <button onClick={() => setShowBalance(!showBalance)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                      {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-4xl font-black">{showBalance ? `${balance.toLocaleString()} FCFA` : '••••••••'}</h2>
                    <p className="text-emerald-400 text-sm font-bold">+2.4% ce mois-ci</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <ArrowDownLeft size={24} />
                  </div>
                  <span className="text-sm font-bold text-slate-500">REVENUS TOTAL</span>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{totalIncome.toLocaleString()} FCFA</p>
                  <p className="text-xs text-slate-400 mt-1">Sur la période sélectionnée</p>
                </div>
              </div>

              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                    <ArrowUpRight size={24} />
                  </div>
                  <span className="text-sm font-bold text-slate-500">DÉPENSES TOTAL</span>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{totalExpense.toLocaleString()} FCFA</p>
                  <p className="text-xs text-slate-400 mt-1">Sur la période sélectionnée</p>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Analyse des flux</h3>
                    <p className="text-sm text-slate-500 font-medium">Revenus vs Dépenses mensuels</p>
                  </div>
                  <TrendingUp className="text-slate-400" />
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="income" name="Entrées" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                      <Area type="monotone" dataKey="expense" name="Sorties" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Répartition par catégorie</h3>
                    <p className="text-sm text-slate-500 font-medium">Où va mon argent ?</p>
                  </div>
                  <PieIcon className="text-slate-400" />
                </div>
                <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
                  <div className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-48 space-y-2">
                    {categoryData.slice(0, 5).map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                          <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400">{totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"></div>
              <div className="relative z-10 text-center md:text-left">
                <h3 className="text-2xl font-black mb-2 flex items-center justify-center md:justify-start gap-2">
                   Optimisation du budget <Sparkles size={24} className="text-amber-400" />
                </h3>
                <p className="text-slate-400">L'IA analyse vos transactions pour vous aider à épargner intelligemment.</p>
              </div>
              <button 
                onClick={async () => {
                  toast.loading("Analyse en cours...", { id: 'ai' });
                  try {
                    const { safeGenerateContent } = await import('../lib/gemini');
                    const response = await safeGenerateContent({
                      model: 'gemini-3-flash-preview',
                      contents: `Agis en tant qu'expert en finances. Analyse ces transactions: ${JSON.stringify(transactions.slice(0, 30))}. Donne 3 conseils concrets pour optimiser le budget. Format JSON: [{title, advice}].`,
                      config: { responseMimeType: "application/json" }
                    });
                    const tips = JSON.parse(response?.text || '[]');
                    const tip = tips[0];
                    toast.success(`${tip.title}: ${tip.advice}`, { duration: 6000 });
                  } catch (e) { toast.error("Analyse indisponible"); }
                  finally { toast.dismiss('ai'); }
                }}
                className="relative z-10 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition-all shadow-xl"
              >
                Lancer l'Analyse IA
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div 
            key="transactions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Historique complet</h2>
                  <p className="text-sm text-slate-500 font-medium">Gérez chaque centime avec précision</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  <div className="flex-1 md:flex-none relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                      className="pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none w-full"
                      onChange={(e) => setFilter({...filter, category: e.target.value})}
                    >
                      <option value="Tous">Toutes les catégories</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowOperationModal(true)}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                  >
                    <Plus size={18} /> Nouvelle opération
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-6 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => setSort({key: 'date', direction: sort.direction === 'asc' ? 'desc' : 'asc'})}>DATE <ArrowUpDown size={12} className="inline ml-1 opacity-50"/></th>
                      <th className="pb-6">DESCRIPTION</th>
                      <th className="pb-6">CATÉGORIE</th>
                      <th className="pb-6 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => setSort({key: 'amount', direction: sort.direction === 'asc' ? 'desc' : 'asc'})}>MONTANT <ArrowUpDown size={12} className="inline ml-1 opacity-50"/></th>
                      <th className="pb-6">TYPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <div className="max-w-xs mx-auto space-y-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                              <List size={32} />
                            </div>
                            <p className="text-slate-500 font-bold">Aucune transaction trouvée</p>
                            <button onClick={() => setShowOperationModal(true)} className="text-primary font-black text-sm">Ajouter votre première opération</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map(t => (
                        <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-5 text-sm font-bold text-slate-600">
                            {new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-5">
                            <p className="text-sm font-black text-slate-900">{t.description}</p>
                          </td>
                          <td className="py-5">
                            <span className="px-3 py-1 bg-white border border-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                              {t.category}
                            </span>
                          </td>
                          <td className={`py-5 font-black text-base ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'expense' ? '-' : '+'}{t.amount.toLocaleString()} <span className="text-[10px] opacity-70">FCFA</span>
                          </td>
                          <td className="py-5">
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{t.type === 'income' ? 'Entrée' : 'Sortie'}</span>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'budget' && (
          <motion.div 
            key="budget"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Suivi du Budget</h2>
                    <p className="text-sm text-slate-500 font-medium">Définissez vos objectifs par catégorie</p>
                  </div>
                  <Target className="text-primary" />
                </div>
                
                <div className="space-y-8">
                  {CATEGORIES.filter(cat => cat !== 'Salaires' && cat !== 'Vente').map(cat => (
                    <div key={cat} className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-sm font-black text-slate-700">{cat}</span>
                        <div className="flex items-center gap-2">
                           <input 
                            type="number" 
                            className="w-24 text-right p-2 bg-slate-50 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={budgets[cat] || 0}
                            onChange={(e) => handleUpdateBudget(cat, Number(e.target.value))}
                           />
                           <span className="text-[10px] font-bold text-slate-400 uppercase">FCFA</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full rounded-full ${
                            (spentByCategory[cat] || 0) > (budgets[cat] || 0) ? 'bg-rose-500' : 'bg-primary'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(((spentByCategory[cat] || 0) / (budgets[cat] || 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-400">Consommé: {(spentByCategory[cat] || 0).toLocaleString()} FCFA</span>
                        <span className={`${(spentByCategory[cat] || 0) > (budgets[cat] || 0) ? 'text-rose-500' : 'text-slate-400'}`}>
                          {budgets[cat] ? `${Math.round(((spentByCategory[cat] || 0) / budgets[cat]) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-slate-900 p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl">
                   <div className="absolute top-0 right-0 p-8 -mr-16 -mt-16 opacity-10">
                     <PiggyBank size={200} className="rotate-12" />
                   </div>
                   <div className="relative z-10 space-y-4">
                     <h3 className="text-xl font-black">Planificateur Intelligent</h3>
                     <p className="text-slate-400 text-sm leading-relaxed">
                        En fonction de vos revenus moyens, nous vous suggérons de ne pas dépasser 
                        <span className="text-white font-black mx-1">{(totalIncome * 0.7).toLocaleString()} FCFA</span> 
                        de dépenses fixes par mois pour maintenir une épargne saine.
                     </p>
                     <div className="pt-4">
                        <div className="text-4xl font-black text-amber-400 mb-1">
                          {totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0}%
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ratio de dépense actuel</p>
                     </div>
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                   <h3 className="text-lg font-black text-slate-900 mb-6">Alertes de dépassement</h3>
                   <div className="space-y-4">
                      {Object.keys(budgets).some(cat => (spentByCategory[cat] || 0) > budgets[cat] && budgets[cat] > 0) ? (
                        Object.keys(budgets).map(cat => {
                          if ((spentByCategory[cat] || 0) > budgets[cat] && budgets[cat] > 0) {
                            return (
                              <div key={cat} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4">
                                <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white shrink-0">
                                  <ArrowUpRight size={20} />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-rose-900">Dépassement: {cat}</p>
                                  <p className="text-xs text-rose-600">Dépassement de {((spentByCategory[cat] || 0) - budgets[cat]).toLocaleString()} FCFA</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })
                      ) : (
                        <div className="py-8 flex flex-col items-center gap-3 text-center">
                          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                            <Sparkles size={32} />
                          </div>
                          <p className="text-sm font-bold text-slate-500 max-w-[200px]">Félicitations ! Aucun dépassement détecté ce mois-ci.</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operation Modal */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Flux d'argent</h2>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-1">Nouvelle écriture</p>
              </div>
              <button onClick={() => setShowOperationModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddOperation} className="space-y-6">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                 <button 
                  type="button"
                  onClick={() => setNewOp({...newOp, type: 'income'})}
                  className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newOp.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                 >
                   REVENU
                 </button>
                 <button 
                  type="button"
                  onClick={() => setNewOp({...newOp, type: 'expense'})}
                  className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newOp.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                 >
                   DÉPENSE
                 </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Désignation</label>
                  <input 
                    required 
                    value={newOp.description}
                    onChange={e => setNewOp({...newOp, description: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium" 
                    placeholder="Ex: Facture CIE, Salaire Mars..." 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant</label>
                    <input 
                      required 
                      type="number" 
                      min="0"
                      value={newOp.amount}
                      onChange={e => setNewOp({...newOp, amount: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-black text-slate-900" 
                      placeholder="15000" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                    <input 
                      required 
                      type="date"
                      value={newOp.date}
                      onChange={e => setNewOp({...newOp, date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-900" 
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                  <div className="relative">
                    <select 
                      value={newOp.category}
                      onChange={e => setNewOp({...newOp, category: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-bold text-slate-900 appearance-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowOperationModal(false)} 
                  className="flex-1 py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-black transition-colors uppercase text-xs tracking-widest"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black shadow-xl shadow-slate-900/20 transition-all uppercase text-xs tracking-widest"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
